# FOROOMS: Technical Reference & Architecture Blueprint (v1.0.0)

This document provides concrete code patterns, schemas, and algorithms to guide the development of FOROOMS, addressing the core technical challenges: real-time edge authentication, performance-first greedy meshing, elevation mappings, and multi-provider AI routing.

---

## 1. Edge Authentication: PartyKit + Supabase JWT Verification
To verify Supabase sessions locally on the PartyKit edge server without incurring the latency of a database call:

```typescript
// party/server.ts
import * as Party from "partykit/server";
import { jwtVerify, createRemoteJWKSet } from "jose";

interface AuthUser {
  id: string;
  email: string;
  role: "citizen" | "participant" | "builder" | "admin";
}

export default class Server implements Party.Server {
  private jwkSet: ReturnType<typeof createRemoteJWKSet> | null = null;

  constructor(readonly room: Party.Room) {
    const supabaseUrl = process.env.SUPABASE_URL; // e.g. https://xyz.supabase.co
    if (supabaseUrl) {
      this.jwkSet = createRemoteJWKSet(
        new URL(`${supabaseUrl}/auth/v1/.well-known/jwks.json`)
      );
    }
  }

  async onBeforeConnect(req: Party.Request, connection: Party.Connection) {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");

    if (!token || !this.jwkSet) {
      throw new Error("Unauthorized: Missing auth credentials.");
    }

    try {
      // Local cryptographic JWT verification
      const { payload } = await jwtVerify(token, this.jwkSet, {
        issuer: `${process.env.SUPABASE_URL}/auth/v1`,
        audience: "authenticated",
      });

      // Extract user claims and attach to connection state
      const userMetadata = payload.user_metadata as any;
      const user: AuthUser = {
        id: payload.sub as string,
        email: payload.email as string,
        role: userMetadata?.role || "citizen",
      };

      // Store in connection.state for role-based authorization in onMessage
      connection.setState({ user });
      return req;
    } catch (err) {
      console.error("JWT Verification failed:", err);
      throw new Error("Unauthorized: Invalid token.");
    }
  }

  onConnect(connection: Party.Connection, ctx: Party.ConnectionContext) {
    const user = connection.state?.user as AuthUser | undefined;
    console.log(`User ${user?.email} connected with role ${user?.role}`);
  }
}
```

---

## 2. Volumetric Greedy Meshing Algorithm (TypeScript)
Greedy meshing merges contiguous coplanar faces of identical textures into larger polygons, reducing geometry complexity by up to 98%.

```typescript
// lib/greedyMesh.ts
export interface MeshFace {
  vertices: number[];
  indices: number[];
  normals: number[];
  uvs: number[];
}

/**
 * Greedily meshes a 3D grid of voxels for a single chunk.
 * Implements Lysenko's greedy meshing algorithm.
 */
export function generateGreedyMesh(
  dims: [number, number, number],
  voxelAt: (x: number, y: number, z: number) => number
): MeshFace[] {
  const faces: MeshFace[] = [];
  
  // Sweep over each of the 3 coordinate axes
  for (let d = 0; d < 3; d++) {
    const u = (d + 1) % 3;
    const v = (d + 2) % 3;
    
    const x = [0, 0, 0];
    const q = [0, 0, 0];
    q[d] = 1;
    
    // Mask to track processed faces in the 2D plane slice
    const mask = new Int32Array(dims[u] * dims[v]);
    
    x[d] = -1;
    while (x[d] < dims[d]) {
      // 1. Compute the mask for this slice
      let n = 0;
      for (x[v] = 0; x[v] < dims[v]; ++x[v]) {
        for (x[u] = 0; x[u] < dims[u]; ++x[u]) {
          const a = x[d] >= 0 ? voxelAt(x[0], x[1], x[2]) : 0;
          const b = x[d] < dims[d] - 1 ? voxelAt(x[0] + q[0], x[1] + q[1], x[2] + q[2]) : 0;
          
          if (a !== 0 && b !== 0 && a === b) {
            mask[n++] = 0; // Both solid & identical -> occluded face
          } else if (a !== 0) {
            mask[n++] = a; // Face points out
          } else if (b !== 0) {
            mask[n++] = -b; // Face points in
          } else {
            mask[n++] = 0; // Empty space
          }
        }
      }
      
      x[d]++;
      
      // 2. Generate mesh from mask
      n = 0;
      for (let j = 0; j < dims[v]; ++j) {
        for (let i = 0; i < dims[u]; ) {
          const type = mask[n];
          if (type !== 0) {
            // Find width
            let w = 1;
            while (i + w < dims[u] && mask[n + w] === type) {
              w++;
            }
            
            // Find height
            let h = 1;
            let ok = true;
            while (j + h < dims[v]) {
              for (let k = 0; k < w; ++k) {
                if (mask[n + k + h * dims[u]] !== type) {
                  ok = false;
                  break;
                }
              }
              if (!ok) break;
              h++;
            }
            
            // Add quad coordinates
            x[u] = i;
            x[v] = j;
            
            const du = [0, 0, 0]; du[u] = w;
            const dv = [0, 0, 0]; dv[v] = h;
            
            // Push geometry data
            faces.push({
              vertices: [
                x[0], x[1], x[2],
                x[0] + du[0], x[1] + du[1], x[2] + du[2],
                x[0] + du[0] + dv[0], x[1] + du[1] + dv[1], x[2] + du[2] + dv[2],
                x[0] + dv[0], x[1] + dv[1], x[2] + dv[2]
              ],
              indices: [
                0, 1, 2,
                0, 2, 3
              ],
              normals: [0, 0, 0], // Compute based on direction
              uvs: [
                0, 0,
                w, 0,
                w, h,
                0, h
              ]
            });
            
            // Zero out mask values we just processed
            for (let l = 0; l < h; ++l) {
              for (let k = 0; k < w; ++k) {
                mask[n + k + l * dims[u]] = 0;
              }
            }
            
            i += w;
            n += w;
          } else {
            i++;
            n++;
          }
        }
      }
    }
  }
  
  return faces;
}
```

---

## 3. Geospatial DEM Elevation Mapping & Foundation Extrusion
To project buildings onto sloped topography without floating foundations, we compute heights starting from the lowest terrain coordinate under the footprint:

```typescript
// lib/elevation.ts
interface LatLng {
  lat: number;
  lng: number;
}

/**
 * Projects Lat/Lng bounding box and queries DEM elevation map.
 * Adapts building extrusion foundations on sloped terrain.
 */
export function buildVoxelTerrain(
  bbox: [LatLng, LatLng],
  elevationMatrix: number[][], // 2D grid matching chunk grid
  buildingFootprints: { coordinates: LatLng[]; heightLevels: number }[]
) {
  const S = 0.5; // 2m voxel resolution
  
  for (const building of buildingFootprints) {
    // 1. Project footprint coordinates to grid indices
    const gridIndices = building.coordinates.map(coord => 
      projectLatLngToGrid(coord, bbox[0], S)
    );
    
    // 2. Find minimum terrain height under the footprint
    let minTerrainVoxel = Infinity;
    for (const [x, z] of gridIndices) {
      const terrainHeightMeters = elevationMatrix[z][x];
      const terrainVoxel = Math.floor(terrainHeightMeters * S);
      if (terrainVoxel < minTerrainVoxel) {
        minTerrainVoxel = terrainVoxel;
      }
    }
    
    // 3. Extrude building from minTerrainVoxel upward
    const buildingHeightVoxels = Math.floor((building.heightLevels * 3) * S);
    const roofVoxel = minTerrainVoxel + buildingHeightVoxels;
    
    // Fill voxel columns: from minTerrainVoxel to roofVoxel
    fillVoxelVolume(gridIndices, minTerrainVoxel, roofVoxel);
  }
}

function projectLatLngToGrid(coord: LatLng, origin: LatLng, S: number): [number, number] {
  const R = 6371000;
  const x = Math.floor(R * (coord.lng - origin.lng) * Math.cos(origin.lat * Math.PI / 180) * (Math.PI / 180) * S);
  const z = Math.floor(R * (coord.lat - origin.lat) * (Math.PI / 180) * S);
  return [x, z];
}

function fillVoxelVolume(coords: [number, number][], startY: number, endY: number) {
  // Set solid voxels in memory chunk grid
}
```

---

## 4. Multi-Provider AI Protector routing API
Admins can store their own keys in Supabase, and the backend routes LLM requests dynamically:

```typescript
// app/api/ai-protector/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { OpenAI } from "openai";
import { Anthropic } from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";

export async function POST(req: Request) {
  const { foroomId, chatContext } = await req.json();
  
  // 1. Fetch AI config and encrypted key from Supabase (Service Role bypass)
  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: config, error } = await supabase
    .from("foroom_ai_settings")
    .select("*")
    .eq("foroom_id", foroomId)
    .eq("is_active", true)
    .single();

  if (error || !config) {
    return NextResponse.json({ error: "AI settings not configured" }, { status: 400 });
  }

  // Decrypt API key (assumed stored securely using vault or crypto module)
  const apiKey = decrypt(config.encrypted_api_key);

  let responseText = "";

  // 2. Dynamic client broker
  switch (config.provider) {
    case "openai": {
      const openai = new OpenAI({ apiKey });
      const completion = await openai.chat.completions.create({
        model: config.model_name || "gpt-4o",
        messages: [{ role: "system", content: config.system_prompt }, ...chatContext],
      });
      responseText = completion.choices[0].message.content || "";
      break;
    }
    case "anthropic": {
      const anthropic = new Anthropic({ apiKey });
      const msg = await anthropic.messages.create({
        model: config.model_name || "claude-3-5-sonnet",
        system: config.system_prompt,
        messages: chatContext,
        max_tokens: 1024,
      });
      responseText = msg.content[0].text;
      break;
    }
    case "gemini": {
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: config.model_name || "gemini-2.5-flash",
        contents: chatContext,
        config: { systemInstruction: config.system_prompt }
      });
      responseText = response.text || "";
      break;
    }
    case "openrouter": {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: config.model_name || "meta-llama/llama-3-8b-instruct",
          messages: [{ role: "system", content: config.system_prompt }, ...chatContext],
        }),
      });
      const data = await response.json();
      responseText = data.choices[0].message.content;
      break;
    }
  }

  return NextResponse.json({ response: responseText });
}

function decrypt(text: string): string {
  // Local decryption implementation matching database encryption
  return text; 
}
```
