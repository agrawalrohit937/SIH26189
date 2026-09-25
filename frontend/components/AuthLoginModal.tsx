"use client";

import React, { useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import {
  Shield,
  KeyRound,
  UserCheck,
  Lock,
  X,
  RefreshCw,
  CheckCircle2,
  ShieldAlert,
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
  const [username, setUsername] = useState<string>("admin");
  const [password, setPassword] = useState<string>("admin123");
  const [loading, setLoading] = useState<boolean>(false);

  const demoAccounts = [
    {
      role: "Investigator",
      username: "investigator",
      password: "investigator123",
      title: "Field Investigator (Restricted RBAC)",
      desc: "Masked PII for privacy compliance, read-only case analysis. Purge operations blocked (HTTP 403).",
      badgeColor: "bg-blue-100 text-blue-800 border-blue-200",
      icon: User,
    },
    {
      role: "Supervisor",
      username: "supervisor",
      password: "supervisor123",
      title: "Case Supervisor (Operational RBAC)",
      desc: "Full unmasked PII, active learning feedback confirmation, multi-source evidence synthesis.",
      badgeColor: "bg-purple-100 text-purple-800 border-purple-200",
      icon: UserCheck,
    },
    {
      role: "Admin",
      username: "admin",
      password: "admin123",
      title: "Lead Intelligence Admin (Full RBAC)",
      desc: "Full system administration, database purge rights, immutable audit ledger blockchain verification.",
      badgeColor: "bg-amber-100 text-amber-800 border-amber-200",
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
        toast.success(`Authenticated as ${res.data.user?.role}`, {
          description: `Logged in as ${res.data.user?.full_name} (${res.data.user?.username}). RBAC permissions active.`,
        });
        onLoginSuccess(res.data.access_token, res.data.user);
        onClose();
      }
    } catch (err: any) {
      toast.error("Authentication Failed", {
        description: err.response?.data?.detail || "Invalid investigator credentials.",
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-300">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold tracking-wide">National Intelligence Grid Authentication</h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-400/20 border border-blue-400/40 text-blue-200">
                  RBAC
                </span>
              </div>
              <p className="text-xs text-slate-300">Role-Based Access Control session manager</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Current Active Session Status */}
        <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
          <span className="text-slate-600">Current Session:</span>
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-900">{currentUsername || "admin"}</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 border border-amber-300 text-amber-800">
              {currentRole || "Admin"}
            </span>
          </div>
        </div>

        {/* 1-Click Demo Accounts */}
        <div className="p-4 space-y-2.5">
          <label className="text-[11px] font-bold text-slate-600 block uppercase tracking-wide">
            1-Click Demonstration Roles (Official Ministry Credentials)
          </label>

          {demoAccounts.map((acc) => {
            const IconComponent = acc.icon;
            const isActive = (currentRole.toLowerCase() === acc.role.toLowerCase());
            return (
              <button
                key={acc.username}
                onClick={() => selectDemoRole(acc)}
                disabled={loading}
                className={`w-full p-3 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-3 ${
                  isActive
                    ? "bg-blue-50/70 border-blue-300 ring-1 ring-blue-300"
                    : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 shrink-0 mt-0.5">
                  <IconComponent className="w-4 h-4 text-blue-900" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900">{acc.title}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${acc.badgeColor}`}>
                      {acc.role}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{acc.desc}</p>
                  <div className="text-[10px] font-mono text-slate-400 mt-1">
                    Credentials: <code>{acc.username}</code> / <code>{acc.password}</code>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Manual Login Fallback */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-bold text-slate-600 block mb-1">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-900"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-600 block mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-900"
              />
            </div>
          </div>

          <button
            onClick={() => handleLogin()}
            disabled={loading}
            className="w-full py-2 rounded-lg bg-blue-900 hover:bg-blue-800 text-white text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
          >
            {loading ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Authenticating Session...
              </>
            ) : (
              <>
                <KeyRound className="w-3.5 h-3.5" />
                Authenticate Session
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
