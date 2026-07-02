import type * as Party from "partykit/server";

export interface AccessRequest {
  id: string;
  name: string;
  status: "pending" | "approved" | "rejected";
  createdAt: number;
}

export type AuthMessage = 
  | { type: "request_access", payload: { name: string } }
  | { type: "approve_access", payload: { id: string, adminPin: string } }
  | { type: "reject_access", payload: { id: string, adminPin: string } }
  | { type: "check_status", payload: { id: string } };

export type AuthResponse = 
  | { type: "access_status", payload: AccessRequest }
  | { type: "all_requests", payload: AccessRequest[] }
  | { type: "error", payload: string };

export default class AuthServer implements Party.Server {
  private requests = new Map<string, AccessRequest>();
  private adminConnections = new Set<Party.Connection>();
  
  constructor(readonly room: Party.Room) {}

  async onStart() {
    // Load persisted requests from storage
    const stored = await this.room.storage.get<Record<string, AccessRequest>>("requests");
    if (stored) {
      for (const [id, req] of Object.entries(stored)) {
        this.requests.set(id, req);
      }
    }
  }

  async persist() {
    const data = Object.fromEntries(this.requests);
    await this.room.storage.put("requests", data);
  }

  onConnect(conn: Party.Connection, ctx: Party.ConnectionContext) {
    const url = new URL(ctx.request.url);
    if (url.searchParams.get("adminPin") === process.env.ADMIN_PIN) {
      this.adminConnections.add(conn);
      conn.send(JSON.stringify({
        type: "all_requests",
        payload: Array.from(this.requests.values())
      }));
    }
  }

  onClose(conn: Party.Connection) {
    this.adminConnections.delete(conn);
  }

  async onMessage(message: string, sender: Party.Connection) {
    const msg = JSON.parse(message) as AuthMessage;

    if (msg.type === "request_access") {
      const id = crypto.randomUUID();
      const req: AccessRequest = {
        id,
        name: msg.payload.name,
        status: "pending",
        createdAt: Date.now()
      };
      this.requests.set(id, req);
      await this.persist();

      // Reply to user
      sender.send(JSON.stringify({ type: "access_status", payload: req }));

      // Notify admins
      this.broadcastAdmins();
    } 
    else if (msg.type === "check_status") {
      const req = this.requests.get(msg.payload.id);
      if (req) {
        sender.send(JSON.stringify({ type: "access_status", payload: req }));
      } else {
        sender.send(JSON.stringify({ type: "error", payload: "Not found" }));
      }
    }
    else if (msg.type === "approve_access" || msg.type === "reject_access") {
      if (msg.payload.adminPin !== process.env.ADMIN_PIN) {
        sender.send(JSON.stringify({ type: "error", payload: "Unauthorized" }));
        return;
      }
      
      const req = this.requests.get(msg.payload.id);
      if (req) {
        req.status = msg.type === "approve_access" ? "approved" : "rejected";
        this.requests.set(req.id, req);
        await this.persist();
        
        this.broadcastAdmins();
        
        // We broadcast to the whole room so the pending user gets it immediately
        this.room.broadcast(JSON.stringify({ type: "access_status", payload: req }));
      }
    }
  }

  broadcastAdmins() {
    const payload = JSON.stringify({
      type: "all_requests",
      payload: Array.from(this.requests.values())
    });
    for (const conn of this.adminConnections) {
      conn.send(payload);
    }
  }
}
