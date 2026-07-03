import type * as Party from "partykit/server";

export interface UserAccount {
  id: string;
  email: string;
  passwordHash?: string;
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
  | { type: "fetch_accounts", payload: { adminPin: string } }
  | { type: "request_access", payload: { email: string; description: string; nick: string; avatarColor: string; avatarNodes: number } }
  | { type: "create_foroom", payload: { name: string; bbox: [number, number, number, number]; creatorEmail: string; token?: string } }
  | { type: "approve_request", payload: { requestId: string; adminPin: string } }
  | { type: "reject_request", payload: { requestId: string; adminPin: string } }
  | { type: "delete_request", payload: { requestId: string; adminPin: string } }
  | { type: "toggle_create_access", payload: { accountId: string; canCreateForoom: boolean; adminPin: string } };

export type AuthResponse = 
  | { type: "login_success", payload: { account: Omit<UserAccount, "passwordHash">; token: string } }
  | { type: "login_failed", payload: string }
  | { type: "all_accounts", payload: UserAccount[] }
  | { type: "all_forooms", payload: ActiveForoom[] }
  | { type: "all_requests", payload: AccessRequest[] }
  | { type: "request_submitted", payload: string }
  | { type: "error", payload: string };

function generateRandomPassword() {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let pass = "";
  for(let i=0; i<8; i++) pass += chars.charAt(Math.floor(Math.random() * chars.length));
  return pass;
}

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export default class AuthServer implements Party.Server {
  private accounts = new Map<string, UserAccount>();
  private requests = new Map<string, AccessRequest>();
  private forooms = new Map<string, ActiveForoom>();
  private adminConnections = new Set<Party.Connection>();
  private tokens = new Map<string, { email: string, role: string, nick?: string, avatarColor?: string, avatarNodes?: number }>();
  
  constructor(readonly room: Party.Room) {}

  async onStart() {
    // Load accounts
    const storedAcc = await this.room.storage.get<Record<string, UserAccount>>("accounts");
    if (storedAcc) {
      for (const [id, acc] of Object.entries(storedAcc)) {
        this.accounts.set(id, acc);
      }
    }

    // Load requests
    const storedReq = await this.room.storage.get<Record<string, AccessRequest>>("requests_v2");
    if (storedReq) {
      for (const [id, req] of Object.entries(storedReq)) {
        this.requests.set(id, req);
      }
    }

    // Load forooms
    const storedForooms = await this.room.storage.get<Record<string, ActiveForoom>>("forooms");
    if (storedForooms) {
      for (const [id, f] of Object.entries(storedForooms)) {
        this.forooms.set(id, f);
      }
    }
  }

  async persistAccounts() {
    await this.room.storage.put("accounts", Object.fromEntries(this.accounts));
  }

  async persistRequests() {
    await this.room.storage.put("requests_v2", Object.fromEntries(this.requests));
  }

  async persistForooms() {
    await this.room.storage.put("forooms", Object.fromEntries(this.forooms));
  }

  onConnect(conn: Party.Connection, ctx: Party.ConnectionContext) {
    console.log(`[auth] New connection: ${conn.id}`);
    // Always send the list of active forooms to everyone who connects
    conn.send(JSON.stringify({
      type: "all_forooms",
      payload: Array.from(this.forooms.values())
    }));
  }

  async onRequest(req: Party.Request) {
    if (req.method === "GET") {
      const url = new URL(req.url, "http://internal");
      const token = url.searchParams.get("token");
      
      // Admin bypass
      if (token === process.env.ADMIN_PIN) {
        return new Response(JSON.stringify({ valid: true, email: "admin", role: "admin" }), { status: 200 });
      }

      if (token && this.tokens.has(token)) {
        const session = this.tokens.get(token);
        return new Response(JSON.stringify({ valid: true, ...session }), { status: 200 });
      }
      return new Response(JSON.stringify({ valid: false }), { status: 401 });
    }
    return new Response("Not found", { status: 404 });
  }

  onClose(conn: Party.Connection) {
    console.log(`[auth] Connection closed: ${conn.id}`);
    this.adminConnections.delete(conn);
  }

  async onMessage(message: string, sender: Party.Connection) {
    console.log(`[auth] Received message from ${sender.id}:`, message);
    const msg = JSON.parse(message) as AuthMessage;

    if (msg.type === "verify_login") {
      const { email, passwordHash: clientPassword } = msg.payload;

      // Server-side Admin PIN verify
      const adminPin = process.env.ADMIN_PIN;
      if (adminPin && clientPassword === adminPin) {
        const token = adminPin;
        sender.send(JSON.stringify({ 
          type: "login_success", 
          payload: { 
            account: { 
              id: "admin", 
              email: "admin@forooms.app", 
              canCreateForoom: true, 
              createdAt: Date.now(),
              nick: "Admin",
              avatarColor: "#ef4444",
              avatarNodes: 8
            }, 
            token 
          } 
        }));
        return;
      }
      
      const targetHash = await hashPassword(clientPassword);
      const account = Array.from(this.accounts.values()).find(a => a.email === email && a.passwordHash === targetHash);
      if (account) {
        const token = crypto.randomUUID();
        this.tokens.set(token, { 
          email: account.email, 
          role: account.canCreateForoom ? "builder" : "guest",
          nick: account.nick || account.email.split("@")[0],
          avatarColor: account.avatarColor || "#3b82f6",
          avatarNodes: account.avatarNodes || 4
        });
        
        // Remove passwordHash before sending to client
        const safeAccount = { ...account, passwordHash: undefined } as any;
        sender.send(JSON.stringify({ type: "login_success", payload: { account: safeAccount, token } }));
      } else {
        sender.send(JSON.stringify({ type: "login_failed", payload: "Invalid email or password" }));
      }
    }
    else if (msg.type === "request_access") {
      const id = crypto.randomUUID();
      const newReq: AccessRequest = {
        id,
        email: msg.payload.email,
        description: msg.payload.description,
        status: "pending",
        createdAt: Date.now(),
        nick: msg.payload.nick,
        avatarColor: msg.payload.avatarColor,
        avatarNodes: msg.payload.avatarNodes
      };
      this.requests.set(id, newReq);
      await this.persistRequests();
      sender.send(JSON.stringify({ type: "request_submitted", payload: "Access request submitted successfully!" }));
      this.broadcastAdmins();

      // Resend Notification
      if (process.env.RESEND_API_KEY) {
        try {
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              from: "FOROOMS Access <onboarding@resend.dev>",
              to: "poturaksemir@gmail.com",
              subject: `New Access Request from ${newReq.email}`,
              html: `<p><strong>Email:</strong> ${newReq.email}</p><p><strong>Description:</strong> ${newReq.description}</p><p><a href="https://forooms.vercel.app/admin">Approve/Reject in Admin Dashboard</a></p>`
            })
          });
        } catch (e) {
          console.error("Failed to send email", e);
        }
      }
    }
    else if (msg.type === "create_foroom") {
      const token = msg.payload.token;
      let isAuthorized = false;

      const adminPin = process.env.ADMIN_PIN;
      if (adminPin && token === adminPin) {
        isAuthorized = true;
      } else if (token && this.tokens.has(token)) {
        const session = this.tokens.get(token);
        if (session && (session.role === "admin" || session.role === "builder")) {
          isAuthorized = true;
        }
      }

      if (!isAuthorized) {
        sender.send(JSON.stringify({ type: "error", payload: "Unauthorized to create foroom" }));
        return;
      }

      const id = crypto.randomUUID();
      const newForoom: ActiveForoom = {
        id,
        name: msg.payload.name,
        bbox: msg.payload.bbox,
        creatorEmail: msg.payload.creatorEmail,
        createdAt: Date.now()
      };
      this.forooms.set(id, newForoom);
      await this.persistForooms();
      this.room.broadcast(JSON.stringify({
        type: "all_forooms",
        payload: Array.from(this.forooms.values())
      }));
    }
    else if (
      msg.type === "add_account" || 
      msg.type === "remove_account" || 
      msg.type === "fetch_accounts" ||
      msg.type === "approve_request" ||
      msg.type === "reject_request" ||
      msg.type === "delete_request" ||
      msg.type === "toggle_create_access"
    ) {
      const pin = process.env.ADMIN_PIN;
      if (!pin || msg.payload.adminPin !== pin) {
        sender.send(JSON.stringify({ type: "error", payload: "Unauthorized" }));
        return;
      }
      
      this.adminConnections.add(sender);
      
      if (msg.type === "add_account") {
        const id = crypto.randomUUID();
        const rawPass = generateRandomPassword();
        const acc: UserAccount = {
          id,
          email: msg.payload.email,
          passwordHash: await hashPassword(rawPass),
          canCreateForoom: msg.payload.canCreateForoom,
          createdAt: Date.now(),
          nick: msg.payload.nick || msg.payload.email.split("@")[0],
          avatarColor: msg.payload.avatarColor || "#3b82f6",
          avatarNodes: msg.payload.avatarNodes || 4
        };
        this.accounts.set(id, acc);
        await this.persistAccounts();
        this.broadcastAdmins();
      }
      else if (msg.type === "remove_account") {
        this.accounts.delete(msg.payload.id);
        await this.persistAccounts();
        this.broadcastAdmins();
      }
      else if (msg.type === "fetch_accounts") {
        // Strip passwords
        const safeAccounts = Array.from(this.accounts.values()).map(a => ({ ...a, passwordHash: undefined }));
        sender.send(JSON.stringify({ 
          type: "all_accounts", 
          payload: safeAccounts 
        }));
        sender.send(JSON.stringify({
          type: "all_requests",
          payload: Array.from(this.requests.values())
        }));
      }
      else if (msg.type === "approve_request") {
        const req = this.requests.get(msg.payload.requestId);
        if (req) {
          req.status = "approved";
          await this.persistRequests();
          
          const id = crypto.randomUUID();
          const rawPass = generateRandomPassword();
          
          // Generate user account immediately
          const acc: UserAccount = {
            id,
            email: req.email,
            passwordHash: await hashPassword(rawPass),
            canCreateForoom: false,
            createdAt: Date.now(),
            nick: req.nick || req.email.split("@")[0],
            avatarColor: req.avatarColor || "#3b82f6",
            avatarNodes: req.avatarNodes || 4
          };
          this.accounts.set(id, acc);
          await this.persistAccounts();
          this.broadcastAdmins();

          // Send Email with Password
          if (process.env.RESEND_API_KEY) {
            try {
              await fetch("https://api.resend.com/emails", {
                method: "POST",
                headers: {
                  "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
                  "Content-Type": "application/json"
                },
                body: JSON.stringify({
                  from: "FOROOMS Access <onboarding@resend.dev>",
                  to: req.email,
                  subject: "Your FOROOMS Access has been Approved!",
                  html: `<p>Welcome to FOROOMS! Your access request has been approved.</p><p>Your temporary password is: <strong>${rawPass}</strong></p><p><a href="https://forooms.vercel.app">Login Here</a></p>`
                })
              });
            } catch (e) {
              console.error("Failed to send approval email", e);
            }
          }
        }
      }
      else if (msg.type === "reject_request") {
        const req = this.requests.get(msg.payload.requestId);
        if (req) {
          req.status = "rejected";
          await this.persistRequests();
          this.broadcastAdmins();
        }
      }
      else if (msg.type === "delete_request") {
        this.requests.delete(msg.payload.requestId);
        await this.persistRequests();
        this.broadcastAdmins();
      }
      else if (msg.type === "toggle_create_access") {
        const acc = this.accounts.get(msg.payload.accountId);
        if (acc) {
          acc.canCreateForoom = msg.payload.canCreateForoom;
          await this.persistAccounts();
          this.broadcastAdmins();
        }
      }
    }
  }

  broadcastAdmins() {
    const safeAccounts = Array.from(this.accounts.values()).map(a => ({ ...a, passwordHash: undefined }));
    const accPayload = JSON.stringify({
      type: "all_accounts",
      payload: safeAccounts
    });
    const reqPayload = JSON.stringify({
      type: "all_requests",
      payload: Array.from(this.requests.values())
    });
    for (const conn of this.adminConnections) {
      conn.send(accPayload);
      conn.send(reqPayload);
    }
  }
}
