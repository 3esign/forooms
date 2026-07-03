const http = require("http");
const url = require("url");
const fs = require("fs");
const path = require("path");
const dns = require("dns");
dns.setDefaultResultOrder("ipv4first");
const crypto = require("crypto");
const { WebSocketServer } = require("ws");
const { Client } = require("pg");

// Ensure data folder exists
const DATA_DIR = path.join(__dirname, "../data");
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
const DB_PATH = path.join(DATA_DIR, "db.json");

// Load database
let db = {
  accounts: {},
  requests: {},
  forooms: {},
  roomEdits: {},
  roomInfoBlocks: {},
  roomAppearances: {}
};

let pgClient = null;
const DATABASE_URL = process.env.DATABASE_URL;
let dbStatus = "Not Initialized";
let dbError = null;

async function initDb() {
  if (DATABASE_URL) {
    console.log("DATABASE_URL is set. Connecting to PostgreSQL database...");
    dbStatus = "Connecting to PostgreSQL...";
    try {
      const dbUrlParsed = url.parse(DATABASE_URL);
      const hostname = dbUrlParsed.hostname;
      
      // Force manual DNS lookup to resolve IPv4 address only
      const ip = await new Promise((resolve, reject) => {
        dns.lookup(hostname, { family: 4 }, (err, address) => {
          if (err) reject(err);
          else resolve(address);
        });
      });
      
      console.log(`Resolved hostname ${hostname} to IPv4: ${ip}`);
      const resolvedConnectionStr = DATABASE_URL.replace(hostname, ip);

      pgClient = new Client({
        connectionString: resolvedConnectionStr,
        ssl: {
          rejectUnauthorized: false
        }
      });
      await pgClient.connect();
      console.log("Successfully connected to PostgreSQL database.");

      // Create table if it doesn't exist
      await pgClient.query(`
        CREATE TABLE IF NOT EXISTS forooms_store (
          key VARCHAR(50) PRIMARY KEY,
          data JSONB NOT NULL
        )
      `);

      // Try to load the data
      const res = await pgClient.query("SELECT data FROM forooms_store WHERE key = 'current'");
      if (res.rows.length > 0) {
        db = res.rows[0].data;
        console.log("Database loaded successfully from PostgreSQL.");
      } else {
        // Initialize row
        await pgClient.query("INSERT INTO forooms_store (key, data) VALUES ('current', $1)", [JSON.stringify(db)]);
        console.log("Initialized fresh database in PostgreSQL store.");
      }
      dbStatus = "Connected to PostgreSQL";
      dbError = null;
    } catch (err) {
      console.error("Failed to connect or initialize PostgreSQL database, falling back to local file storage:", err);
      pgClient = null;
      dbStatus = "PostgreSQL Error (Fallback to local file storage)";
      dbError = err.message || err.toString();
      loadLocalDb();
    }
  } else {
    console.log("No DATABASE_URL set. Using local file storage.");
    dbStatus = "Local File Storage (db.json)";
    dbError = null;
    loadLocalDb();
  }
}

function loadLocalDb() {
  if (fs.existsSync(DB_PATH)) {
    try {
      db = JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
      console.log("Database loaded successfully from local file.");
    } catch (e) {
      console.error("Failed to load db.json, starting fresh", e);
    }
  } else {
    console.log("Starting with a fresh local database.");
  }
}

let saveTimeout = null;
function saveDb() {
  if (!pgClient) {
    try {
      fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), "utf8");
    } catch (e) {
      console.error("Failed to save db.json", e);
    }
    return;
  }

  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(async () => {
    try {
      await pgClient.query("UPDATE forooms_store SET data = $1 WHERE key = 'current'", [JSON.stringify(db)]);
      console.log("Database saved successfully to PostgreSQL.");
    } catch (err) {
      console.error("Failed to save database to PostgreSQL:", err);
    }
  }, 2000);
}

// Session tokens cache
const tokens = new Map();

// Helper to hash password
function hashPassword(password) {
  return crypto.createHash("sha256").update(password).digest("hex");
}

function generateRandomPassword() {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let pass = "";
  for (let i = 0; i < 8; i++) pass += chars.charAt(Math.floor(Math.random() * chars.length));
  return pass;
}

// Active connections
const rooms = new Map(); // name -> Set of connections
const authConnections = new Set();
const adminConnections = new Set();

const PORT = process.env.PORT || 1999;
const ADMIN_PIN = process.env.ADMIN_PIN || "1234";
const RESEND_API_KEY = process.env.RESEND_API_KEY || "";

// HTTP server to handle verification & static health checks
const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);

  // CORS Headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  if (parsedUrl.pathname === "/verify") {
    const token = parsedUrl.query.token;
    if (token === ADMIN_PIN) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ valid: true, email: "admin", role: "admin" }));
      return;
    }

    if (token && tokens.has(token)) {
      const session = tokens.get(token);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ valid: true, ...session }));
      return;
    }

    res.writeHead(401, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ valid: false }));
    return;
  }

  if (parsedUrl.pathname === "/db-status") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ 
      status: dbStatus, 
      error: dbError,
      hasDatabaseUrl: !!DATABASE_URL
    }, null, 2));
    return;
  }

  // Health check
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("FOROOMS Realtime Server is active!");
});

// Setup WebSocket Server
const wss = new WebSocketServer({ noServer: true });

wss.on("connection", (ws, req) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const token = parsedUrl.query.token;

  // Resolve role and user info
  let role = "guest";
  let email = "Guest";
  let nick = "Guest";
  let avatarColor = "#3b82f6";
  let avatarNodes = 4;

  if (token) {
    if (token === ADMIN_PIN) {
      role = "admin";
      email = "admin@forooms.app";
      nick = "Admin";
      avatarColor = "#ef4444";
      avatarNodes = 8;
    } else if (tokens.has(token)) {
      const session = tokens.get(token);
      role = session.role;
      email = session.email;
      nick = session.nick || email.split("@")[0];
      avatarColor = session.avatarColor || "#3b82f6";
      avatarNodes = session.avatarNodes || 4;
    }
  }

  // Setup connection state
  ws.state = { id: crypto.randomUUID(), role, email, nick, avatarColor, avatarNodes, x: 0, y: 1.98, z: 60 };

  if (pathname === "/parties/auth/admin-auth") {
    // Auth room connection
    authConnections.add(ws);
    console.log(`[auth] Connected: ${ws.state.id} (${email})`);

    // Send active rooms list on connection
    ws.send(JSON.stringify({
      type: "all_forooms",
      payload: Object.values(db.forooms)
    }));

    ws.on("message", async (data) => {
      try {
        const msg = JSON.parse(data.toString());
        console.log(`[auth] Message:`, msg);

        if (msg.type === "verify_login") {
          const { email: loginEmail, passwordHash: clientPassword } = msg.payload;

          if (clientPassword === ADMIN_PIN) {
            ws.send(JSON.stringify({
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
                token: ADMIN_PIN
              }
            }));
            return;
          }

          const targetHash = hashPassword(clientPassword);
          const account = Object.values(db.accounts).find(a => a.email === loginEmail && a.passwordHash === targetHash);
          if (account) {
            const sessionToken = crypto.randomUUID();
            tokens.set(sessionToken, {
              email: account.email,
              role: account.canCreateForoom ? "builder" : "guest",
              nick: account.nick || account.email.split("@")[0],
              avatarColor: account.avatarColor || "#3b82f6",
              avatarNodes: account.avatarNodes || 4
            });

            const safeAccount = { ...account, passwordHash: undefined };
            ws.send(JSON.stringify({ type: "login_success", payload: { account: safeAccount, token: sessionToken } }));
          } else {
            ws.send(JSON.stringify({ type: "login_failed", payload: "Invalid email or password" }));
          }
        }
        else if (msg.type === "request_access") {
          const reqId = crypto.randomUUID();
          const newReq = {
            id: reqId,
            email: msg.payload.email,
            description: msg.payload.description,
            status: "pending",
            createdAt: Date.now(),
            nick: msg.payload.nick,
            avatarColor: msg.payload.avatarColor,
            avatarNodes: msg.payload.avatarNodes
          };
          db.requests[reqId] = newReq;
          saveDb();
          ws.send(JSON.stringify({ type: "request_submitted", payload: "Access request submitted successfully!" }));
          broadcastAdmins();

          // Resend email notification
          if (RESEND_API_KEY) {
            try {
              fetch("https://api.resend.com/emails", {
                method: "POST",
                headers: {
                  "Authorization": `Bearer ${RESEND_API_KEY}`,
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
              console.error("Resend error", e);
            }
          }
        }
        else if (msg.type === "create_foroom") {
          const createToken = msg.payload.token;
          let isAuthorized = false;

          if (createToken === ADMIN_PIN) {
            isAuthorized = true;
          } else if (createToken && tokens.has(createToken)) {
            const session = tokens.get(createToken);
            if (session && (session.role === "admin" || session.role === "builder")) {
              isAuthorized = true;
            }
          }

          if (!isAuthorized) {
            ws.send(JSON.stringify({ type: "error", payload: "Unauthorized to create foroom" }));
            return;
          }

          const foroomId = crypto.randomUUID();
          const newForoom = {
            id: foroomId,
            name: msg.payload.name,
            bbox: msg.payload.bbox,
            creatorEmail: msg.payload.creatorEmail,
            createdAt: Date.now()
          };
          db.forooms[foroomId] = newForoom;
          saveDb();

          // Broadcast updated list to all active auth connections
          const listPayload = JSON.stringify({
            type: "all_forooms",
            payload: Object.values(db.forooms)
          });
          for (const conn of authConnections) {
            conn.send(listPayload);
          }
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
          if (msg.payload.adminPin !== ADMIN_PIN) {
            ws.send(JSON.stringify({ type: "error", payload: "Unauthorized" }));
            return;
          }

          adminConnections.add(ws);

          if (msg.type === "add_account") {
            const accId = crypto.randomUUID();
            const rawPass = generateRandomPassword();
            db.accounts[accId] = {
              id: accId,
              email: msg.payload.email,
              passwordHash: hashPassword(rawPass),
              canCreateForoom: msg.payload.canCreateForoom,
              createdAt: Date.now(),
              nick: msg.payload.nick || msg.payload.email.split("@")[0],
              avatarColor: msg.payload.avatarColor || "#3b82f6",
              avatarNodes: msg.payload.avatarNodes || 4
            };
            saveDb();
            broadcastAdmins();
          }
          else if (msg.type === "remove_account") {
            delete db.accounts[msg.payload.id];
            saveDb();
            broadcastAdmins();
          }
          else if (msg.type === "fetch_accounts") {
            const safeAccounts = Object.values(db.accounts).map(a => ({ ...a, passwordHash: undefined }));
            ws.send(JSON.stringify({ type: "all_accounts", payload: safeAccounts }));
            ws.send(JSON.stringify({ type: "all_requests", payload: Object.values(db.requests) }));
          }
          else if (msg.type === "approve_request") {
            const reqData = db.requests[msg.payload.requestId];
            if (reqData) {
              reqData.status = "approved";
              const accId = crypto.randomUUID();
              const rawPass = generateRandomPassword();
              db.accounts[accId] = {
                id: accId,
                email: reqData.email,
                passwordHash: hashPassword(rawPass),
                canCreateForoom: false,
                createdAt: Date.now(),
                nick: reqData.nick || reqData.email.split("@")[0],
                avatarColor: reqData.avatarColor || "#3b82f6",
                avatarNodes: reqData.avatarNodes || 4
              };
              saveDb();
              broadcastAdmins();

              if (RESEND_API_KEY) {
                try {
                  fetch("https://api.resend.com/emails", {
                    method: "POST",
                    headers: {
                      "Authorization": `Bearer ${RESEND_API_KEY}`,
                      "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                      from: "FOROOMS Access <onboarding@resend.dev>",
                      to: reqData.email,
                      subject: "Your FOROOMS Access has been Approved!",
                      html: `<p>Welcome to FOROOMS! Your access request has been approved.</p><p>Your temporary password is: <strong>${rawPass}</strong></p><p><a href="https://forooms.vercel.app">Login Here</a></p>`
                    })
                  });
                } catch (e) {
                  console.error("Resend approval error", e);
                }
              }
            }
          }
          else if (msg.type === "reject_request") {
            const reqData = db.requests[msg.payload.requestId];
            if (reqData) {
              reqData.status = "rejected";
              saveDb();
              broadcastAdmins();
            }
          }
          else if (msg.type === "delete_request") {
            delete db.requests[msg.payload.requestId];
            saveDb();
            broadcastAdmins();
          }
          else if (msg.type === "toggle_create_access") {
            const acc = db.accounts[msg.payload.accountId];
            if (acc) {
              acc.canCreateForoom = msg.payload.canCreateForoom;
              saveDb();
              broadcastAdmins();
            }
          }
        }
      } catch (e) {
        console.error("[auth] Message error", e);
      }
    });

    ws.on("close", () => {
      authConnections.delete(ws);
      adminConnections.delete(ws);
      console.log(`[auth] Disconnected: ${ws.state.id}`);
    });
  } 
  else if (pathname.startsWith("/parties/main/")) {
    // Voxel room connection
    const roomName = pathname.substring("/parties/main/".length);
    if (!rooms.has(roomName)) {
      rooms.set(roomName, new Set());
    }
    const roomClients = rooms.get(roomName);
    roomClients.add(ws);
    console.log(`[room:${roomName}] Connected: ${ws.state.id} (${email})`);

    // Helper to send logs to this client
    const getLogs = () => {
      // In-memory or loaded logs
      return [];
    };

    const addLog = (category, msgText) => {
      const logEntry = { timestamp: Date.now(), type: category, message: msgText };
      // Broadcast log_event to all clients in room
      const payload = JSON.stringify({ type: "log_event", log: logEntry });
      for (const client of roomClients) {
        client.send(payload);
      }
    };

    const getPresenceList = () => {
      return Array.from(roomClients).map(c => ({
        id: c.state.id,
        role: c.state.role,
        email: c.state.email,
        nick: c.state.nick,
        avatarColor: c.state.avatarColor,
        avatarNodes: c.state.avatarNodes,
        x: c.state.x,
        y: c.state.y,
        z: c.state.z,
        isOnline: true
      }));
    };

    const broadcastPresence = () => {
      const payload = JSON.stringify({
        type: "presence_update",
        players: getPresenceList()
      });
      for (const client of roomClients) {
        client.send(payload);
      }
    };

    // Load initial room data
    const roomEdits = db.roomEdits[roomName] || {};
    const roomInfoBlocks = db.roomInfoBlocks[roomName] || {};
    const roomAppearance = db.roomAppearances[roomName] || null;

    // Send init payload
    ws.send(JSON.stringify({
      type: "init",
      edits: Object.values(roomEdits),
      infoBlocks: roomInfoBlocks,
      appearance: roomAppearance,
      logs: [],
      players: getPresenceList()
    }));

    addLog("join", `${nick} joined the foroom`);
    broadcastPresence();

    ws.on("message", (data) => {
      try {
        const msg = JSON.parse(data.toString());

        if (msg.type === "edit") {
          if (role !== "builder" && role !== "admin") return;
          const key = `${msg.x},${msg.y},${msg.z}`;

          if (!db.roomEdits[roomName]) db.roomEdits[roomName] = {};
          if (!db.roomInfoBlocks[roomName]) db.roomInfoBlocks[roomName] = {};

          if (msg.blockId === 0) {
            delete db.roomEdits[roomName][key];
            if (db.roomInfoBlocks[roomName][key]) {
              delete db.roomInfoBlocks[roomName][key];
              addLog("edit", `${email} deleted a block with info`);
            }
          } else {
            db.roomEdits[roomName][key] = { x: msg.x, y: msg.y, z: msg.z, blockId: msg.blockId };
          }
          saveDb();

          // Broadcast to everyone in the room
          for (const client of roomClients) {
            client.send(data.toString());
          }
        }
        else if (msg.type === "place_info") {
          if (role === "guest") return;
          const key = `${msg.x},${msg.y},${msg.z}`;

          if (!db.roomInfoBlocks[roomName]) db.roomInfoBlocks[roomName] = {};
          db.roomInfoBlocks[roomName][key] = msg.info;
          saveDb();

          addLog("info", `${email} placed information at ${msg.x}, ${msg.y}, ${msg.z}`);
          
          // Broadcast to everyone in the room
          const updatePayload = JSON.stringify({
            type: "info_update",
            infoBlocks: db.roomInfoBlocks[roomName]
          });
          for (const client of roomClients) {
            client.send(updatePayload);
          }
        }
        else if (msg.type === "player_move") {
          ws.state.x = msg.x;
          ws.state.y = msg.y;
          ws.state.z = msg.z;

          // Broadcast move to other clients in room (exclude sender to save bandwidth)
          const movePayload = JSON.stringify({
            type: "player_move",
            id: ws.state.id,
            x: msg.x,
            y: msg.y,
            z: msg.z
          });
          for (const client of roomClients) {
            if (client !== ws) {
              client.send(movePayload);
            }
          }
        }
        else if (msg.type === "chat") {
          addLog("chat", `${nick}: ${msg.message}`);
        }
        else if (msg.type === "admin_change_role") {
          if (role === "admin") {
            const target = Array.from(roomClients).find(c => c.state.id === msg.targetId);
            if (target) {
              target.state.role = msg.newRole;
              addLog("role_change", `${email} changed ${target.state.email}'s role to ${msg.newRole}`);
              broadcastPresence();
              
              target.send(JSON.stringify({
                type: "role_updated",
                newRole: msg.newRole
              }));
            }
          }
        }
        else if (msg.type === "admin_clear_room") {
          if (role === "admin") {
            db.roomEdits[roomName] = {};
            db.roomInfoBlocks[roomName] = {};
            saveDb();

            addLog("clear", `${email} cleared the foroom layout and notes`);
            
            const clearPayload = JSON.stringify({ type: "room_cleared" });
            for (const client of roomClients) {
              client.send(clearPayload);
            }
          }
        }
        else if (msg.type === "appearance_update") {
          if (role === "admin") {
            db.roomAppearances[roomName] = msg.appearance;
            saveDb();

            // Broadcast to everyone in the room
            for (const client of roomClients) {
              client.send(data.toString());
            }
          }
        }
      } catch (e) {
        console.error(`[room:${roomName}] Message error`, e);
      }
    });

    ws.on("close", () => {
      roomClients.delete(ws);
      if (roomClients.size === 0) {
        rooms.delete(roomName);
      }
      addLog("leave", `${nick} left the foroom`);
      broadcastPresence();
      console.log(`[room:${roomName}] Disconnected: ${ws.state.id}`);
    });
  }
});

function broadcastAdmins() {
  const safeAccounts = Object.values(db.accounts).map(a => ({ ...a, passwordHash: undefined }));
  const accPayload = JSON.stringify({
    type: "all_accounts",
    payload: safeAccounts
  });
  const reqPayload = JSON.stringify({
    type: "all_requests",
    payload: Object.values(db.requests)
  });
  for (const conn of adminConnections) {
    try {
      conn.send(accPayload);
      conn.send(reqPayload);
    } catch (e) {}
  }
}

// Upgrade WebSocket requests
server.on("upgrade", (req, socket, head) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  if (pathname === "/parties/auth/admin-auth" || pathname.startsWith("/parties/main/")) {
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  } else {
    socket.destroy();
  }
});

// Start HTTP server after database initialization
(async () => {
  await initDb();
  server.listen(PORT, () => {
    console.log(`🎈 FOROOMS Realtime Standalone Server is running on port ${PORT}`);
  });
})();
