import { OSMDataResult, OverpassElement, Bbox, LatLng } from "./types";
import { normalizeBbox, OVERPASS_ENDPOINTS, OVERPASS_USER_AGENT, buildOverpassQuery } from "./query";
import { parseOverpassElements, parseOSMXml, generateMockData } from "./parser";

export async function fetchOverpass(query: string, globalSignal: AbortSignal): Promise<OverpassElement[]> {
  let lastError: unknown;

  for (const endpoint of OVERPASS_ENDPOINTS) {
    // 8-second timeout per endpoint to ensure we failover quickly
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    
    const onGlobalAbort = () => controller.abort();
    globalSignal.addEventListener("abort", onGlobalAbort);

    try {
      console.log(`Querying Overpass endpoint: ${endpoint}`);
      const response = await fetch(endpoint, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
          "User-Agent": OVERPASS_USER_AGENT,
        },
        body: `data=${encodeURIComponent(query)}`,
      });

      const text = await response.text();
      let data: { elements?: OverpassElement[]; remark?: string };
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(`Overpass returned non-JSON (${response.status})`);
      }

      if (!response.ok) {
        throw new Error(data.remark || `Overpass HTTP ${response.status}`);
      }

      if (data.remark && !data.elements?.length) {
        throw new Error(data.remark);
      }

      return data.elements ?? [];
    } catch (error) {
      lastError = error;
      console.warn(`Overpass endpoint failed (${endpoint}):`, error);
    } finally {
      clearTimeout(timeoutId);
      globalSignal.removeEventListener("abort", onGlobalAbort);
    }
  }

  throw lastError ?? new Error("All Overpass endpoints failed");
}

export async function queryOverpassApi(bbox: Bbox): Promise<OSMDataResult> {
  const [w, s, e, n] = normalizeBbox(bbox);

  // 1. Try official OSM API first (for reasonably small selections)
  try {
    const dLng = Math.abs(e - w);
    const dLat = Math.abs(n - s);
    
    if (dLng <= 0.015 && dLat <= 0.015) {
      console.log(`Querying official OSM API: bbox=${w},${s},${e},${n}`);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
      
      const url = `https://api.openstreetmap.org/api/0.6/map?bbox=${w},${s},${e},${n}`;
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent": OVERPASS_USER_AGENT,
        }
      });
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const text = await response.text();
        const data = parseOSMXml(text);
        if (data.buildings.length > 0) {
          console.log(`Official OSM API succeeded. Found ${data.buildings.length} buildings.`);
          return data;
        }
      }
      console.warn(`Official OSM API returned non-ok status or empty buildings: ${response.status}`);
    } else {
      console.log(`Selection too large for official OSM API (diff > 0.015). Skipping to Overpass.`);
    }
  } catch (error) {
    console.warn("Official OSM API failed, falling back to Overpass API mirrors:", error);
  }

  // 2. Fallback to Overpass mirrors
  const query = buildOverpassQuery(bbox);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 28_000); // 28s global timeout to fit 3x8s

  try {
    const elements = await fetchOverpass(query, controller.signal);
    return parseOverpassElements(elements);
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchOSMData(bbox: Bbox): Promise<OSMDataResult> {
  const [w, s, e, n] = normalizeBbox(bbox);
  
  try {
    const response = await fetch(`/api/osm?w=${w}&s=${s}&e=${e}&n=${n}`, {
      signal: AbortSignal.timeout(30_000), // 30s frontend timeout
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error || `Failed to load OSM data (HTTP ${response.status})`);
    }

    const data: OSMDataResult = await response.json();
    if (data.buildings.length === 0) {
      if (process.env.NODE_ENV === "development" && process.env.NEXT_PUBLIC_ALLOW_MOCK === "true") {
        console.warn("No buildings found in OSM response, falling back to mock data.");
        return generateMockData(bbox);
      }
      throw new Error("No buildings found in selected area. Try a denser urban region.");
    }

    return data;
  } catch (error) {
    if (process.env.NODE_ENV === "development" && process.env.NEXT_PUBLIC_ALLOW_MOCK === "true") {
      console.warn("OSM API call failed, generating mock data fallback:", error);
      return generateMockData(bbox);
    }
    throw error;
  }
}

/**
 * Projects lat/lng to grid coords [x, z] centered on origin.
 * +X = east, +Z = south (Three.js convention).
 */
export function projectLatLngToGrid(
  coord: LatLng,
  origin: LatLng,
  voxelSize: number = 2
): [number, number] {
  const R = 6371000;
  const xMeters =
    R * (coord.lng - origin.lng) * Math.cos((origin.lat * Math.PI) / 180) * (Math.PI / 180);
  const zMeters = -R * (coord.lat - origin.lat) * (Math.PI / 180);

  return [xMeters / voxelSize, zMeters / voxelSize];
}

/**
 * Calculates the exact grid width and depth needed to cover a bounding box.
 */
export function getGridDimensionsFromBbox(bbox: Bbox, voxelSize: number = 2): { width: number, depth: number } {
  const [w, s, e, n] = normalizeBbox(bbox);
  const centerLat = (s + n) / 2;
  const centerLng = (w + e) / 2;
  const origin = { lat: centerLat, lng: centerLng };

  // Project North-East corner to find maximum extents
  const [maxX, minZ] = projectLatLngToGrid({ lat: n, lng: e }, origin, voxelSize);
  
  // Width is 2 * maxX. Depth is 2 * Math.abs(minZ). Add padding to prevent clipping.
  const width = Math.ceil(maxX * 2) + 20;
  const depth = Math.ceil(Math.abs(minZ) * 2) + 20;

  return { width, depth };
}
