import React, { useState } from "react";
import {
  Shield,
  Lock,
  Mail,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Eye,
  EyeOff,
  ArrowLeft,
  Copy,
  Check,
  UserCheck,
  ExternalLink
} from "lucide-react";
import { User } from "../../types";
import {
  signInWithPassword,
  signInWithGoogle,
  profileToAppUser,
  getFreshUserProfile,
  fetchOrCreateProfile
} from "../../services/supabaseAuthService";
import { getSupabaseClient } from "../../lib/supabaseClient";

interface AdminAuthGateProps {
  currentUser?: User | null;
  onAuthenticated?: (user: User) => void;
  onBackToSite: () => void;
  onRefreshRole?: () => Promise<void>;
  onNavigateToLogin?: () => void;
}

export const AdminAuthGate: React.FC<AdminAuthGateProps> = ({
  currentUser,
  onAuthenticated,
  onBackToSite,
  onRefreshRole,
  onNavigateToLogin,
}) => {
  // Login form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Refresh role state (for signed-in citizens checking promotion)
  const [isRefreshingRole, setIsRefreshingRole] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);

  // Handle Admin Sign In with Email & Password
  const handleAdminSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      setErrorMessage("Please enter a valid official email address.");
      return;
    }
    if (!password) {
      setErrorMessage("Please enter your administrator password.");
      return;
    }

    setLoading(true);
    try {
      const res = await signInWithPassword(cleanEmail, password);
      if (!res.success || !res.data) {
        setErrorMessage(res.error || "Authentication failed. Please verify your credentials.");
        return;
      }

      const profile = res.data.profile;
      if (profile.role !== "admin") {
        setErrorMessage(
          `Access Denied: Account "${cleanEmail}" is registered as "citizen". Only users with "admin" role in Supabase profiles can access the Admin Portal.`
        );
        return;
      }

      const appUser = profileToAppUser(profile);
      setSuccessMessage("Administrator privileges verified. Loading Operations Console...");
      if (onAuthenticated) {
        setTimeout(() => {
          onAuthenticated(appUser);
        }, 500);
      }
    } catch (err: any) {
      setErrorMessage(err.message || "An unexpected error occurred during admin sign-in.");
    } finally {
      setLoading(false);
    }
  };

  // Handle Admin Sign In with Google OAuth
  const handleGoogleSignIn = async () => {
    setErrorMessage(null);
    setGoogleLoading(true);
    try {
      const res = await signInWithGoogle();
      if (!res.success) {
        setErrorMessage(res.error || "Google Sign-In failed.");
        setGoogleLoading(false);
      }
      // On success, browser redirects to Google OAuth flow and returns to origin
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to initialize Google Sign-In.");
      setGoogleLoading(false);
    }
  };

  // Handle manual role re-check (for users who just executed the SQL in Supabase)
  const handleRecheckRole = async () => {
    setIsRefreshingRole(true);
    setRefreshMessage(null);
    try {
      const freshProfile = await getFreshUserProfile();
      if (freshProfile) {
        if (freshProfile.role === "admin") {
          setRefreshMessage("Role promoted to Administrator! Granting access...");
          const updatedUser = profileToAppUser(freshProfile);
          if (onRefreshRole) {
            await onRefreshRole();
          }
          if (onAuthenticated) {
            onAuthenticated(updatedUser);
          }
          return;
        } else {
          setRefreshMessage(
            "Account role in Supabase is still 'citizen'. Ensure you ran the SQL command in your Supabase Dashboard SQL Editor and click re-check again."
          );
        }
      } else {
        setRefreshMessage("Could not retrieve profile from Supabase. Please ensure your database is reachable.");
      }
    } catch (err: any) {
      setRefreshMessage("Error checking profile: " + (err.message || "Unknown error"));
    } finally {
      setIsRefreshingRole(false);
    }
  };

  // Copy SQL snippet for user convenience
  const handleCopySql = (userEmailToPromote: string) => {
    const targetEmail = userEmailToPromote || "ishaansri08@gmail.com";
    const sql = `-- 1. Add role & email columns if not present
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'citizen' CHECK (role IN ('citizen', 'admin'));
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;

-- 2. Backfill profile from auth.users if profiles table is empty
INSERT INTO public.profiles (id, full_name, email, role)
SELECT id, COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', split_part(email, '@', 1)), email, 'citizen'
FROM auth.users
WHERE email = '${targetEmail}'
ON CONFLICT (id) DO NOTHING;

-- 3. Promote account to administrator
UPDATE public.profiles
SET role = 'admin'
WHERE id IN (SELECT id FROM auth.users WHERE email = '${targetEmail}')
   OR email = '${targetEmail}';`;
    navigator.clipboard.writeText(sql);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  // CASE 1: USER IS ALREADY LOGGED IN AS CITIZEN -> ACCESS DENIED SCREEN
  if (currentUser && currentUser.role === "citizen") {
    const userEmail = currentUser.email || "";

    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 sm:p-6 bg-slate-900/95 py-12 text-slate-100">
        <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
          {/* Background Ambient Glow */}
          <div className="absolute -top-24 -right-24 w-60 h-60 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-60 h-60 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Navigation Bar */}
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-800">
            <button
              onClick={onBackToSite}
              className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Return to Citizen Portal</span>
            </button>

            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-300 bg-rose-950/80 border border-rose-800/80 px-2.5 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
              Access Denied
            </span>
          </div>

          {/* Shield Badge & Title */}
          <div className="text-center mb-6">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-rose-600 via-rose-700 to-indigo-900 text-white mx-auto flex items-center justify-center shadow-lg shadow-rose-950/40 mb-3 border border-rose-500/30">
              <Shield className="w-7 h-7 text-rose-200" />
            </div>
            <h2 className="font-heading text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Administrator Privileges Required
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-md mx-auto leading-relaxed">
              Access to the CivicFix Municipal Console is restricted to authenticated administrator accounts.
            </p>
          </div>

          {/* Authenticated Identity Card */}
          <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl p-4 mb-5 space-y-3">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Your Authenticated Identity
            </div>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-700 flex items-center justify-center font-bold text-sm text-teal-300 border border-slate-600">
                  {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : "U"}
                </div>
                <div>
                  <div className="font-bold text-sm text-white">{currentUser.name || "Civic Citizen"}</div>
                  <div className="text-xs text-slate-400 font-mono">{userEmail || "No email"}</div>
                </div>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Assigned Role</span>
                <span className="inline-block px-2.5 py-0.5 rounded-md text-xs font-mono font-bold bg-amber-950/80 text-amber-300 border border-amber-800/80">
                  citizen
                </span>
              </div>
            </div>
          </div>

          {/* Explanation and SQL Promotion Guide */}
          <div className="space-y-4">
            <div className="p-3.5 rounded-2xl bg-slate-800/60 border border-slate-700/60 text-xs text-slate-300 space-y-2">
              <div className="font-semibold text-white flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-teal-400" />
                <span>How to activate your Administrator role:</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                CivicFix reads your role directly from the <strong>public.profiles</strong> table in Supabase.
                To promote this account to administrator, run the following SQL command in your <strong>Supabase Dashboard SQL Editor</strong>:
              </p>

              {/* Code Snippet */}
              <div className="relative bg-slate-950 border border-slate-800 rounded-xl p-3 font-mono text-[11px] text-teal-300">
                <pre className="overflow-x-auto whitespace-pre">
{`-- 1. Ensure role & email columns exist in public.profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'citizen' CHECK (role IN ('citizen', 'admin'));
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;

-- 2. Backfill profile if table is empty
INSERT INTO public.profiles (id, full_name, email, role)
SELECT id, COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', split_part(email, '@', 1)), email, 'citizen'
FROM auth.users
WHERE email = '${userEmail || "ishaansri08@gmail.com"}'
ON CONFLICT (id) DO NOTHING;

-- 3. Promote account to administrator
UPDATE public.profiles
SET role = 'admin'
WHERE id IN (SELECT id FROM auth.users WHERE email = '${userEmail || "ishaansri08@gmail.com"}')
   OR email = '${userEmail || "ishaansri08@gmail.com"}';`}
                </pre>
                <button
                  type="button"
                  onClick={() => handleCopySql(userEmail)}
                  className="absolute top-2 right-2 p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer flex items-center gap-1 text-[10px]"
                  title="Copy SQL to Clipboard"
                >
                  {copiedSql ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Refresh Feedback Message */}
            {refreshMessage && (
              <div className={`p-3 rounded-xl text-xs flex items-center gap-2 border ${
                refreshMessage.includes("promoted") || refreshMessage.includes("Granting")
                  ? "bg-emerald-950/70 border-emerald-800 text-emerald-200"
                  : "bg-amber-950/70 border-amber-800 text-amber-200"
              }`}>
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{refreshMessage}</span>
              </div>
            )}

            {/* Primary Action Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={handleRecheckRole}
                disabled={isRefreshingRole}
                className="w-full bg-gradient-to-r from-teal-600 to-indigo-600 hover:from-teal-500 hover:to-indigo-500 text-white font-bold text-xs py-3 px-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshingRole ? "animate-spin" : ""}`} />
                <span>{isRefreshingRole ? "Checking Supabase..." : "Re-check Role in Supabase"}</span>
              </button>

              <button
                type="button"
                onClick={onBackToSite}
                className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs py-3 px-4 rounded-xl border border-slate-700 transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Return to Citizen Dashboard</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Footer Security Notice */}
          <div className="mt-6 pt-4 border-t border-slate-800 text-center text-[10px] text-slate-500 flex items-center justify-center gap-1.5">
            <Lock className="w-3 h-3 text-slate-400" />
            <span>Supabase Role-Based Access Control Active • Table: public.profiles</span>
          </div>
        </div>
      </div>
    );
  }

  // CASE 2: USER IS NOT LOGGED IN -> CLEAN ADMIN SIGN-IN PORTAL
  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 sm:p-6 bg-slate-900/95 py-12 text-slate-100">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        {/* Background Ambient Glow */}
        <div className="absolute -top-24 -right-24 w-60 h-60 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-60 h-60 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Top Header Ribbon */}
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-800">
          <button
            onClick={onBackToSite}
            className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Citizen Portal</span>
          </button>

          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-teal-300 bg-teal-950/80 border border-teal-800/80 px-2.5 py-0.5 rounded-full">
            <Shield className="w-3 h-3 text-teal-400" />
            Supabase RBAC
          </span>
        </div>

        {/* Brand Icon & Heading */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-teal-600 via-indigo-600 to-indigo-800 text-white mx-auto flex items-center justify-center shadow-lg shadow-indigo-900/40 mb-3 border border-slate-700">
            <Shield className="w-7 h-7 text-teal-200" />
          </div>
          <h2 className="font-heading text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Municipal Admin Portal
          </h2>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto leading-relaxed">
            Sign in with your administrator account to access civic complaint oversight, dispatch teams, and update resolution statuses.
          </p>
        </div>

        {/* Error / Success Notifications */}
        {errorMessage && (
          <div className="mb-4 p-3 rounded-xl bg-rose-950/80 border border-rose-800/80 text-rose-200 text-xs flex items-start gap-2 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-950/80 border border-emerald-800/80 text-emerald-200 text-xs flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Google OAuth Button */}
        <div className="space-y-4">
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={googleLoading || loading}
            className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl bg-white hover:bg-slate-100 text-slate-800 font-bold text-xs transition-colors shadow-md cursor-pointer disabled:opacity-50"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>{googleLoading ? "Connecting to Google..." : "Continue with Google (Admin Account)"}</span>
          </button>

          {/* Divider */}
          <div className="relative flex items-center justify-center">
            <div className="border-t border-slate-800 w-full" />
            <span className="bg-slate-900 px-3 text-[11px] text-slate-500 font-semibold uppercase tracking-wider">
              Or Sign In with Email
            </span>
          </div>

          {/* Email + Password Form */}
          <form onSubmit={handleAdminSignIn} className="space-y-3.5">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Admin Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@civicfix.org or your registered email"
                  className="w-full bg-slate-800/90 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder:text-slate-500 outline-none focus:border-teal-400 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter administrator password"
                  className="w-full bg-slate-800/90 border border-slate-700 rounded-xl pl-9 pr-10 py-2 text-xs text-white placeholder:text-slate-500 outline-none focus:border-teal-400 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || googleLoading}
              className="w-full mt-2 bg-gradient-to-r from-teal-600 via-indigo-600 to-indigo-700 hover:from-teal-500 hover:to-indigo-600 text-white font-bold text-xs py-3 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Shield className="w-4 h-4" />
              <span>{loading ? "Authenticating Admin..." : "Sign In to Admin Console"}</span>
            </button>
          </form>

          {/* Info Notice */}
          <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-800 text-[11px] text-slate-400 leading-relaxed">
            <span className="font-semibold text-slate-300">Note on Role System:</span> Authentication is powered directly by Supabase. Only users whose record in <code>public.profiles</code> has <code>role = 'admin'</code> will be granted access. Ordinary citizen accounts will be directed to the citizen portal.
          </div>
        </div>

        {/* Footer Security Notice */}
        <div className="mt-6 pt-4 border-t border-slate-800 text-center text-[10px] text-slate-500 flex items-center justify-center gap-1.5">
          <Lock className="w-3 h-3 text-slate-400" />
          <span>Restricted GovTech Administration Access • Supabase RBAC</span>
        </div>
      </div>
    </div>
  );
};
