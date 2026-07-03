"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { UserAccount } from "@/types/auth";

interface AuthContextType {
  activeAccount: UserAccount | null;
  authSessionToken: string | null;
  adminPin: string | null;
  login: (account: UserAccount, token: string) => void;
  loginAsAdmin: (pin: string) => void;
  logout: () => void;
  isAuthenticated: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [activeAccount, setActiveAccount] = useState<UserAccount | null>(null);
  const [authSessionToken, setSessionToken] = useState<string | null>(null);
  const [adminPin, setAdminPin] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("adminPin");
    }
    return null;
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedToken = localStorage.getItem("authSessionToken");
      const storedAccount = localStorage.getItem("activeAccount");
      if (storedToken && storedAccount) {
        try {
          setSessionToken(storedToken);
          setActiveAccount(JSON.parse(storedAccount));
        } catch (e) {
          console.error("Failed to parse stored auth", e);
        }
      }
    }
  }, []);

  const login = (account: UserAccount, token: string) => {
    setActiveAccount(account);
    setSessionToken(token);
    if (typeof window !== "undefined") {
      localStorage.setItem("authSessionToken", token);
      localStorage.setItem("activeAccount", JSON.stringify(account));
    }
  };

  const loginAsAdmin = (pin: string) => {
    setAdminPin(pin);
    const adminAccount: UserAccount = {
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

  const logout = () => {
    setActiveAccount(null);
    setSessionToken(null);
    setAdminPin(null);
    if (typeof window !== "undefined") {
      localStorage.removeItem("authSessionToken");
      localStorage.removeItem("activeAccount");
      localStorage.removeItem("adminPin");
      localStorage.removeItem("admin_auto_login");
    }
  };

  const isAuthenticated = !!activeAccount;
  const isAdmin = activeAccount?.id === "admin" || activeAccount?.email === "admin@forooms.app";

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
