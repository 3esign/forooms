import {
  OSMDataResult,
  OverpassElement,
  Building,
  Road,
  Waterway,
  Park,
  Railway,
  PedestrianPath,
  ParkingArea,
  Barrier,
  LanduseZone,
  TreeRow,
  Beach,
  Scrub,
  LatLng,
  Bbox,
} from "./types";
import { normalizeBbox } from "./query";

// Simple hash for deterministic variation based on building ID
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

export function parseHeightLevels(tags: Record<string, string>, type: string, id: string, coordinates: LatLng[]): number {
  const floorHeight = 3.0;
  let levels = -1;

  // Tier 1: Direct OSM Tags
  if (tags["building:levels"]) {
    const parsed = parseInt(tags["building:levels"], 10);
    if (!Number.isNaN(parsed) && parsed > 0) levels = parsed;
  }
  if (levels === -1 && tags["building:height"]) {
    const raw = tags["building:height"];
    const meters = parseFloat(raw.replace(/m$/i, "").trim());
    if (!Number.isNaN(meters) && meters > 0) levels = Math.max(1, Math.round(meters / floorHeight));
  }
  if (levels === -1 && tags["height"]) {
    const raw = tags["height"];
    const meters = parseFloat(raw.replace(/m$/i, "").trim());
    if (!Number.isNaN(meters) && meters > 0) levels = Math.max(1, Math.round(meters / floorHeight));
  }

  // Add roof levels if present
  if (levels !== -1 && tags["roof:levels"]) {
    const parsedRoof = parseInt(tags["roof:levels"], 10);
    if (!Number.isNaN(parsedRoof) && parsedRoof > 0) levels += parsedRoof;
  }

  // Tier 2: Type-based defaults
  if (levels === -1) {
    const lType = type.toLowerCase();
    if (lType === "garage" || lType === "shed" || lType === "cabin" || lType === "kiosk") levels = 1;
    else if (lType === "house" || lType === "detached" || lType === "residential") levels = 2;
    else if (lType === "terrace" || lType === "row_house") levels = 3;
    else if (lType === "church" || lType === "cathedral") levels = 6;
    else if (lType === "apartments" || lType === "commercial" || lType === "office") levels = 5;
    else if (lType === "industrial" || lType === "warehouse") levels = 3;
    else if (lType === "skyscraper" || lType === "tower") levels = 15;
  }

  // Tier 3: Footprint Area Heuristic (if still -1)
  if (levels === -1 && coordinates.length >= 3) {
    // Very rough area estimation in degrees squared, converted to approx m^2
    // 1 deg lat ~ 111,000m. 1 deg lng ~ 111,000m * cos(lat)
    let areaDeg = 0;
    for (let i = 0; i < coordinates.length; i++) {
      const p1 = coordinates[i];
      const p2 = coordinates[(i + 1) % coordinates.length];
      areaDeg += (p1.lng * p2.lat) - (p2.lng * p1.lat);
    }
    areaDeg = Math.abs(areaDeg / 2);
    
    // Convert to approx square meters
    const avgLat = coordinates[0].lat;
    const mPerDegLat = 111320;
    const mPerDegLng = 40075000 * Math.cos(avgLat * Math.PI / 180) / 360;
    const areaSqMeters = areaDeg * mPerDegLat * mPerDegLng;
    
    // Estimate levels based on area
    levels = Math.max(2, Math.round(Math.sqrt(areaSqMeters) / 6));
    levels = Math.min(levels, 8); // Cap area-based heuristic at 8 levels
  }

  if (levels === -1) levels = 3; // Final fallback

  // Tier 4: Seeded micro-variation (-1, 0, or 1)
  const hash = hashString(id);
  const variation = (Math.abs(hash) % 3) - 1; 
  levels = Math.max(1, levels + variation);

  return levels;
}

export function parseOverpassElements(elements: OverpassElement[]): OSMDataResult {
  const buildings: Building[] = [];
  const roads: Road[] = [];
  const waterways: Waterway[] = [];
  const parks: Park[] = [];
  const railways: Railway[] = [];
  const paths: PedestrianPath[] = [];
  const parking: ParkingArea[] = [];
  const barriers: Barrier[] = [];
  const landuse: LanduseZone[] = [];
  const treeRows: TreeRow[] = [];
  const beaches: Beach[] = [];
  const scrub: Scrub[] = [];

  for (const element of elements) {
    if (!element.geometry || element.geometry.length < 2) {
      continue;
    }

    const coordinates: LatLng[] = element.geometry.map((point) => ({
      lat: point.lat,
      lng: point.lon,
    }));

    const tags = element.tags || {};
    const id = element.id.toString();

    if (tags.building) {
      if (coordinates.length < 3) continue;
      buildings.push({
        id,
        coordinates,
        heightLevels: parseHeightLevels(tags, tags.building, id, coordinates),
        type: tags.building,
      });
    } else if (tags.highway) {
      const type = tags.highway;
      if (
        ["pedestrian", "footway", "cycleway", "path", "steps"].includes(type)
      ) {
        paths.push({ id, coordinates, type });
      } else if (type === "service") {
        roads.push({ id, coordinates, type });
      } else {
        roads.push({ id, coordinates, type });
      }
    } else if (tags.railway) {
      const isStation = tags.railway === "station" || tags.railway === "halt";
      railways.push({ id, coordinates, type: tags.railway, isStation });
    } else if (tags.waterway || tags.natural === "water") {
      waterways.push({ id, coordinates, type: tags.waterway || tags.natural });
    } else if (tags.natural === "beach") {
      beaches.push({ id, coordinates });
    } else if (tags.natural === "scrub") {
      scrub.push({ id, coordinates });
    } else if (tags.natural === "tree_row") {
      treeRows.push({ id, coordinates });
    } else if (
      tags.leisure === "park" ||
      tags.leisure === "playground" ||
      tags.leisure === "pitch" ||
      tags.leisure === "garden" ||
      tags.landuse === "grass" ||
      tags.landuse === "forest"
    ) {
      parks.push({ id, coordinates, type: tags.leisure || tags.landuse || "park" });
    } else if (tags.amenity === "parking") {
      parking.push({ id, coordinates });
    } else if (tags.barrier) {
      barriers.push({ id, coordinates, type: tags.barrier });
    } else if (tags.landuse) {
      const type = tags.landuse;
      if (["residential", "commercial", "industrial", "retail", "cemetery"].includes(type)) {
        landuse.push({ id, coordinates, type });
      }
    }
  }

  return {
    buildings,
    roads,
    waterways,
    parks,
    railways,
    paths,
    parking,
    barriers,
    landuse,
    treeRows,
    beaches,
    scrub,
  };
}

/**
 * Generates mock building footprints and intersecting roads centered in the bounding box as a robust fallback.
 */
export function generateMockData(bbox: Bbox): OSMDataResult {
  const [w, s, e, n] = normalizeBbox(bbox);
  const buildings: Building[] = [];
  const roads: Road[] = [];

  const cLat = (s + n) / 2;
  const cLng = (w + e) / 2;

  const offsets = [
    [-0.001, -0.001],
    [0, -0.001],
    [0.001, -0.001],
    [-0.001, 0],
    [0.001, 0],
    [-0.001, 0.001],
    [0, 0.001],
    [0.001, 0.001],
  ];

  offsets.forEach((offset, idx) => {
    const bLat = cLat + offset[1];
    const bLng = cLng + offset[0];

    const sizeLng = 0.0002;
    const sizeLat = 0.00015;
    const coords = [
      { lat: bLat - sizeLat, lng: bLng - sizeLng },
      { lat: bLat + sizeLat, lng: bLng - sizeLng },
      { lat: bLat + sizeLat, lng: bLng + sizeLng },
      { lat: bLat - sizeLat, lng: bLng + sizeLng },
    ];

    buildings.push({
      id: `mock-building-${idx}`,
      coordinates: coords,
      heightLevels: 2 + (idx % 3) * 2, // 2, 4, 6 floors
      type: "apartments",
    });
  });

  roads.push({
    id: "mock-road-main",
    coordinates: [
      { lat: s, lng: cLng },
      { lat: n, lng: cLng },
    ],
    type: "primary",
  });

  roads.push({
    id: "mock-road-cross",
    coordinates: [
      { lat: cLat, lng: w },
      { lat: cLat, lng: e },
    ],
    type: "secondary",
  });

  const railways: Railway[] = [
    {
      id: "mock-railway",
      coordinates: [
        { lat: s + 0.0005, lng: w + 0.0005 },
        { lat: n - 0.0005, lng: e - 0.0005 },
      ],
      type: "rail",
      isStation: false,
    },
  ];

  const paths: PedestrianPath[] = [
    {
      id: "mock-path",
      coordinates: [
        { lat: s + 0.001, lng: cLng + 0.0005 },
        { lat: n - 0.001, lng: cLng + 0.0005 },
      ],
      type: "footway",
    },
  ];

  return {
    buildings,
    roads,
    waterways: [],
    parks: [],
    railways,
    paths,
    parking: [],
    barriers: [],
    landuse: [],
    treeRows: [],
    beaches: [],
    scrub: [],
  };
}

export function parseOSMXml(xmlText: string): OSMDataResult {
  const elements: OverpassElement[] = [];

  // 1. Parse nodes
  const nodes = new Map<string, LatLng>();
  const nodeRegex = /<node\s+([^>]+)>/g;
  let match: RegExpExecArray | null;
  while ((match = nodeRegex.exec(xmlText)) !== null) {
    const attrsStr = match[1];
    const idMatch = attrsStr.match(/\bid="([^"]+)"/);
    const latMatch = attrsStr.match(/\blat="([^"]+)"/);
    const lonMatch = attrsStr.match(/\blon="([^"]+)"/);
    if (idMatch && latMatch && lonMatch) {
      nodes.set(idMatch[1], {
        lat: parseFloat(latMatch[1]),
        lng: parseFloat(lonMatch[1]),
      });
    }
  }

  // 2. Parse ways
  const wayRegex = /<way[\s\S]*?<\/way>/g;
  const ways = xmlText.match(wayRegex) || [];

  for (const wayMarkup of ways) {
    const idMatch = wayMarkup.match(/\bid="([^"]+)"/);
    if (!idMatch) continue;
    const wayId = idMatch[1];

    // Get refs
    const ndRegex = /<nd[^>]*\bref="([^"]+)"/g;
    const coordinates: LatLng[] = [];
    let ndMatch: RegExpExecArray | null;
    while ((ndMatch = ndRegex.exec(wayMarkup)) !== null) {
      const node = nodes.get(ndMatch[1]);
      if (node) coordinates.push(node);
    }

    if (coordinates.length < 2) continue;

    // Get tags
    const tagRegex = /<tag[^>]*\bk="([^"]+)"[^>]*\bv="([^"]+)"/g;
    const tags: Record<string, string> = {};
    let tagMatch: RegExpExecArray | null;
    while ((tagMatch = tagRegex.exec(wayMarkup)) !== null) {
      tags[tagMatch[1]] = tagMatch[2];
    }

    elements.push({
      id: parseInt(wayId, 10),
      type: "way",
      geometry: coordinates.map(c => ({ lat: c.lat, lon: c.lng })),
      tags,
    });
  }

  return parseOverpassElements(elements);
}
