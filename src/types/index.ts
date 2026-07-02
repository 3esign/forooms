// Shared types for Frontend, Backend, and PartyKit

export type Layer = "council" | "playground" | "simulation";

export interface AuthUser {
  id: string;
  email: string;
  role: "citizen" | "participant" | "builder" | "admin";
}

export interface PlayerPosition {
  id: string;
  x: number;
  y: number;
  z: number;
  ry: number; // yaw rotation
}

export interface VoxelEdit {
  uuid: string;
  layer: Layer;
  userId: string;
  action: "place" | "remove";
  x: number;
  y: number;
  z: number;
  blockId: number;
  timestamp: number;
}

export type WebSocketMessage = 
  | { type: "player_move"; payload: PlayerPosition }
  | { type: "player_join"; payload: AuthUser }
  | { type: "player_leave"; payload: { id: string } }
  | { type: "voxel_edit"; payload: VoxelEdit }
  | { type: "sync_state"; payload: { players: PlayerPosition[]; recentEdits: VoxelEdit[] } };
