export interface LatLng {
  lat: number;
  lng: number;
}

export interface Building {
  id: string;
  coordinates: LatLng[];
  heightLevels: number;
  type: string;
}

export interface Road {
  id: string;
  coordinates: LatLng[];
  type: string;
}

export interface Waterway {
  id: string;
  coordinates: LatLng[];
  type: string;
}

export interface Park {
  id: string;
  coordinates: LatLng[];
  type: string;
}

// ── NEW TIER 1 INTERFACES ──
export interface Railway {
  id: string;
  coordinates: LatLng[];
  type: string;
  isStation: boolean;
}

export interface PedestrianPath {
  id: string;
  coordinates: LatLng[];
  type: string;
}

export interface ParkingArea {
  id: string;
  coordinates: LatLng[];
}

export interface Barrier {
  id: string;
  coordinates: LatLng[];
  type: string;
}

export interface LanduseZone {
  id: string;
  coordinates: LatLng[];
  type: string;
}

export interface TreeRow {
  id: string;
  coordinates: LatLng[];
}

export interface Beach {
  id: string;
  coordinates: LatLng[];
}

export interface Scrub {
  id: string;
  coordinates: LatLng[];
}

export interface OSMDataResult {
  buildings: Building[];
  roads: Road[];
  waterways: Waterway[];
  parks: Park[];
  railways: Railway[];
  paths: PedestrianPath[];
  parking: ParkingArea[];
  barriers: Barrier[];
  landuse: LanduseZone[];
  treeRows: TreeRow[];
  beaches: Beach[];
  scrub: Scrub[];
}

export interface OverpassElement {
  type: string;
  id: number;
  tags?: Record<string, string>;
  geometry?: { lat: number; lon: number }[];
}

/** Bbox convention: [west, south, east, north] in degrees. */
export type Bbox = [number, number, number, number];
