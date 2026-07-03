export interface UserAccount {
  id: string;
  email: string;
  passwordHash?: string;
  passwordSalt?: string;
  canCreateForoom: boolean;
  createdAt: number;
  nick?: string;
  avatarColor?: string;
  avatarNodes?: number;
}

export interface AccessRequest {
  id: string;
  email: string;
  description: string;
  status: "pending" | "approved" | "rejected";
  createdAt: number;
  nick?: string;
  avatarColor?: string;
  avatarNodes?: number;
}

export interface ActiveForoom {
  id: string;
  name: string;
  bbox: [number, number, number, number];
  creatorEmail: string;
  createdAt: number;
}

export type AuthMessage = 
  | { type: "add_account", payload: { email: string; canCreateForoom: boolean; adminPin: string; nick?: string; avatarColor?: string; avatarNodes?: number } }
  | { type: "remove_account", payload: { id: string; adminPin: string } }
  | { type: "verify_login", payload: { email: string; passwordHash: string } }
  | { type: "google_login", payload: { credential: string } }
  | { type: "fetch_accounts", payload: { adminPin: string } }
  | { type: "request_access", payload: { email: string; description: string; nick: string; avatarColor: string; avatarNodes: number } }
  | { type: "create_foroom", payload: { name: string; bbox: [number, number, number, number]; creatorEmail: string; token?: string } }
  | { type: "approve_request", payload: { requestId: string; adminPin: string } }
  | { type: "reject_request", payload: { requestId: string; adminPin: string } }
  | { type: "delete_request", payload: { requestId: string; adminPin: string } }
  | { type: "toggle_create_access", payload: { accountId: string; canCreateForoom: boolean; adminPin: string } };

export type AuthResponse = 
  | { type: "login_success", payload: { account: Omit<UserAccount, "passwordHash" | "passwordSalt">; token: string } }
  | { type: "login_failed", payload: string }
  | { type: "all_accounts", payload: UserAccount[] }
  | { type: "all_forooms", payload: ActiveForoom[] }
  | { type: "all_requests", payload: AccessRequest[] }
  | { type: "request_submitted", payload: string }
  | { type: "request_approved_success", payload: { email: string; password: string } }
  | { type: "admin_token", payload: { token: string } }
  | { type: "error", payload: string };

export interface PlayerState {
  id: string;
  role: string;
  email: string;
  nick: string;
  avatarColor: string;
  avatarNodes: number;
  x: number;
  y: number;
  z: number;
}
