"use client";

import React, { useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import {
  Shield,
  KeyRound,
  UserCheck,
  X,
  RefreshCw,
  Check,
  User,
  Crown
} from "lucide-react";

interface AuthLoginModalProps {
  apiBaseUrl: string;
  isOpen: boolean;
  onClose: () => void;
  currentRole: string;
  currentUsername: string;
  onLoginSuccess: (token: string, user: { username: string; role: string; full_name: string }) => void;
}

export const AuthLoginModal: React.FC<AuthLoginModalProps> = ({
  apiBaseUrl,
  isOpen,
  onClose,
  currentRole,
  currentUsername,
  onLoginSuccess,
}) => {
  const [activeTab, setActiveTab] = useState<"roles" | "custom">("roles");
  const [username, setUsername] = useState<string>("admin");
  const [password, setPassword] = useState<string>("admin123");
  const [loading, setLoading] = useState<boolean>(false);

  const demoAccounts = [
    {
      role: "Investigator",
      username: "investigator",
      password: "investigator123",
      name: "Field Investigator",
      badge: "Masked PII",
      color: "border-blue-200 bg-blue-50/50 hover:bg-blue-50 text-blue-900",
      activeRing: "ring-2 ring-blue-500 border-blue-400 bg-blue-50/80",
      badgeColor: "bg-blue-100 text-blue-800",
      icon: User,
    },
    {
      role: "Supervisor",
      username: "supervisor",
      password: "supervisor123",
      name: "Case Supervisor",
      badge: "Full PII & AI",
      color: "border-purple-200 bg-purple-50/50 hover:bg-purple-50 text-purple-900",
      activeRing: "ring-2 ring-purple-500 border-purple-400 bg-purple-50/80",
      badgeColor: "bg-purple-100 text-purple-800",
      icon: UserCheck,
    },
    {
      role: "Admin",
      username: "admin",
      password: "admin123",
      name: "System Admin",
      badge: "Full Access",
      color: "border-amber-200 bg-amber-50/50 hover:bg-amber-50 text-amber-900",
      activeRing: "ring-2 ring-amber-500 border-amber-400 bg-amber-50/80",
      badgeColor: "bg-amber-100 text-amber-800",
      icon: Crown,
    },
  ];

  const handleLogin = async (u = username, p = password) => {
    setLoading(true);
    try {
      const res = await axios.post(`${apiBaseUrl}/api/v1/auth/login`, {
        username: u,
        password: p,
      });

      if (res.data?.access_token) {
        localStorage.setItem("mha_token", res.data.access_token);
        localStorage.setItem("mha_user", JSON.stringify(res.data.user));
        axios.defaults.headers.common["Authorization"] = `Bearer ${res.data.access_token}`;
        toast.success(`Role switched to ${res.data.user?.role}`, {
          description: `Active as ${res.data.user?.full_name} (${res.data.user?.username})`,
        });
        onLoginSuccess(res.data.access_token, res.data.user);
        onClose();
      }
    } catch (err: any) {
      toast.error("Authentication Failed", {
        description: err.response?.data?.detail || "Invalid credentials.",
      });
    } finally {
      setLoading(false);
    }
  };

  const selectDemoRole = (acc: typeof demoAccounts[0]) => {
    setUsername(acc.username);
    setPassword(acc.password);
    handleLogin(acc.username, acc.password);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
        {/* Compact Clean Header */}
        <div className="p-4 px-5 border-b border-slate-100 flex items-center justify-between bg-white">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-900 shrink-0">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Access Control & Role Switch</h3>
              <p className="text-[11px] text-slate-500">Select an officer role to test RBAC permissions</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="p-3 px-5 bg-slate-50/70 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center bg-slate-200/70 p-0.5 rounded-lg text-xs font-semibold">
            <button
              onClick={() => setActiveTab("roles")}
              className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                activeTab === "roles"
                  ? "bg-white text-slate-900 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              1-Click Switch
            </button>
            <button
              onClick={() => setActiveTab("custom")}
              className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                activeTab === "custom"
                  ? "bg-white text-slate-900 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Custom Login
            </button>
          </div>

          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-400 text-[11px]">Active:</span>
            <span className="font-bold text-slate-800 text-xs">{currentRole || "Admin"}</span>
          </div>
        </div>

        {/* Body Content */}
        <div className="p-5">
          {activeTab === "roles" ? (
            <div className="space-y-2.5">
              {demoAccounts.map((acc) => {
                const IconComp = acc.icon;
                const isActive = (currentRole.toLowerCase() === acc.role.toLowerCase());
                return (
                  <button
                    key={acc.username}
                    onClick={() => selectDemoRole(acc)}
                    disabled={loading}
                    className={`w-full p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                      isActive ? acc.activeRing : acc.color
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        isActive ? "bg-slate-900 text-white" : "bg-white border border-slate-200 text-slate-700"
                      }`}>
                        <IconComp className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                          {acc.name}
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${acc.badgeColor}`}>
                            {acc.badge}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                          {acc.username}
                        </div>
                      </div>
                    </div>

                    {isActive ? (
                      <span className="text-[11px] font-bold text-emerald-700 flex items-center gap-1 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-200">
                        <Check className="w-3 h-3" /> Active
                      </span>
                    ) : (
                      <span className="text-[11px] font-semibold text-slate-500 bg-white px-2 py-1 rounded-md border border-slate-200">
                        Switch →
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900 transition-all"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900 transition-all"
                />
              </div>

              <button
                onClick={() => handleLogin()}
                disabled={loading}
                className="w-full mt-2 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 shadow-xs disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Authenticating...
                  </>
                ) : (
                  <>
                    <KeyRound className="w-3.5 h-3.5" />
                    Sign In
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
