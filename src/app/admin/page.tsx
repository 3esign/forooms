"use client";

import { useState, useEffect } from "react";
import usePartySocket from "partysocket/react";
import { AccessRequest, AuthMessage, AuthResponse } from "../../../party/auth";

export default function AdminDashboard() {
  const [pin, setPin] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [error, setError] = useState("");

  const socket = usePartySocket({
    room: "admin-auth",
    party: "auth",
    query: { adminPin: pin },
    onMessage: (e) => {
      try {
        const msg = JSON.parse(e.data) as AuthResponse;
        if (msg.type === "all_requests") {
          setIsAuthenticated(true);
          setRequests(msg.payload);
          setError("");
        } else if (msg.type === "error") {
          setError(msg.payload);
        } else if (msg.type === "access_status") {
          // Update a single request in the list
          setRequests(prev => {
            const index = prev.findIndex(r => r.id === msg.payload.id);
            if (index >= 0) {
              const newRequests = [...prev];
              newRequests[index] = msg.payload as AccessRequest;
              return newRequests;
            } else {
              return [...prev, msg.payload as AccessRequest];
            }
          });
        }
      } catch (err) {}
    }
  });

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin) return;
    // We force a reconnect with the new query pin
    socket.reconnect();
  };

  const handleAction = (id: string, action: "approve_access" | "reject_access") => {
    socket.send(JSON.stringify({ type: action, payload: { id, adminPin: pin } }));
  };

  if (!isAuthenticated) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background text-foreground">
        <form onSubmit={handleLogin} className="flex flex-col gap-4 bg-white/5 p-8 rounded-xl border border-urban-concrete/20 w-96">
          <h1 className="text-2xl font-bold tracking-tighter">Admin Login</h1>
          {error && <p className="text-urban-brick text-sm">{error}</p>}
          <input 
            type="password" 
            placeholder="Admin PIN"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            className="bg-white/5 border border-urban-concrete/20 rounded-xl px-4 py-3 text-white"
          />
          <button type="submit" className="bg-urban-blueprint hover:bg-blue-500 text-white rounded-xl py-3 font-bold transition-all">
            Login
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen bg-background text-foreground p-12">
      <div className="max-w-4xl mx-auto w-full">
        <h1 className="text-4xl font-bold tracking-tighter mb-8">Admin Dashboard</h1>
        
        <div className="bg-white/5 border border-urban-concrete/20 rounded-xl overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/5 border-b border-urban-concrete/20">
              <tr>
                <th className="p-4 font-semibold text-urban-concrete uppercase tracking-wider">User</th>
                <th className="p-4 font-semibold text-urban-concrete uppercase tracking-wider">Status</th>
                <th className="p-4 font-semibold text-urban-concrete uppercase tracking-wider">Date</th>
                <th className="p-4 font-semibold text-urban-concrete uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {requests.sort((a,b) => b.createdAt - a.createdAt).map(req => (
                <tr key={req.id} className="border-b border-urban-concrete/10 hover:bg-white/5">
                  <td className="p-4">
                    <div className="font-mono text-white">{req.email}</div>
                    <div className="text-xs text-urban-concrete mt-1">{req.description}</div>
                  </td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded text-xs uppercase tracking-wider font-bold ${
                      req.status === 'pending' ? 'bg-urban-signal/20 text-urban-signal' :
                      req.status === 'approved' ? 'bg-urban-park/20 text-urban-park' :
                      'bg-urban-brick/20 text-urban-brick'
                    }`}>
                      {req.status}
                    </span>
                  </td>
                  <td className="p-4 text-urban-concrete text-xs">
                    {new Date(req.createdAt).toLocaleString()}
                  </td>
                  <td className="p-4 text-right space-x-2">
                    {req.status === "pending" && (
                      <>
                        <button onClick={() => handleAction(req.id, "approve_access")} className="text-xs bg-urban-park/20 text-urban-park px-3 py-1.5 rounded hover:bg-urban-park/40 transition-colors">Approve</button>
                        <button onClick={() => handleAction(req.id, "reject_access")} className="text-xs bg-urban-brick/20 text-urban-brick px-3 py-1.5 rounded hover:bg-urban-brick/40 transition-colors">Reject</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
              {requests.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-urban-concrete italic">No requests yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
