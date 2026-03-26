"use client";

import { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";

export default function SettingsPage() {
  // ── SMS Forwarding ──────────────────────────────────────────────
  const [forwardingEnabled, setForwardingEnabled] = useState(false);
  const [forwardPhone, setForwardPhone] = useState("");
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [settingsError, setSettingsError] = useState("");

  // ── Create Account ──────────────────────────────────────────────
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createResult, setCreateResult] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    fetch("/api/agent/settings")
      .then((r) => r.json())
      .then((json) => {
        if (json.success && json.data) {
          setForwardingEnabled(json.data.forwardingEnabled ?? false);
          setForwardPhone(json.data.forwardPhone ?? "");
        }
      })
      .catch(() => {});
  }, []);

  async function saveForwarding() {
    setSettingsSaving(true);
    setSettingsSaved(false);
    setSettingsError("");
    try {
      const res = await fetch("/api/agent/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ forwardPhone, forwardingEnabled }),
      });
      const data = await res.json();
      if (data.success) {
        setForwardingEnabled(data.data.forwardingEnabled);
        setForwardPhone(data.data.forwardPhone ?? "");
        setSettingsSaved(true);
        setTimeout(() => setSettingsSaved(false), 3000);
      } else {
        setSettingsError(data.error || "Failed to save");
      }
    } catch {
      setSettingsError("Network error");
    } finally {
      setSettingsSaving(false);
    }
  }

  async function handleCreateAccount(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setCreateResult(null);
    try {
      const res = await fetch("/api/agent/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName, email: newEmail, password: newPassword }),
      });
      const data = await res.json();
      if (data.success) {
        setCreateResult({ type: "success", message: `✅ Account created for ${data.data.name} (${data.data.email})` });
        setNewName("");
        setNewEmail("");
        setNewPassword("");
      } else {
        setCreateResult({ type: "error", message: `❌ ${data.error}` });
      }
    } catch {
      setCreateResult({ type: "error", message: "❌ Network error. Please try again." });
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-950">
      <Sidebar />
      <main className="lg:ml-64 p-6 pt-16 lg:pt-6 min-h-screen">
        <h1 className="text-2xl font-bold text-white mb-1">Settings</h1>
        <p className="text-gray-400 text-sm mb-8">Manage your account and notification preferences.</p>

        <div className="max-w-lg space-y-8">

          {/* ── SMS Forwarding ── */}
          <section className="bg-gray-900 rounded-xl border border-gray-800 p-6 space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-white">SMS Forwarding</h2>
              <p className="text-sm text-gray-400 mt-1">
                Forward a copy of every inbound client text to your personal phone.
              </p>
            </div>

            {/* Toggle */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-300">Forward inbound texts</span>
              <button
                onClick={() => setForwardingEnabled((v) => !v)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                  forwardingEnabled ? "bg-blue-600" : "bg-gray-700"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    forwardingEnabled ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            {/* Phone input */}
            <div>
              <label className="block text-xs text-gray-400 mb-1">Forward to phone number</label>
              <input
                type="tel"
                value={forwardPhone}
                onChange={(e) => setForwardPhone(e.target.value)}
                placeholder="e.g. 19195551234"
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
              <p className="text-xs text-gray-500 mt-1">Include country code, no + (e.g. 19195551234)</p>
            </div>

            {settingsError && <p className="text-sm text-red-400">{settingsError}</p>}

            <div className="flex items-center gap-3">
              <button
                onClick={saveForwarding}
                disabled={settingsSaving}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg text-sm font-medium text-white transition"
              >
                {settingsSaving ? "Saving..." : "Save"}
              </button>
              {settingsSaved && <span className="text-sm text-green-400">✓ Saved</span>}
            </div>
          </section>

          {/* ── Create New Account ── */}
          <section className="bg-gray-900 rounded-xl border border-gray-800 p-6 space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-white">Create New Account</h2>
              <p className="text-sm text-gray-400 mt-1">
                Add a new agent who can log in and manage their own contacts.
              </p>
            </div>

            <form onSubmit={handleCreateAccount} className="space-y-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Full Name</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Jane Smith"
                  required
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">Email</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="jane@example.com"
                  required
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min. 8 characters"
                    required
                    minLength={8}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200"
                  >
                    {showPassword ? (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {createResult && (
                <div className={`p-3 rounded-lg text-sm ${
                  createResult.type === "success"
                    ? "bg-green-900/30 border border-green-700 text-green-300"
                    : "bg-red-900/30 border border-red-700 text-red-300"
                }`}>
                  {createResult.message}
                </div>
              )}

              <button
                type="submit"
                disabled={creating}
                className="w-full py-2.5 bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition text-sm"
              >
                {creating ? "Creating..." : "Create Account"}
              </button>
            </form>
          </section>

        </div>
      </main>
    </div>
  );
}
