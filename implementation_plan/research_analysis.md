# FOROOMS: Implementation Plan Critical Analysis

This document analyzes the v1.1.0 implementation plan against the gathered research and feedback to identify potential inconsistencies, architectural gaps, and areas requiring more detail before coding begins.

## 1. MapLibre 2D Map vs. React Three Fiber 3D Canvas
**Gap Identified:** The plan describes a "zoom-dive transition" from the 2D MapLibre map to the 3D voxel space, but lacks technical details on how these two distinct rendering contexts interact. MapLibre uses Web Mercator projection and its own WebGL context, while Three.js uses a Cartesian coordinate system and a separate WebGL context.
**Resolution / Next Steps:**
- Define a strict boundary: The 2D MapLibre map is used for the **macro-view** (exploring forums, selecting bounding boxes). The 3D Three.js canvas is used for the **micro-view** (inside a Foroom).
- Transition: Use CSS cross-fading and a coordinated camera animation (MapLibre zooms in $\rightarrow$ opacity crossfade to Three.js camera descending into the voxel grid) rather than trying to render Three.js inside the MapLibre context (which is complex and hurts performance).

## 2. Authentication Flow Between Supabase and PartyKit
**Gap Identified:** PartyKit handles WebSockets at the edge, but Supabase holds the user roles and database. How does PartyKit know a user is authorized to place a block?
**Resolution / Next Steps:**
- **JWT Verification:** When the Next.js client connects to PartyKit, it must pass the Supabase Session JWT in the connection string or initial message. PartyKit must verify this JWT using the Supabase JWT Secret.
- **Server-to-Server Auth:** PartyKit will use the Supabase Admin Role Key (or a dedicated service role) to read/write the `foroom_edits` table, ensuring users cannot bypass PartyKit to write directly to the DB.

## 3. Bounding Box Limits & Voxel Generation Scale
**Gap Identified:** A user could draw a bounding box over an entire country, crashing the server and client. The plan mentions 2m voxels but doesn't enforce maximum limits.
**Resolution / Next Steps:**
- Enforce a **hard UI limit** during Foroom creation: Max bounding box area of $2 \times 2$ km (approx. 1 million ground cells at 2m resolution).
- Add validation logic in the Supabase edge function/API route to reject OSM fetches for boxes exceeding this limit.

## 4. Digital Elevation Model (DEM) Source & Building Foundations
**Gap Identified:** "Fetch DEM data" is abstract. Public APIs (like Open-Elevation) are often too slow or low resolution for a 2m voxel grid. Furthermore, if a building is placed on sloped terrain, does it float?
**Resolution / Next Steps:**
- **DEM Source:** We will use **Mapbox Terrain-RGB tiles** (requires a Mapbox token) as the primary DEM source due to its high speed, high resolution, and reliability. If no token is provided, the system will fall back to a flat plane ($y=0$).
- **Building Foundations:** When extruding a building, calculate the minimum and maximum terrain height under its footprint. The building must extrude from the *lowest* terrain point up to the roof height to ensure it doesn't float on slopes.

## 5. Chunk Serialization Format
**Gap Identified:** "Run-Length Encoding (RLE)" is mentioned, but the binary structure isn't defined, which is a massive risk when frontend and backend teams (or AI sessions) need to communicate.
**Resolution / Next Steps:**
- Define the binary format: A chunk is a `Uint16Array` where pairs of integers represent `[count, blockId]`.
- Example: `[10000, 0, 50, 1, 20, 2]` means 10,000 air blocks, 50 grass blocks, 20 stone blocks.

## 6. AI Protector Execution Context
**Gap Identified:** The plan says the AI uses "Builder API credentials". This implies a REST API, but the AI runs server-side.
**Resolution / Next Steps:**
- The AI Protector will run as a **Supabase Edge Function** or a scheduled cron job on Vercel. It interacts with the database directly using service-role privileges, impersonating a "System Builder" user. It does not need to send WebSocket messages to PartyKit; instead, it writes to `foroom_edits` and triggers a PostgreSQL trigger or realtime broadcast to update active PartyKit rooms.

## Conclusion
Updating the implementation plan to v1.2.0 with these architectural deep-dives will eliminate ambiguity during the coding phase and ensure the complex intersections (Map vs 3D, Supabase vs PartyKit, DEM vs Extrusion) are handled systematically.
