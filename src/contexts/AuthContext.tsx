"use client";

import React, { createContext, useContext, useState } from "react";
import { UserAccount } from "@/types/auth";

type GoogleGsi = {
  accounts?: {
    id?: {
      disableAutoSelect?: () => void;
      revoke?: (email: string, cb: () => void) => void;
      cancel?: () => void;
    };
  };
};

interface AuthContextType {
  activeAccount: UserAccount | null;
  authSessionToken: string | null;
  adminPin: string | null;
  login: (account: UserAccount, token: string) => void;
  loginAsAdmin: (pin: string, account?: UserAccount) => void;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [activeAccount, setActiveAccount] = useState<UserAccount | null>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("activeAccount");
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch (e) {
          console.error("Failed to parse stored auth", e);
        }
      }
    }
    return null;
  });
  const [authSessionToken, setSessionToken] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("authSessionToken");
    }
    return null;
  });
  const [adminPin, setAdminPin] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("adminPin");
    }
    return null;
  });

  const login = (account: UserAccount, token: string) => {
    setActiveAccount(account);
    setSessionToken(token);
    if (typeof window !== "undefined") {
      localStorage.setItem("authSessionToken", token);
      localStorage.setItem("activeAccount", JSON.stringify(account));
    }
  };

  const loginAsAdmin = (pin: string, account?: UserAccount) => {
    setAdminPin(pin);
    const adminAccount: UserAccount = account || {
      id: "admin",
      email: "admin@forooms.app",
      canCreateForoom: true,
      createdAt: Date.now(),
      nick: "Admin",
      avatarColor: "#ef4444",
      avatarNodes: 8
    };
    setActiveAccount(adminAccount);
    setSessionToken(pin);
    if (typeof window !== "undefined") {
      localStorage.setItem("adminPin", pin);
      localStorage.setItem("authSessionToken", pin);
      localStorage.setItem("activeAccount", JSON.stringify(adminAccount));
    }
  };

  const logout = (): Promise<void> => {
    const emailToRevoke = activeAccount?.email;
    setActiveAccount(null);
    setSessionToken(null);
    setAdminPin(null);
    if (typeof window !== "undefined") {
      localStorage.removeItem("authSessionToken");
      localStorage.removeItem("activeAccount");
      localStorage.removeItem("adminPin");
      // Clean up any legacy/temporary auto-login keys across both storages
      localStorage.removeItem("admin_auto_login");
      try {
        sessionStorage.removeItem("admin_auto_login");
      } catch {}
      localStorage.setItem("google_logged_out", "true");
      return new Promise<void>((resolve) => {
        try {
          const google = (window as unknown as { google?: GoogleGsi }).google;
          const gsi = google?.accounts?.id;
          if (gsi) {
            gsi.cancel?.();
            gsi.disableAutoSelect?.();
            console.log("[auth] Disabled Google GSI auto-select");
            if (emailToRevoke) {
              gsi.revoke?.(emailToRevoke, () => {
                console.log("[auth] Revoked Google session for", emailToRevoke);
                resolve();
              });
              // safety timeout of 1s in case revoke fails to respond
              setTimeout(resolve, 1000);
            } else {
              resolve();
            }
          } else {
            resolve();
          }
        } catch (err) {
          console.error("Failed to disable Google auto-select:", err);
          resolve();
        }
      });
    }
    return Promise.resolve();
  };

  const isAuthenticated = !!activeAccount;
  const isAdmin = activeAccount?.id === "admin" || 
                  activeAccount?.email?.toLowerCase() === "admin@forooms.app" ||
                  activeAccount?.email?.toLowerCase() === "poturaksemir@gmail.com" ||
                  !!adminPin;

  return (
    <AuthContext.Provider value={{
      activeAccount,
      authSessionToken,
      adminPin,
      login,
      loginAsAdmin,
      logout,
      isAuthenticated,
      isAdmin
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
