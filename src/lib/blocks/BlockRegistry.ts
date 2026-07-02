export enum BlockId {
  Air = 0,
  Concrete = 1,
  Grass = 2,
  Asphalt = 3,
  Wood = 4,
  Leaves = 5,
  Editable = 6,
  Water = 7,
  Sidewalk = 8,
  ParkGrass = 9,
  Pitch = 10,
  // ── New Tier 1 ──
  Railway = 11,
  Platform = 12,
  Parking = 13,
  Wall = 14,
  Footpath = 15,
  ServiceRoad = 16,
  // ── Zone overlays ──
  ZoneResidential = 17,
  ZoneCommercial = 18,
  ZoneIndustrial = 19,
  ZoneRetail = 20,
  // ── Tier 2 ──
  Sand = 21,
  Scrub = 22,
  Cemetery = 23,
  PowerTower = 24,
}

export interface BlockDef {
  id: BlockId;
  name: string;
  textureType: string;
  baseColor: string; // Hex for fallback
  noiseColors: string[]; // Pixel noise variation
  borderColor: string;
  castsShadow: boolean;
  isGround: boolean; // Rendered at y=0
}

export const BLOCK_REGISTRY: Map<BlockId, BlockDef> = new Map([
  [
    BlockId.Concrete,
    {
      id: BlockId.Concrete,
      name: "Concrete",
      textureType: "concrete",
      baseColor: "#c9c2b9",
      noiseColors: ["#a8a299", "#e6ded3"],
      borderColor: "#8c867e",
      castsShadow: true,
      isGround: false,
    },
  ],
  [
    BlockId.Grass,
    {
      id: BlockId.Grass,
      name: "Grass",
      textureType: "grass",
      baseColor: "#659c44",
      noiseColors: ["#528234", "#77b252"],
      borderColor: "#43702a",
      castsShadow: false,
      isGround: true,
    },
  ],
  [
    BlockId.Asphalt,
    {
      id: BlockId.Asphalt,
      name: "Asphalt Road",
      textureType: "stone",
      baseColor: "#2c2d30",
      noiseColors: ["#1a1b1d", "#3e4045"],
      borderColor: "#141416",
      castsShadow: false,
      isGround: true,
    },
  ],
  [
    BlockId.Wood,
    {
      id: BlockId.Wood,
      name: "Wood Trunk",
      textureType: "wood",
      baseColor: "#7d593c",
      noiseColors: ["#523722"],
      borderColor: "#382415",
      castsShadow: true,
      isGround: false,
    },
  ],
  [
    BlockId.Leaves,
    {
      id: BlockId.Leaves,
      name: "Leaves",
      textureType: "leaves",
      baseColor: "#2f751c",
      noiseColors: ["#1a470e", "#459e2b"],
      borderColor: "#15380b",
      castsShadow: true,
      isGround: false,
    },
  ],
  [
    BlockId.Editable,
    {
      id: BlockId.Editable,
      name: "Council Editable",
      textureType: "editable",
      baseColor: "#4ade80",
      noiseColors: ["#22c55e", "#86efac"],
      borderColor: "#15803d",
      castsShadow: false,
      isGround: true,
    },
  ],
  [
    BlockId.Water,
    {
      id: BlockId.Water,
      name: "Water",
      textureType: "water",
      baseColor: "#1d4ed8",
      noiseColors: ["#1e40af", "#3b82f6"],
      borderColor: "#172554",
      castsShadow: false,
      isGround: true,
    },
  ],
  [
    BlockId.Sidewalk,
    {
      id: BlockId.Sidewalk,
      name: "Sidewalk",
      textureType: "sidewalk",
      baseColor: "#a3a3a3",
      noiseColors: ["#737373", "#d4d4d4"],
      borderColor: "#525252",
      castsShadow: false,
      isGround: true,
    },
  ],
  [
    BlockId.ParkGrass,
    {
      id: BlockId.ParkGrass,
      name: "Park Grass",
      textureType: "park_grass",
      baseColor: "#3f6d22",
      noiseColors: ["#2a4e12", "#548e35"],
      borderColor: "#20390a",
      castsShadow: false,
      isGround: true,
    },
  ],
  [
    BlockId.Pitch,
    {
      id: BlockId.Pitch,
      name: "Sports Pitch",
      textureType: "pitch",
      baseColor: "#b45309",
      noiseColors: ["#92400e", "#d97706"],
      borderColor: "#78350f",
      castsShadow: false,
      isGround: true,
    },
  ],
  [
    BlockId.Railway,
    {
      id: BlockId.Railway,
      name: "Railway",
      textureType: "railway",
      baseColor: "#4a4a50",
      noiseColors: ["#333338", "#5c5c63"],
      borderColor: "#2a2a2e",
      castsShadow: false,
      isGround: true,
    },
  ],
  [
    BlockId.Platform,
    {
      id: BlockId.Platform,
      name: "Platform",
      textureType: "platform",
      baseColor: "#b0a89e",
      noiseColors: ["#9a9288", "#c5bdb3"],
      borderColor: "#857d73",
      castsShadow: true,
      isGround: false,
    },
  ],
  [
    BlockId.Parking,
    {
      id: BlockId.Parking,
      name: "Parking",
      textureType: "parking",
      baseColor: "#3a3a3e",
      noiseColors: ["#2e2e32", "#4a4a50"],
      borderColor: "#222225",
      castsShadow: false,
      isGround: true,
    },
  ],
  [
    BlockId.Wall,
    {
      id: BlockId.Wall,
      name: "Wall",
      textureType: "wall",
      baseColor: "#8b7355",
      noiseColors: ["#6b5a42", "#a88c68"],
      borderColor: "#5a4a35",
      castsShadow: true,
      isGround: false,
    },
  ],
  [
    BlockId.Footpath,
    {
      id: BlockId.Footpath,
      name: "Footpath",
      textureType: "footpath",
      baseColor: "#c4a882",
      noiseColors: ["#b09470", "#d4bc98"],
      borderColor: "#9a8060",
      castsShadow: false,
      isGround: true,
    },
  ],
  [
    BlockId.ServiceRoad,
    {
      id: BlockId.ServiceRoad,
      name: "Service Road",
      textureType: "service_road",
      baseColor: "#8c8d91",
      noiseColors: ["#76777a", "#9fa0a3"],
      borderColor: "#606163",
      castsShadow: false,
      isGround: true,
    },
  ],
  [
    BlockId.ZoneResidential,
    {
      id: BlockId.ZoneResidential,
      name: "Zone Residential",
      textureType: "zone_residential",
      baseColor: "#6f9e52", // slight tint on grass
      noiseColors: ["#5d8544", "#84b863"],
      borderColor: "#4a6e35",
      castsShadow: false,
      isGround: true,
    },
  ],
  [
    BlockId.ZoneCommercial,
    {
      id: BlockId.ZoneCommercial,
      name: "Zone Commercial",
      textureType: "zone_commercial",
      baseColor: "#759c5d",
      noiseColors: ["#61824d", "#8bb86f"],
      borderColor: "#4e6b3c",
      castsShadow: false,
      isGround: true,
    },
  ],
  [
    BlockId.ZoneIndustrial,
    {
      id: BlockId.ZoneIndustrial,
      name: "Zone Industrial",
      textureType: "zone_industrial",
      baseColor: "#79966d",
      noiseColors: ["#647d5a", "#90b082"],
      borderColor: "#516648",
      castsShadow: false,
      isGround: true,
    },
  ],
  [
    BlockId.ZoneRetail,
    {
      id: BlockId.ZoneRetail,
      name: "Zone Retail",
      textureType: "zone_retail",
      baseColor: "#7b9c5c",
      noiseColors: ["#66824c", "#94b870"],
      borderColor: "#516b3c",
      castsShadow: false,
      isGround: true,
    },
  ],
  [
    BlockId.Sand,
    {
      id: BlockId.Sand,
      name: "Sand",
      textureType: "sand",
      baseColor: "#d4b896",
      noiseColors: ["#c4a882", "#e4ccae"],
      borderColor: "#b09470",
      castsShadow: false,
      isGround: true,
    },
  ],
  [
    BlockId.Scrub,
    {
      id: BlockId.Scrub,
      name: "Scrub",
      textureType: "scrub",
      baseColor: "#6b7a3a",
      noiseColors: ["#556230", "#829048"],
      borderColor: "#445020",
      castsShadow: false,
      isGround: true,
    },
  ],
  [
    BlockId.Cemetery,
    {
      id: BlockId.Cemetery,
      name: "Cemetery",
      textureType: "cemetery",
      baseColor: "#466934",
      noiseColors: ["#385429", "#588241"],
      borderColor: "#29401e",
      castsShadow: false,
      isGround: true,
    },
  ],
]);

export function getBlockDef(id: BlockId): BlockDef | undefined {
  return BLOCK_REGISTRY.get(id);
}
