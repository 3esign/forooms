import type * as Party from "partykit/server";
import { jwtVerify, createRemoteJWKSet } from "jose";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { AuthUser, PlayerPosition, VoxelEdit, WebSocketMessage, Layer } from "../src/types";

export default class ForoomServer implements Party.Server {
  private jwkSet: ReturnType<typeof createRemoteJWKSet> | null = null;
  private supabase: SupabaseClient | null = null;
  private players = new Map<string, PlayerPosition>();
  private pendingEdits: VoxelEdit[] = [];
  private editCountSinceSnapshot = 0;

  constructor(readonly room: Party.Room) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (supabaseUrl) {
      // 1. Setup JWK for edge JWT verification
      this.jwkSet = createRemoteJWKSet(
        new URL(`${supabaseUrl}/auth/v1/.well-known/jwks.json`)
      );

      // 2. Setup Supabase admin client for persisting edits
      if (supabaseServiceKey) {
        this.supabase = createClient(supabaseUrl, supabaseServiceKey, {
          auth: { persistSession: false },
        });
      }
    }
  }

  async onBeforeConnect(req: Party.Request, connection: Party.Connection) {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");

    // In dev mode without Supabase config, allow anonymous connections
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
       connection.setState({ user: { id: "dev-user", role: "admin", email: "dev@local" } });
       return req;
    }

    if (!token || !this.jwkSet) {
      return new Response("Unauthorized", { status: 401 });
    }

    try {
      const { payload } = await jwtVerify(token, this.jwkSet, {
        issuer: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1`,
        audience: "authenticated",
      });

      const userMetadata = payload.user_metadata as any;
      const user: AuthUser = {
        id: payload.sub as string,
        email: payload.email as string,
        role: userMetadata?.role || "citizen",
      };

      connection.setState({ user });
      return req;
    } catch (err) {
      return new Response("Unauthorized: Invalid Token", { status: 401 });
    }
  }

  onConnect(connection: Party.Connection, ctx: Party.ConnectionContext) {
    const user = (connection.state as any)?.user as AuthUser | undefined;
    
    // Sync current state to new player
    const syncMsg: WebSocketMessage = {
      type: "sync_state",
      payload: {
        players: Array.from(this.players.values()),
        recentEdits: this.pendingEdits // Send recent edits (full world comes from db/snapshots initially)
      }
    };
    connection.send(JSON.stringify(syncMsg));
  }

  onMessage(message: string, sender: Party.Connection) {
    const user = (sender.state as any)?.user as AuthUser | undefined;
    if (!user) return;

    try {
      const parsed = JSON.parse(message) as WebSocketMessage;

      switch (parsed.type) {
        case "player_move":
          this.players.set(user.id, parsed.payload);
          // Broadcast movement to everyone EXCEPT sender (to save bandwidth)
          this.room.broadcast(message, [sender.id]);
          break;

        case "voxel_edit":
          // Authorization check: Citizen cannot edit
          if (user.role === "citizen") return;
          
          const edit = parsed.payload;
          this.pendingEdits.push(edit);
          this.editCountSinceSnapshot++;

          // Broadcast edit to everyone including sender (for verification)
          this.room.broadcast(message);

          // Asynchronously persist to Postgres
          this.persistEdit(edit);
          
          // Trigger Log Compaction/Checkpointing
          if (this.editCountSinceSnapshot > 500) {
             this.triggerCheckpoint();
          }
          break;
      }
    } catch (e) {
      console.error("Failed to parse WebSocket message", e);
    }
  }

  onClose(connection: Party.Connection) {
    const user = (connection.state as any)?.user as AuthUser | undefined;
    if (user) {
      this.players.delete(user.id);
      const leaveMsg: WebSocketMessage = { type: "player_leave", payload: { id: user.id } };
      this.room.broadcast(JSON.stringify(leaveMsg));
    }
  }

  private async persistEdit(edit: VoxelEdit) {
    if (!this.supabase) return;
    
    // Parse room ID (expected format: "foroomId:layer")
    const [foroomId] = this.room.id.split(":");

    try {
      await this.supabase.from("foroom_edits").insert({
        foroom_id: foroomId,
        layer: edit.layer,
        user_id: edit.userId,
        action: edit.action,
        coord_x: edit.x,
        coord_y: edit.y,
        coord_z: edit.z,
        block_id: edit.blockId,
        uuid: edit.uuid,
        timestamp: new Date(edit.timestamp).toISOString()
      });
    } catch (err) {
      console.error("Failed to persist edit to DB", err);
    }
  }

  private async triggerCheckpoint() {
    this.editCountSinceSnapshot = 0;
    // In a real app, we would compress the current voxel memory state using RLE
    // and write to the `foroom_snapshots` table.
    console.log(`[Checkpoint] Log compacted for room ${this.room.id}`);
  }
}
