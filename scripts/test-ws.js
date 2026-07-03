const WebSocket = require("ws");

const ws = new WebSocket("ws://localhost:1999/parties/auth/admin-auth");

ws.on("open", () => {
  console.log("Connected to PartyKit auth server!");
  
  // Send request_access message
  const msg = {
    type: "request_access",
    payload: {
      email: "test@example.com",
      description: "Testing websocket connection"
    }
  };
  
  console.log("Sending:", msg);
  ws.send(JSON.stringify(msg));
});

ws.on("message", (data) => {
  console.log("Received from server:", data.toString());
  ws.close();
});

ws.on("error", (err) => {
  console.error("WS Error:", err);
});

ws.on("close", () => {
  console.log("Connection closed.");
});
