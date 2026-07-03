import type * as Party from "partykit/server";

export default class ForoomServer implements Party.Server {
  private players = new Map<string, any>();
  private edits = new Map<string, any>(); // key: x,y,z
  private infoBlocks = new Map<string, string>(); // key: x,y,z, value: info markdown
  private appearance: any = null;
  private activityLog: { timestamp: number, type: string, message: string }[] = [];

  constructor(readonly room: Party.Room) {}

  async onStart() {
    const storedEdits = await this.room.storage.get<Record<string, any>>("edits");
    if (storedEdits) {
      for (const [key, edit] of Object.entries(storedEdits)) {
        this.edits.set(key, edit);
      }
    }
    const storedInfo = await this.room.storage.get<Record<string, string>>("info_blocks");
    if (storedInfo) {
      for (const [key, info] of Object.entries(storedInfo)) {
        this.infoBlocks.set(key, info);
      }
    }
    const storedAppearance = await this.room.storage.get<any>("appearance");
    if (storedAppearance) {
      this.appearance = storedAppearance;
    }
  }

  private persistTimer: ReturnType<typeof setTimeout> | null = null;

  async persist() {
    const data = Object.fromEntries(this.edits);
    await this.room.storage.put("edits", data);
    const infoData = Object.fromEntries(this.infoBlocks);
    await this.room.storage.put("info_blocks", infoData);
    if (this.appearance) {
      await this.room.storage.put("appearance", this.appearance);
    }
  }

  schedulePersist() {
    if (this.persistTimer) clearTimeout(this.persistTimer);
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null;
      void this.persist();
    }, 400);
  }

  private presencePayload() {
    return Array.from(this.players.values()).map((p) => ({
      ...p,
      isOnline: true,
    }));
  }

  addLog(type: string, message: string) {
    const entry = { timestamp: Date.now(), type, message };
    this.activityLog.push(entry);
    if (this.activityLog.length > 50) this.activityLog.shift();
    this.room.broadcast(JSON.stringify({ type: "log_event", log: entry }));
  }

  broadcastPresence() {
    this.room.broadcast(JSON.stringify({
      type: "presence_update",
      players: this.presencePayload(),
    }));
  }

  async onConnect(connection: Party.Connection, ctx: Party.ConnectionContext) {
    const url = new URL(ctx.request.url);
    const token = url.searchParams.get("token");
    let role = "guest";
    let email = "Guest";
    let nick = "Guest";
    let avatarColor = "#3b82f6";
    let avatarNodes = 4;

    if (token) {
      try {
        // We use an internal fetch to the auth party room to verify the token
        const authRoom = this.room.context.parties.auth.get("admin-auth");
        const res = await authRoom.fetch(`/verify?token=${token}`);
        if (res.ok) {
          const authData = await res.json();
          if (authData.valid) {
            role = authData.role;
            email = authData.email;
            nick = authData.nick || email.split("@")[0];
            avatarColor = authData.avatarColor || "#3b82f6";
            avatarNodes = authData.avatarNodes || 4;
          }
        }
      } catch (err) {
        console.error("Auth verify failed", err);
      }
    }
    
    // Store role and initial state
    connection.setState({ role, email, nick, avatarColor, avatarNodes });
    this.players.set(connection.id, { 
      id: connection.id, 
      role, 
      email, 
      nick, 
      avatarColor, 
      avatarNodes, 
      x: 0, 
      y: 1.98, 
      z: 60 
    });

    this.addLog("join", `${nick} joined the foroom`);
    this.broadcastPresence();

    // Send current initial state
    connection.send(JSON.stringify({
      type: "init",
      edits: Array.from(this.edits.values()),
      infoBlocks: Object.fromEntries(this.infoBlocks),
      appearance: this.appearance,
      logs: this.activityLog.map((l) => ({ timestamp: l.timestamp, message: l.message })),
      players: this.presencePayload(),
    }));
  }

  onMessage(message: string, sender: Party.Connection) {
    try {
      const state = sender.state as any;
      const parsed = JSON.parse(message);

      if (parsed.type === "edit") {
        // Only builders and admins can edit
        if (state?.role !== "builder" && state?.role !== "admin") return;

        const key = `${parsed.x},${parsed.y},${parsed.z}`;
        
        if (parsed.blockId === 0) {
          this.edits.delete(key);
          if (this.infoBlocks.has(key)) {
            this.infoBlocks.delete(key);
            this.addLog("edit", `${state?.email || 'Someone'} deleted a block with info`);
          }
        } else {
          this.edits.set(key, { x: parsed.x, y: parsed.y, z: parsed.z, blockId: parsed.blockId });
        }
        
        this.schedulePersist();

        // Broadcast to everyone
        this.room.broadcast(message);
      }
      else if (parsed.type === "place_info") {
        if (state?.role === "guest") return;
        const key = `${parsed.x},${parsed.y},${parsed.z}`;
        this.infoBlocks.set(key, parsed.info);
        this.schedulePersist();
        this.addLog("info", `${state?.email || 'Someone'} placed information at ${parsed.x}, ${parsed.y}, ${parsed.z}`);
        this.room.broadcast(JSON.stringify({ type: "info_update", infoBlocks: Object.fromEntries(this.infoBlocks) }));
      }
      else if (parsed.type === "player_move") {
        const player = this.players.get(sender.id);
        if (player) {
          player.x = parsed.x;
          player.y = parsed.y;
          player.z = parsed.z;
          this.players.set(sender.id, player);
          // Only broadcast move to others to save bandwidth
          this.room.broadcast(JSON.stringify({
            type: "player_move",
            id: sender.id,
            x: parsed.x,
            y: parsed.y,
            z: parsed.z
          }), [sender.id]);
        }
      }
      else if (parsed.type === "chat") {
        const displayName = state?.nick || state?.email || 'Someone';
        this.addLog("chat", `${displayName}: ${parsed.message}`);
        this.room.broadcast(JSON.stringify({
          type: "chat",
          senderId: sender.id,
          email: displayName,
          message: parsed.message
        }));
      }
      else if (parsed.type === "admin_change_role") {
        if (state?.role === "admin") {
          const targetPlayer = this.players.get(parsed.targetId);
          if (targetPlayer) {
            targetPlayer.role = parsed.newRole;
            this.addLog("role_change", `${state.email} changed ${targetPlayer.email}'s role to ${parsed.newRole}`);
            this.broadcastPresence();
            
            const targetConn = this.room.getConnection(parsed.targetId);
            if (targetConn) {
              targetConn.setState({ ...targetConn.state, role: parsed.newRole });
              targetConn.send(JSON.stringify({
                type: "role_updated",
                newRole: parsed.newRole
              }));
            }
          }
        }
      }
      else if (parsed.type === "admin_clear_room") {
        if (state?.role === "admin") {
          this.edits.clear();
          this.infoBlocks.clear();
          this.schedulePersist();
          this.addLog("clear", `${state.email} cleared the foroom layout and notes`);
          this.room.broadcast(JSON.stringify({ type: "room_cleared" }));
        }
      }
      else if (parsed.type === "appearance_update") {
        if (state?.role === "admin") {
          this.appearance = parsed.appearance;
          this.schedulePersist();
          this.room.broadcast(message);
        }
      }
    } catch (e) {
      console.error(e);
    }
  }

  onClose(connection: Party.Connection) {
    const state = connection.state as any;
    this.players.delete(connection.id);
    this.addLog("leave", `${state?.email || 'Guest'} left the foroom`);
    this.broadcastPresence();
  }
}
