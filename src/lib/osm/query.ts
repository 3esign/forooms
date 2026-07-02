import { Bbox } from "./types";

export const ROAD_TYPES =
  "motorway|trunk|primary|secondary|tertiary|residential|unclassified|living_street";

export const PATH_TYPES = "pedestrian|footway|cycleway|path|service|steps";

export const RAILWAY_TYPES = "rail|light_rail|tram|subway";

export const BARRIER_TYPES = "wall|fence|city_wall|hedge";

export const LANDUSE_TYPES = "residential|commercial|industrial|retail|cemetery";

export const OVERPASS_ENDPOINTS = [
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass.nchc.org.tw/api/interpreter",
  "https://lz4.overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass-api.de/api/interpreter",
];

export const OVERPASS_USER_AGENT = "FOROOMS/0.1 (+https://github.com/forooms; urban voxel twin)";

/**
 * Ensures west < east and south < north regardless of drag direction.
 */
export function normalizeBbox(bbox: Bbox): Bbox {
  const [w, s, e, n] = bbox;
  return [Math.min(w, e), Math.min(s, n), Math.max(w, e), Math.max(s, n)];
}

export function buildOverpassQuery(bbox: Bbox): string {
  const [w, s, e, n] = normalizeBbox(bbox);
  return `[out:json][timeout:15];
(
  way["building"](${s},${w},${n},${e});
  way["highway"~"^(${ROAD_TYPES})$"](${s},${w},${n},${e});
  way["highway"~"^(${PATH_TYPES})$"](${s},${w},${n},${e});
  way["railway"~"^(${RAILWAY_TYPES})$"](${s},${w},${n},${e});
  node["railway"~"^(station|halt)$"](${s},${w},${n},${e});
  way["waterway"](${s},${w},${n},${e});
  way["natural"="water"](${s},${w},${n},${e});
  way["natural"="beach"](${s},${w},${n},${e});
  way["natural"="scrub"](${s},${w},${n},${e});
  way["leisure"~"^(park|playground|pitch|garden)$"](${s},${w},${n},${e});
  way["landuse"~"^(grass|forest|${LANDUSE_TYPES})$"](${s},${w},${n},${e});
  way["amenity"="parking"](${s},${w},${n},${e});
  way["barrier"~"^(${BARRIER_TYPES})$"](${s},${w},${n},${e});
  way["natural"="tree_row"](${s},${w},${n},${e});
);
out tags geom;`;
}
