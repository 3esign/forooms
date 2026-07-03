"use client";

import React, { useEffect, useState, useRef } from "react";
import usePartySocket from "partysocket/react";
import { UserAccount, AccessRequest, ActiveForoom, AuthMessage, AuthResponse } from "../../../party/auth";
import { Shield, Key, Trash2, CheckCircle2, XCircle, Users, Clipboard, User } from "lucide-react";
import dynamic from "next/dynamic";
import { useAuth } from "../../contexts/AuthContext";

const AvatarPreview = dynamic(() => import("../../components/voxel/AvatarPreview"), { ssr: false });

export default function AdminDashboard() {
  const { adminPin, loginAsAdmin, logout } = useAuth();
  const [pin, setPin] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [accounts, setAccounts] = useState<UserAccount[]>([]);
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [forooms, setForooms] = useState<ActiveForoom[]>([]);
  
  const [newEmail, setNewEmail] = useState("");
  const [newCanCreate, setNewCanCreate] = useState(false);
  const [selectedUser, setSelectedUser] = useState<{ nick: string; email: string; avatarColor: string; avatarNodes: number } | null>(null);

  useEffect(() => {
    if (adminPin) {
      setPin(adminPin);
      setIsAuthenticated(true);
      // Fetch accounts using the verified admin pin
      try {
        socket.send(JSON.stringify({
          type: "fetch_accounts",
          payload: { adminPin }
        }));
      } catch (err) {
        console.error("[admin] Auto-fetch error:", err);
      }
    }
  }, [adminPin]);

  const socket = usePartySocket({
    host: process.env.NEXT_PUBLIC_PARTYKIT_HOST || "localhost:1999",
    room: "admin-auth",
    party: "auth",
    onOpen: () => {
      console.log("[admin] Socket opened");
      const currentPin = pin || adminPin;
      if (currentPin) {
        try {
          socket.send(JSON.stringify({
            type: "fetch_accounts",
            payload: { adminPin: currentPin }
          }));
        } catch (err) {
          console.error("[admin] onOpen fetch error:", err);
        }
      }
    },
    onMessage: (e) => {
      console.log("[admin] Socket message received:", e.data);
      try {
        const data = JSON.parse(e.data) as AuthResponse;
        if (data.type === "all_accounts") {
          setIsAuthenticated(true);
          setAccounts(data.payload);
          loginAsAdmin(pin);
        } else if (data.type === "all_requests") {
          setRequests(data.payload);
        } else if (data.type === "all_forooms") {
          setForooms(data.payload);
        } else if (data.type === "error") {
          if (data.payload === "Unauthorized") {
            setIsAuthenticated(false);
            alert("Invalid Admin PIN");
          }
        }
      } catch (err) {
        console.error(err);
      }
    }
  });

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("[admin] Submitting login with PIN:", pin);
    if (!pin) return;
    
    try {
      socket.send(JSON.stringify({
        type: "fetch_accounts",
        payload: { adminPin: pin }
      } as AuthMessage));
      console.log("[admin] Sent fetch_accounts message to socket");
    } catch (err) {
      console.error("[admin] Failed to send socket message:", err);
    }
  };

  const handleAddAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail) return;
    socket.send(JSON.stringify({
      type: "add_account",
      payload: { email: newEmail, canCreateForoom: newCanCreate, adminPin: pin }
    } as AuthMessage));
    setNewEmail("");
    setNewCanCreate(false);
  };

  const handleRemoveAccount = (id: string) => {
    socket.send(JSON.stringify({
      type: "remove_account",
      payload: { id, adminPin: pin }
    } as AuthMessage));
  };

  const handleApproveRequest = (requestId: string) => {
    socket.send(JSON.stringify({
      type: "approve_request",
      payload: { requestId, adminPin: pin }
    } as AuthMessage));
  };

  const handleToggleCreateAccess = (accountId: string, canCreate: boolean) => {
    socket.send(JSON.stringify({
      type: "toggle_create_access",
      payload: { accountId, canCreateForoom: canCreate, adminPin: pin }
    } as AuthMessage));
  };

  const handleRejectRequest = (requestId: string) => {
    socket.send(JSON.stringify({
      type: "reject_request",
      payload: { requestId, adminPin: pin }
    } as AuthMessage));
  };

  const handleDeleteRequest = (requestId: string) => {
    socket.send(JSON.stringify({
      type: "delete_request",
      payload: { requestId, adminPin: pin }
    } as AuthMessage));
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-urban-void flex items-center justify-center p-4">
        <form onSubmit={handleLogin} className="bg-white/5 border border-urban-concrete/20 p-8 rounded-2xl w-full max-w-sm space-y-6">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-urban-blueprint/20 text-urban-blueprint mb-4">
              <Shield className="w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold text-white tracking-wider uppercase">Admin Portal</h1>
            <p className="text-sm text-urban-concrete mt-2">Enter PIN to access the dashboard</p>
          </div>
          <input 
            type="password"
            placeholder="PIN Code"
            value={pin}
            onChange={e => setPin(e.target.value)}
            className="w-full bg-urban-void border border-urban-concrete/20 rounded-xl px-4 py-3 text-center text-xl tracking-[0.5em] text-white focus:outline-none focus:border-urban-blueprint transition-all"
            maxLength={6}
          />
          <button 
            type="submit"
            className="w-full py-3 bg-urban-blueprint text-white rounded-xl font-bold tracking-wide hover:bg-blue-500 transition-all shadow-[0_0_15px_rgba(47,129,247,0.3)] cursor-pointer"
          >
            Authenticate
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-urban-void text-white p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-urban-concrete/20 pb-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-urban-blueprint/20 text-urban-blueprint flex items-center justify-center">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-wider uppercase">Access Management</h1>
              <p className="text-sm text-urban-concrete mt-1">Manage users, passwords, and permissions.</p>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-sm font-mono text-urban-park flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-urban-park animate-pulse"></span>
              Connected to PartyKit
            </div>
            <button 
              onClick={() => {
                logout();
                window.location.href = "/";
              }}
              className="px-4 py-1.5 bg-urban-brick/20 hover:bg-urban-brick/35 text-urban-brick text-xs font-bold rounded-lg border border-urban-brick/30 transition-all cursor-pointer"
            >
              Log Off
            </button>
          </div>
        </div>

        <div className="flex justify-end">
          <button 
            onClick={() => {
              // Store admin pin temporarily in session storage to auto-login on map page
              sessionStorage.setItem("admin_auto_login", pin);
              window.location.href = "/";
            }}
            className="px-6 py-2 bg-urban-blueprint hover:bg-blue-500 text-white rounded-xl font-bold tracking-wide transition-all shadow-[0_0_15px_rgba(47,129,247,0.3)] cursor-pointer"
          >
            Create Forum (Go to Map)
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column Controls */}
          <div className="lg:col-span-1 space-y-6">
            {/* Generate Account Form */}
            <div className="bg-white/5 border border-urban-concrete/20 rounded-2xl p-6 h-fit">
              <h2 className="text-sm font-bold uppercase tracking-wider mb-6 flex items-center gap-2">
                <Key className="w-4 h-4 text-urban-blueprint" />
                Generate Account
              </h2>
              <form onSubmit={handleAddAccount} className="space-y-4">
                <div>
                  <label className="block text-xs text-urban-concrete mb-2">Email Address</label>
                  <input 
                    type="email"
                    value={newEmail}
                    onChange={e => setNewEmail(e.target.value)}
                    className="w-full bg-urban-void border border-urban-concrete/20 rounded-lg px-3 py-2 text-sm text-white focus:border-urban-blueprint transition-all outline-none"
                    placeholder="user@example.com"
                    required
                  />
                </div>
                <label className="flex items-center gap-3 cursor-pointer p-3 border border-urban-concrete/10 rounded-lg hover:bg-white/5 transition-all">
                  <input 
                    type="checkbox"
                    checked={newCanCreate}
                    onChange={e => setNewCanCreate(e.target.checked)}
                    className="w-4 h-4 rounded bg-urban-void border-urban-concrete/20 text-urban-blueprint focus:ring-urban-blueprint"
                  />
                  <div>
                    <div className="text-sm font-medium">Can Create Forooms</div>
                    <div className="text-xs text-urban-concrete">Allow user to initialize new map regions</div>
                  </div>
                </label>
                <button 
                  type="submit"
                  className="w-full py-2.5 bg-urban-concrete/10 hover:bg-urban-concrete/20 border border-urban-concrete/20 rounded-lg text-sm font-bold tracking-wide transition-all mt-4 cursor-pointer"
                >
                  Generate Password
                </button>
              </form>
            </div>

            {/* Selected User Avatar Preview */}
            {selectedUser && (
              <div className="bg-white/5 border border-urban-concrete/20 rounded-2xl p-6 h-fit space-y-4">
                <h2 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2 border-b border-white/10 pb-2">
                  <User className="w-4 h-4 text-urban-park" />
                  User Preview
                </h2>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-urban-concrete font-bold">Nickname</div>
                  <div className="text-sm font-bold text-white mt-0.5">{selectedUser.nick}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-urban-concrete font-bold">Email</div>
                  <div className="text-xs text-white/80 font-mono mt-0.5 break-all">{selectedUser.email}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-urban-concrete font-bold mb-2">Avatar shape ({selectedUser.avatarNodes} nodes)</div>
                  <AvatarPreview color={selectedUser.avatarColor} nodes={selectedUser.avatarNodes} />
                </div>
              </div>
            )}
          </div>

          {/* Accounts & Requests Lists */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Pending Requests Table */}
            <div className="bg-white/5 border border-urban-concrete/20 rounded-2xl overflow-hidden">
              <div className="p-6 border-b border-urban-concrete/20 flex items-center gap-2">
                <Users className="w-5 h-5 text-urban-signal" />
                <h2 className="text-sm font-bold uppercase tracking-wider">Access Requests</h2>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-black/20">
                    <tr>
                      <th className="p-4 font-semibold text-urban-concrete uppercase tracking-wider">Email</th>
                      <th className="p-4 font-semibold text-urban-concrete uppercase tracking-wider">Description</th>
                      <th className="p-4 font-semibold text-urban-concrete uppercase tracking-wider">Status</th>
                      <th className="p-4 font-semibold text-urban-concrete uppercase tracking-wider text-right">Approve As</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requests.sort((a,b) => b.createdAt - a.createdAt).map(req => (
                      <tr 
                        key={req.id} 
                        onClick={() => setSelectedUser({ 
                          nick: req.nick || req.email.split("@")[0], 
                          email: req.email, 
                          avatarColor: req.avatarColor || "#3b82f6", 
                          avatarNodes: req.avatarNodes || 4 
                        })}
                        className="border-b border-urban-concrete/10 hover:bg-white/5 cursor-pointer transition-all"
                      >
                        <td className="p-4 font-mono text-white">
                          <div>{req.email}</div>
                          {req.nick && <div className="text-[10px] text-urban-blueprint font-bold uppercase tracking-wider mt-0.5">Nick: {req.nick}</div>}
                        </td>
                        <td className="p-4 text-urban-concrete">{req.description}</td>
                        <td className="p-4 uppercase text-xs font-bold tracking-wider">
                          {req.status === "pending" && <span className="text-urban-signal">Pending</span>}
                          {req.status === "approved" && <span className="text-urban-park">Approved</span>}
                          {req.status === "rejected" && <span className="text-urban-brick">Rejected</span>}
                        </td>
                        <td className="p-4 text-right space-x-2">
                          {req.status === "pending" && (
                            <>
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleApproveRequest(req.id); }}
                                className="px-3 py-1 bg-urban-park/20 hover:bg-urban-park/35 text-urban-park text-xs font-semibold rounded transition-all cursor-pointer"
                              >
                                Approve
                              </button>
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleRejectRequest(req.id); }}
                                className="px-2.5 py-1 bg-urban-brick/20 hover:bg-urban-brick/35 text-urban-brick text-xs font-semibold rounded transition-all cursor-pointer"
                              >
                                Reject
                              </button>
                            </>
                          )}
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleDeleteRequest(req.id); }}
                            className="p-1.5 ml-2 text-urban-concrete hover:text-urban-brick bg-white/5 hover:bg-urban-brick/10 rounded-lg transition-all cursor-pointer inline-flex align-middle"
                            title="Delete Request"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {requests.length === 0 && (
                      <tr>
                        <td colSpan={4} className="p-8 text-center text-urban-concrete">
                          No access requests yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Active Builders */}
            <div className="bg-white/5 border border-urban-concrete/20 rounded-2xl overflow-hidden">
              <div className="p-6 border-b border-urban-concrete/20">
                <h2 className="text-sm font-bold uppercase tracking-wider">Active Builders</h2>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-black/20">
                    <tr>
                      <th className="p-4 font-semibold text-urban-concrete uppercase tracking-wider">Account</th>
                      <th className="p-4 font-semibold text-urban-concrete uppercase tracking-wider">Create Access</th>
                      <th className="p-4 font-semibold text-urban-concrete uppercase tracking-wider text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accounts.sort((a,b) => b.createdAt - a.createdAt).map(acc => (
                      <tr 
                        key={acc.id} 
                        onClick={() => setSelectedUser({ 
                          nick: acc.nick || acc.email.split("@")[0], 
                          email: acc.email, 
                          avatarColor: acc.avatarColor || "#3b82f6", 
                          avatarNodes: acc.avatarNodes || 4 
                        })}
                        className="border-b border-urban-concrete/10 hover:bg-white/5 cursor-pointer transition-all"
                      >
                        <td className="p-4 font-mono text-white">
                          <div>{acc.email}</div>
                          {acc.nick && <div className="text-[10px] text-urban-park font-bold uppercase tracking-wider mt-0.5">Nick: {acc.nick}</div>}
                        </td>
                        <td className="p-4">
                          <button 
                            onClick={() => handleToggleCreateAccess(acc.id, !acc.canCreateForoom)}
                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer border ${acc.canCreateForoom ? 'bg-urban-park/10 border-urban-park/30 text-urban-park hover:bg-urban-park/20' : 'bg-urban-concrete/5 border-urban-concrete/20 text-urban-concrete hover:bg-urban-concrete/10'}`}
                          >
                            {acc.canCreateForoom ? (
                              <><CheckCircle2 className="w-3.5 h-3.5"/> Creator</>
                            ) : (
                              <><XCircle className="w-3.5 h-3.5"/> Builder</>
                            )}
                          </button>
                        </td>
                        <td className="p-4 text-right">
                          <button 
                            onClick={() => handleRemoveAccount(acc.id)}
                            className="p-2 text-urban-concrete hover:text-urban-brick bg-white/5 hover:bg-urban-brick/10 rounded-lg transition-all cursor-pointer"
                            title="Revoke Access"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {accounts.length === 0 && (
                      <tr>
                        <td colSpan={3} className="p-8 text-center text-urban-concrete">
                          No accounts generated yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Active Forooms */}
            <div className="bg-white/5 border border-urban-concrete/20 rounded-2xl overflow-hidden">
              <div className="p-6 border-b border-urban-concrete/20 flex items-center gap-2">
                <Clipboard className="w-5 h-5 text-urban-blueprint" />
                <h2 className="text-sm font-bold uppercase tracking-wider">Active Forooms</h2>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-black/20">
                    <tr>
                      <th className="p-4 font-semibold text-urban-concrete uppercase tracking-wider">Name</th>
                      <th className="p-4 font-semibold text-urban-concrete uppercase tracking-wider">Creator</th>
                      <th className="p-4 font-semibold text-urban-concrete uppercase tracking-wider">Created At</th>
                      <th className="p-4 font-semibold text-urban-concrete uppercase tracking-wider text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {forooms.sort((a,b) => b.createdAt - a.createdAt).map(f => (
                      <tr key={f.id} className="border-b border-urban-concrete/10 hover:bg-white/5">
                        <td className="p-4 font-bold text-white">{f.name}</td>
                        <td className="p-4 text-urban-concrete">{f.creatorEmail}</td>
                        <td className="p-4 font-mono text-xs text-urban-concrete">{new Date(f.createdAt).toLocaleDateString()}</td>
                        <td className="p-4 text-right">
                          <a 
                            href={`/?foroom=${f.id}`}
                            className="px-4 py-1.5 bg-urban-blueprint hover:bg-blue-500 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition-all shadow-[0_0_10px_rgba(47,129,247,0.2)]"
                          >
                            Join
                          </a>
                        </td>
                      </tr>
                    ))}
                    {forooms.length === 0 && (
                      <tr>
                        <td colSpan={4} className="p-8 text-center text-urban-concrete">
                          No active forooms.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
