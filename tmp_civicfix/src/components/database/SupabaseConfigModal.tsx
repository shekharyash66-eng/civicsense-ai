import React, { useState, useEffect } from "react";
import {
  getSupabaseConfig,
  saveSupabaseConfig,
  DEFAULT_SUPABASE_PROJECT_ID,
  DEFAULT_SUPABASE_URL,
  DEFAULT_SUPABASE_KEY,
  SUPABASE_SQL_SCHEMA,
  SupabaseConfig,
} from "../../lib/supabaseClient";
import {
  testSupabaseConnection,
  syncAllLocalReportsToSupabase,
  fetchReportsFromSupabase,
  SupabaseSyncStatus,
} from "../../services/supabaseService";
import { getStoredComplaints, saveComplaints } from "../../services/complaintService";
import {
  Database,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Copy,
  Check,
  X,
  ExternalLink,
  ShieldCheck,
  Cloud,
  Layers,
  ArrowRight,
} from "lucide-react";

interface SupabaseConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSyncCompleted?: () => void;
}

export const SupabaseConfigModal: React.FC<SupabaseConfigModalProps> = ({
  isOpen,
  onClose,
  onSyncCompleted,
}) => {
  const [config, setConfig] = useState<SupabaseConfig>(getSupabaseConfig());
  const [projectId, setProjectId] = useState(config.projectId || DEFAULT_SUPABASE_PROJECT_ID);
  const [supabaseUrl, setSupabaseUrl] = useState(config.url || DEFAULT_SUPABASE_URL);
  const [supabaseKey, setSupabaseKey] = useState(config.key || DEFAULT_SUPABASE_KEY);

  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [status, setStatus] = useState<SupabaseSyncStatus | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [tab, setTab] = useState<"status" | "schema" | "settings">("status");

  useEffect(() => {
    if (isOpen) {
      const currentConfig = getSupabaseConfig();
      setConfig(currentConfig);
      setProjectId(currentConfig.projectId || DEFAULT_SUPABASE_PROJECT_ID);
      setSupabaseUrl(currentConfig.url || DEFAULT_SUPABASE_URL);
      setSupabaseKey(currentConfig.key || DEFAULT_SUPABASE_KEY);
      handleTestConnection();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTestConnection = async () => {
    setTesting(true);
    setStatus(null);
    try {
      const result = await testSupabaseConnection();
      setStatus(result);
    } catch (err: any) {
      setStatus({
        connected: false,
        tableExists: false,
        message: err.message || "Failed to test connection",
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    const updated = saveSupabaseConfig({
      url: supabaseUrl.trim(),
      key: supabaseKey.trim(),
      projectId: projectId.trim(),
      enabled: true,
    });
    setConfig(updated);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
    handleTestConnection();
  };

  const handleSyncAll = async () => {
    setSyncing(true);
    try {
      const local = getStoredComplaints();
      const res = await syncAllLocalReportsToSupabase(local);
      if (res.successCount > 0) {
        // Also fetch any remote reports and merge
        const remote = await fetchReportsFromSupabase();
        if (remote.success && remote.reports.length > 0) {
          const merged = [...local];
          remote.reports.forEach((r) => {
            if (!merged.some((m) => m.id === r.id)) {
              merged.unshift(r);
            }
          });
          saveComplaints(merged);
        }
        onSyncCompleted?.();
      }
      handleTestConnection();
    } catch (e) {
      console.warn("Sync failed", e);
    } finally {
      setSyncing(false);
    }
  };

  const handleCopySql = () => {
    navigator.clipboard.writeText(SUPABASE_SQL_SCHEMA);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2500);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-2xl bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-200 overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center shadow-xs">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-heading text-lg font-bold text-slate-900 flex items-center gap-2">
                <span>Supabase Database Storage</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300 uppercase tracking-wider">
                  Live Sync
                </span>
              </h3>
              <p className="text-xs text-slate-500">
                All report details, civic fixes, and timelines stored directly in your Supabase account
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 pt-4 pb-2 shrink-0">
          <button
            type="button"
            onClick={() => setTab("status")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
              tab === "status"
                ? "bg-slate-900 text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:text-slate-900"
            }`}
          >
            Connection & Sync
          </button>
          <button
            type="button"
            onClick={() => setTab("schema")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
              tab === "schema"
                ? "bg-slate-900 text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:text-slate-900"
            }`}
          >
            SQL Table Setup
          </button>
          <button
            type="button"
            onClick={() => setTab("settings")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
              tab === "settings"
                ? "bg-slate-900 text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:text-slate-900"
            }`}
          >
            Credentials & Config
          </button>
        </div>

        {/* Content Body */}
        <div className="overflow-y-auto py-3 space-y-4 flex-1 pr-1">
          {/* TAB 1: STATUS & SYNC */}
          {tab === "status" && (
            <div className="space-y-4">
              {/* Connection Status Card */}
              <div
                className={`p-4 rounded-2xl border ${
                  status?.connected
                    ? "bg-emerald-50/70 border-emerald-200 text-emerald-950"
                    : status
                    ? "bg-amber-50 border-amber-200 text-amber-950"
                    : "bg-slate-50 border-slate-200 text-slate-800"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    {testing ? (
                      <RefreshCw className="w-5 h-5 text-teal-600 animate-spin" />
                    ) : status?.connected ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                    )}
                    <div>
                      <div className="font-bold text-sm">
                        {testing
                          ? "Testing Supabase Connection..."
                          : status?.connected
                          ? "Supabase Connected & Active"
                          : "Connecting to Supabase Project"}
                      </div>
                      <div className="text-xs opacity-80 mt-0.5">
                        Project ID: <code className="font-mono font-bold">{projectId}</code>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleTestConnection}
                    disabled={testing}
                    className="px-3 py-1.5 bg-white/90 hover:bg-white text-slate-800 text-xs font-semibold rounded-xl border border-slate-200/80 shadow-2xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${testing ? "animate-spin" : ""}`} />
                    <span>{testing ? "Testing..." : "Test"}</span>
                  </button>
                </div>

                {status?.message && (
                  <p className="text-xs mt-3 pt-2.5 border-t border-slate-200/60 leading-relaxed">
                    {status.message}
                  </p>
                )}
              </div>

              {/* Real-time Storage Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
                  <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px] block mb-1">
                    Supabase Project URL
                  </span>
                  <span className="font-mono text-slate-800 font-medium break-all">
                    {supabaseUrl}
                  </span>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
                  <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px] block mb-1">
                    Target Data Table
                  </span>
                  <span className="font-bold text-slate-800 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-teal-600" />
                    <code>public.reports</code>
                  </span>
                </div>
              </div>

              {/* Sync Actions Card */}
              <div className="p-4 bg-slate-900 text-white rounded-2xl shadow-md space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-sm flex items-center gap-2">
                      <Cloud className="w-4 h-4 text-emerald-400" />
                      <span>Sync All Local Reports to Supabase</span>
                    </h4>
                    <p className="text-xs text-slate-300 mt-0.5">
                      Uploads all civic complaints & triage timelines to your cloud database table.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleSyncAll}
                    disabled={syncing}
                    className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
                    <span>{syncing ? "Syncing..." : "Sync Now"}</span>
                  </button>
                </div>

                <div className="text-[11px] text-slate-400 flex items-center gap-2 pt-1 border-t border-slate-800">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>
                    New reports submitted by citizens are automatically saved to Supabase in real time.
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: SQL SCHEMA */}
          {tab === "schema" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-xs text-slate-800">
                    Supabase PostgreSQL Table Schema
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    If the table does not exist yet, copy and execute this script in your Supabase SQL Editor.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCopySql}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  {copiedSql ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-700">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy SQL</span>
                    </>
                  )}
                </button>
              </div>

              <div className="relative">
                <pre className="p-3.5 bg-slate-900 text-slate-100 text-[11px] font-mono rounded-2xl overflow-x-auto max-h-56 leading-relaxed border border-slate-800">
                  {SUPABASE_SQL_SCHEMA}
                </pre>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-600 pt-1">
                <span>Quick link to Supabase console:</span>
                <a
                  href={`https://supabase.com/dashboard/project/${projectId}/sql`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-teal-600 hover:text-teal-700 font-bold inline-flex items-center gap-1"
                >
                  <span>Open SQL Editor</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          )}

          {/* TAB 3: CREDENTIALS & CONFIG */}
          {tab === "settings" && (
            <form onSubmit={handleSaveSettings} className="space-y-4">
              {saveSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span>Supabase credentials saved and active!</span>
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Supabase Project ID
                  </label>
                  <input
                    type="text"
                    required
                    value={projectId}
                    onChange={(e) => {
                      setProjectId(e.target.value);
                      setSupabaseUrl(`https://${e.target.value.trim()}.supabase.co`);
                    }}
                    placeholder="e.g. tnrkddekmrylxmnosrsg"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-mono outline-none focus:bg-white focus:border-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Supabase Project URL
                  </label>
                  <input
                    type="url"
                    required
                    value={supabaseUrl}
                    onChange={(e) => setSupabaseUrl(e.target.value)}
                    placeholder="https://tnrkddekmrylxmnosrsg.supabase.co"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-mono outline-none focus:bg-white focus:border-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Supabase API Key (Publishable / Anon Key)
                  </label>
                  <input
                    type="password"
                    required
                    value={supabaseKey}
                    onChange={(e) => setSupabaseKey(e.target.value)}
                    placeholder="sb_publishable_..."
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-mono outline-none focus:bg-white focus:border-teal-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="submit"
                  className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-md transition-all cursor-pointer"
                >
                  Save Supabase Settings
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between shrink-0">
          <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Connected to project <strong className="text-slate-700">{projectId}</strong></span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
