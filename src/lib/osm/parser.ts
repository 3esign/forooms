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

export function parseHeightLevels(tags: Record<string, string>): number {
  const levels = parseInt(tags["building:levels"], 10);
  if (!Number.isNaN(levels) && levels > 0) return levels;

  const raw = tags["building:height"];
  if (raw) {
    const meters = parseFloat(raw.replace(/m$/i, "").trim());
    if (!Number.isNaN(meters) && meters > 0) {
      return Math.max(1, Math.round(meters / 3));
    }
  }

  return 3;
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
        heightLevels: parseHeightLevels(tags),
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
