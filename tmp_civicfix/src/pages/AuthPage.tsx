import React, { useState } from "react";
import { User, UserProfile } from "../types";
import {
  signUpCitizen,
  signInWithPassword,
  signInWithEmailOtp,
  verifyEmailOtp,
  signInWithPhoneOtp,
  verifyPhoneOtp,
  signInWithGoogle,
  resetPasswordForEmail,
  updateUserPassword,
  profileToAppUser,
} from "../services/supabaseAuthService";
import { setActiveUser } from "../services/complaintService";
import { getCurrentCoordinates, reverseGeocode } from "../services/locationService";
import {
  MapPin,
  Shield,
  ArrowRight,
  User as UserIcon,
  Lock,
  Mail,
  Phone,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  KeyRound,
  Eye,
  EyeOff,
  RefreshCw,
  Info,
  ChevronLeft,
  Navigation,
  Building2,
  Compass,
} from "lucide-react";

const POPULAR_INDIAN_CITIES = [
  { name: "Lucknow", state: "UP" },
  { name: "New Delhi", state: "DL" },
  { name: "Bengaluru", state: "KA" },
  { name: "Mumbai", state: "MH" },
  { name: "Pune", state: "MH" },
  { name: "Hyderabad", state: "TS" },
  { name: "Jaipur", state: "RJ" },
  { name: "Kolkata", state: "WB" },
  { name: "Kanpur", state: "UP" },
  { name: "Patna", state: "BR" },
];

export type AuthViewMode =
  | "login"
  | "register"
  | "email_otp"
  | "phone_otp"
  | "forgot_password"
  | "reset_password";

interface AuthPageProps {
  onSuccess: (user: User) => void;
  initialMode?: AuthViewMode;
  onNavigateToAdmin?: () => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({
  onSuccess,
  initialMode = "login",
  onNavigateToAdmin,
}) => {
  const [viewMode, setViewMode] = useState<AuthViewMode>(initialMode);

  // Form Fields
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [city, setCity] = useState("Lucknow");
  const [ward, setWard] = useState("Zone 01 - Central");
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [detectedLocationStatus, setDetectedLocationStatus] = useState<string | null>(null);
  const [otpToken, setOtpToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

  // UI States
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [otpSent, setOtpSent] = useState(false);

  const clearNotifications = () => {
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  const handleDetectLocation = async () => {
    setIsDetectingLocation(true);
    setDetectedLocationStatus(null);
    try {
      const coords = await getCurrentCoordinates();
      const geo = await reverseGeocode(coords.latitude, coords.longitude);
      if (geo.city) {
        setCity(geo.city);
      } else if (geo.district) {
        setCity(geo.district);
      }
      const detectedWard =
        geo.locality ||
        geo.neighborhood ||
        (geo.formattedAddress ? geo.formattedAddress.split(",")[0]?.trim() : "");
      if (detectedWard) {
        setWard(detectedWard);
      }
      const displayCity = geo.city || geo.district || "Detected City";
      setDetectedLocationStatus(`GPS matched: ${displayCity}${detectedWard ? ` (${detectedWard})` : ""}`);
      setTimeout(() => setDetectedLocationStatus(null), 5000);
    } catch (err: any) {
      console.warn("GPS auto-detect error:", err);
      setErrorMsg("GPS auto-detection failed or permission was denied. You can choose or type your city and ward manually.");
    } finally {
      setIsDetectingLocation(false);
    }
  };

  // Switch tabs/views
  const switchView = (mode: AuthViewMode) => {
    clearNotifications();
    setViewMode(mode);
    setOtpSent(false);
    setOtpToken("");
  };

  // Password strength helper
  const getPasswordStrength = (pwd: string) => {
    if (!pwd) return { score: 0, label: "Empty", color: "bg-slate-200" };
    let score = 0;
    if (pwd.length >= 6) score += 1;
    if (pwd.length >= 8) score += 1;
    if (/[A-Z]/.test(pwd)) score += 1;
    if (/[0-9]/.test(pwd)) score += 1;
    if (/[^A-Za-z0-9]/.test(pwd)) score += 1;

    if (score <= 2) return { score, label: "Weak", color: "bg-amber-400" };
    if (score <= 4) return { score, label: "Good", color: "bg-teal-500" };
    return { score, label: "Strong", color: "bg-emerald-500" };
  };

  // ==========================================
  // 1. CITIZEN REGISTRATION (Part 3)
  // ==========================================
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    clearNotifications();

    if (!fullName.trim()) {
      setErrorMsg("Please enter your full legal name.");
      return;
    }
    if (!email.trim() || !email.includes("@")) {
      setErrorMsg("Please enter a valid email address.");
      return;
    }
    if (!phone.trim()) {
      setErrorMsg("Please provide a valid contact phone number.");
      return;
    }
    if (password.length < 6) {
      setErrorMsg("Password must be at least 6 characters long.");
      return;
    }

    setIsLoading(true);
    try {
      const res = await signUpCitizen({
        fullName,
        email,
        phone,
        password,
        city: city.trim() || undefined,
        ward: ward.trim() || undefined,
      });

      if (!res.success) {
        setErrorMsg(res.error || "Unable to register account. Please check your details.");
        return;
      }

      if (res.data?.profile) {
        const appUser = profileToAppUser(res.data.profile);
        setActiveUser(appUser);
        setSuccessMsg("Registration successful! Welcome to CivicFix.");
        setTimeout(() => {
          onSuccess(appUser);
        }, 500);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "An unexpected error occurred during signup.");
    } finally {
      setIsLoading(false);
    }
  };

  // ==========================================
  // 2. EMAIL + PASSWORD LOGIN (Part 2.A)
  // ==========================================
  const handleEmailPasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    clearNotifications();

    if (!email.trim()) {
      setErrorMsg("Please enter your email address.");
      return;
    }
    if (!password) {
      setErrorMsg("Please enter your password.");
      return;
    }

    setIsLoading(true);
    try {
      const res = await signInWithPassword(email, password);
      if (!res.success) {
        setErrorMsg(res.error || "Incorrect email or password.");
        return;
      }

      if (res.data?.profile) {
        const appUser = profileToAppUser(res.data.profile);
        setActiveUser(appUser);
        setSuccessMsg("Login successful! Redirecting to dashboard...");
        setTimeout(() => {
          onSuccess(appUser);
        }, 500);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Login failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // ==========================================
  // 3. EMAIL OTP / MAGIC LINK (Part 4)
  // ==========================================
  const handleSendEmailOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    clearNotifications();

    if (!email.trim() || !email.includes("@")) {
      setErrorMsg("Please enter a valid email address to receive your OTP.");
      return;
    }

    setIsLoading(true);
    try {
      const res = await signInWithEmailOtp(email);
      if (!res.success) {
        setErrorMsg(res.error || "Failed to dispatch email verification.");
        return;
      }
      setOtpSent(true);
      setSuccessMsg("Verification code / magic link sent to your email! Please check your inbox and spam folder.");
    } catch (err: any) {
      setErrorMsg(err.message || "Network error while sending OTP.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyEmailOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    clearNotifications();

    if (!otpToken.trim()) {
      setErrorMsg("Please enter the verification code received via email.");
      return;
    }

    setIsLoading(true);
    try {
      const res = await verifyEmailOtp(email, otpToken);
      if (!res.success) {
        setErrorMsg(res.error || "Invalid or expired OTP code. Please request a new one.");
        return;
      }

      if (res.data?.profile) {
        const appUser = profileToAppUser(res.data.profile);
        setActiveUser(appUser);
        setSuccessMsg("Email verified! Welcome to CivicFix.");
        setTimeout(() => {
          onSuccess(appUser);
        }, 500);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "OTP verification error.");
    } finally {
      setIsLoading(false);
    }
  };

  // ==========================================
  // 4. PHONE OTP AUTHENTICATION (Part 5)
  // ==========================================
  const handleSendPhoneOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    clearNotifications();

    if (!phone.trim() || phone.length < 8) {
      setErrorMsg("Please enter a valid phone number with country code (e.g. +91 98450 12345).");
      return;
    }

    setIsLoading(true);
    try {
      const res = await signInWithPhoneOtp(phone);
      if (!res.success) {
        setErrorMsg(res.error || "Failed to dispatch SMS OTP.");
        return;
      }
      setOtpSent(true);
      setSuccessMsg(`OTP sent to ${phone}. Enter the 6-digit code below.`);
    } catch (err: any) {
      setErrorMsg(err.message || "Error dispatching SMS OTP.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyPhoneOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    clearNotifications();

    if (!otpToken.trim()) {
      setErrorMsg("Please enter the 6-digit SMS verification code.");
      return;
    }

    setIsLoading(true);
    try {
      const res = await verifyPhoneOtp(phone, otpToken);
      if (!res.success) {
        setErrorMsg(res.error || "Incorrect or expired SMS OTP.");
        return;
      }

      if (res.data?.profile) {
        const appUser = profileToAppUser(res.data.profile);
        setActiveUser(appUser);
        setSuccessMsg("Phone verified successfully!");
        setTimeout(() => {
          onSuccess(appUser);
        }, 500);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Phone verification error.");
    } finally {
      setIsLoading(false);
    }
  };

  // ==========================================
  // 5. GOOGLE OAUTH LOGIN (Part 6)
  // ==========================================
  const handleGoogleLogin = async () => {
    clearNotifications();
    setIsLoading(true);
    try {
      const res = await signInWithGoogle();
      if (!res.success) {
        setErrorMsg(res.error || "Google login failed.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to initialize Google login.");
    } finally {
      setIsLoading(false);
    }
  };

  // ==========================================
  // 6. FORGOT PASSWORD (Part 22)
  // ==========================================
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    clearNotifications();

    if (!email.trim() || !email.includes("@")) {
      setErrorMsg("Please enter your registered email address.");
      return;
    }

    setIsLoading(true);
    try {
      const res = await resetPasswordForEmail(email);
      if (!res.success) {
        setErrorMsg(res.error || "Unable to send password reset email.");
        return;
      }
      setSuccessMsg("Password reset link sent! Check your email inbox to reset your password.");
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to request password reset.");
    } finally {
      setIsLoading(false);
    }
  };

  // ==========================================
  // 7. RESET PASSWORD SUBMISSION
  // ==========================================
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    clearNotifications();

    if (newPassword.length < 6) {
      setErrorMsg("New password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setErrorMsg("Passwords do not match.");
      return;
    }

    setIsLoading(true);
    try {
      const res = await updateUserPassword(newPassword);
      if (!res.success) {
        setErrorMsg(res.error || "Could not update password.");
        return;
      }
      setSuccessMsg("Password successfully updated! You can now log in with your new password.");
      setTimeout(() => {
        switchView("login");
      }, 1500);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to update password.");
    } finally {
      setIsLoading(false);
    }
  };

  const pwdStrength = getPasswordStrength(password);

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 sm:p-6 bg-slate-50/80">
      <div className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-200/80 transition-all">
        {/* Header Branding */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-teal-700 to-emerald-500 text-white mx-auto flex items-center justify-center shadow-md mb-3">
            <MapPin className="w-6 h-6" />
          </div>
          <h2 className="font-heading text-2xl sm:text-3xl font-bold text-slate-900">
            {viewMode === "login" && "Citizen Sign In"}
            {viewMode === "register" && "Create Citizen Account"}
            {viewMode === "email_otp" && "Email OTP / Magic Link"}
            {viewMode === "phone_otp" && "Phone OTP Login"}
            {viewMode === "forgot_password" && "Reset Password"}
            {viewMode === "reset_password" && "Set New Password"}
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            {viewMode === "login" && "Report issues and improve your neighborhood."}
            {viewMode === "register" && "Join CivicFix to report & track civic problems in your ward."}
            {viewMode === "email_otp" && "Passwordless sign-in with a one-time email code."}
            {viewMode === "phone_otp" && "Instant sign-in via SMS verification code."}
            {viewMode === "forgot_password" && "Enter your email to receive recovery instructions."}
            {viewMode === "reset_password" && "Create a secure new password for your account."}
          </p>
        </div>

        {/* Status Alerts */}
        {errorMsg && (
          <div className="mb-5 animate-fadeIn">
            {errorMsg.includes("SUPABASE_EMAIL_RATE_LIMIT") ? (
              <div className="p-4 bg-amber-50 border border-amber-300 text-amber-900 rounded-2xl text-xs space-y-3 shadow-xs">
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-bold text-sm text-amber-950">
                      Supabase Setup Required: Turn OFF "Confirm email"
                    </p>
                    <p className="mt-1 text-amber-800 leading-relaxed">
                      Naye users Supabase Authentication me isliye display nahi ho rahe hain kyunki aapke Supabase project me <strong>Confirm email</strong> enabled hai, jisse Supabase free email quota (3 emails/hour) reach ho gaya aur Supabase ne registration ko block kar diya.
                    </p>
                  </div>
                </div>

                <div className="bg-white/80 p-3 rounded-xl border border-amber-200 text-slate-800 space-y-2">
                  <p className="font-semibold text-xs text-amber-900">How to fix in 30 seconds:</p>
                  <ol className="list-decimal pl-4 space-y-1 text-slate-700">
                    <li>
                      Open your Supabase Dashboard:{" "}
                      <a
                        href="https://supabase.com/dashboard/project/tnrkddekmrylxmnosrsg/auth/providers"
                        target="_blank"
                        rel="noreferrer"
                        className="font-bold text-teal-700 hover:underline inline-flex items-center gap-1"
                      >
                        Project Providers Settings ↗
                      </a>
                    </li>
                    <li>Click on the <strong>Email</strong> provider.</li>
                    <li>Toggle <strong>"Confirm email"</strong> to <strong>OFF (Disabled)</strong>.</li>
                    <li>Click <strong>Save</strong> at the bottom.</li>
                  </ol>
                  <p className="text-[11px] text-slate-500 pt-1 border-t border-amber-100">
                    Once disabled, Supabase will no longer send confirmation emails, and all new registered emails will appear instantly in your Supabase Authentication &gt; Users table!
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="flex-1 font-medium">{errorMsg}</div>
              </div>
            )}
          </div>
        )}

        {successMsg && (
          <div className="mb-5 p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs flex items-start gap-2.5 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div className="flex-1 font-medium">{successMsg}</div>
          </div>
        )}

        {/* Tab Toggle between Login and Register (when not in sub-flows) */}
        {(viewMode === "login" || viewMode === "register") && (
          <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-2xl mb-6 text-xs font-bold">
            <button
              type="button"
              onClick={() => switchView("login")}
              className={`py-2.5 rounded-xl transition-all ${
                viewMode === "login"
                  ? "bg-white text-slate-900 shadow-2xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => switchView("register")}
              className={`py-2.5 rounded-xl transition-all ${
                viewMode === "register"
                  ? "bg-white text-slate-900 shadow-2xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Register (Citizen)
            </button>
          </div>
        )}

        {/* VIEW 1: CITIZEN REGISTRATION (Part 3) */}
        {viewMode === "register" && (
          <div className="space-y-4">
            {/* Quick Register with Google */}
            <div>
              <button
                id="google-register-btn"
                type="button"
                onClick={handleGoogleLogin}
                disabled={isLoading}
                className="w-full py-3 px-4 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 hover:border-slate-400 rounded-xl text-sm font-semibold shadow-xs hover:shadow-sm transition-all flex items-center justify-center gap-3 cursor-pointer disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-slate-500" />
                    <span>Connecting to Google...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
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
                    <span>Continue with Google</span>
                  </>
                )}
              </button>

              <div className="relative my-4 text-center">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200" />
                </div>
                <span className="relative bg-white px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  or register with email
                </span>
              </div>
            </div>

            <form onSubmit={handleRegister} className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Full Name <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Yash Sharma"
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-teal-500 outline-none transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Email Address <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-teal-500 outline-none transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Phone Number <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98450 12345"
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-teal-500 outline-none transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Password <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-teal-500 outline-none transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Password strength meter */}
              {password && (
                <div className="mt-1.5">
                  <div className="flex items-center justify-between text-[10px] text-slate-500 mb-0.5">
                    <span>Strength: {pwdStrength.label}</span>
                    <span>{password.length}/8+ chars</span>
                  </div>
                  <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${pwdStrength.color} transition-all`}
                      style={{ width: `${(pwdStrength.score / 5) * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Location Selection (City, Ward, and GPS auto-detect) */}
            <div className="pt-2 border-t border-slate-100 space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-teal-600" />
                  <span>Select Your Location &amp; Ward</span>
                  <span className="text-slate-400 font-normal text-[11px]">(Required for ward updates)</span>
                </label>
                <button
                  type="button"
                  onClick={handleDetectLocation}
                  disabled={isDetectingLocation}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200/70 rounded-lg transition-colors cursor-pointer"
                  title="Detect city and ward automatically via GPS"
                >
                  {isDetectingLocation ? (
                    <RefreshCw className="w-3 h-3 animate-spin text-teal-600" />
                  ) : (
                    <Navigation className="w-3 h-3 text-teal-600" />
                  )}
                  {isDetectingLocation ? "Detecting..." : "Auto-Detect GPS"}
                </button>
              </div>

              {/* Quick Select Popular Cities */}
              <div>
                <div className="text-[10px] text-slate-500 font-medium mb-1.5 flex items-center gap-1">
                  <span>Quick Select Major City:</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {POPULAR_INDIAN_CITIES.map((c) => {
                    const isSelected = city.toLowerCase() === c.name.toLowerCase();
                    return (
                      <button
                        key={c.name}
                        type="button"
                        onClick={() => {
                          setCity(c.name);
                          if (!ward || ward.includes("Zone")) {
                            setWard(`Zone 01 - ${c.name} Central`);
                          }
                        }}
                        className={`px-2 py-1 text-[11px] rounded-lg transition-all border cursor-pointer ${
                          isSelected
                            ? "bg-teal-600 text-white font-semibold border-teal-600 shadow-2xs"
                            : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"
                        }`}
                      >
                        {c.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Editable City and Ward Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    City / District <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Building2 className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                    <input
                      type="text"
                      required
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="e.g. Lucknow, New Delhi"
                      className="w-full pl-8 pr-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-teal-500 outline-none transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Ward / Municipal Zone <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Compass className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                    <input
                      type="text"
                      required
                      value={ward}
                      onChange={(e) => setWard(e.target.value)}
                      placeholder="e.g. Ward 12, Civil Lines"
                      className="w-full pl-8 pr-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-teal-500 outline-none transition-colors"
                    />
                  </div>
                </div>
              </div>

              {detectedLocationStatus && (
                <div className="p-2 bg-teal-50 border border-teal-200 rounded-lg text-[11px] text-teal-800 flex items-center gap-1.5 animate-fadeIn">
                  <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                  <span>{detectedLocationStatus}</span>
                </div>
              )}
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Creating Account...</span>
                  </>
                ) : (
                  <>
                    <span>Complete Citizen Registration</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

        {/* VIEW 2: CITIZEN LOGIN (Email + Password) */}
        {viewMode === "login" && (
          <div className="space-y-4">
            {/* Prominent Continue with Google button */}
            <div>
              <button
                id="google-continue-btn"
                type="button"
                onClick={handleGoogleLogin}
                disabled={isLoading}
                className="w-full py-3 px-4 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 hover:border-slate-400 rounded-xl text-sm font-semibold shadow-xs hover:shadow-sm transition-all flex items-center justify-center gap-3 cursor-pointer disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-slate-500" />
                    <span>Connecting to Google...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
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
                    <span>Continue with Google</span>
                  </>
                )}
              </button>

              <div className="relative my-4 text-center">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200" />
                </div>
                <span className="relative bg-white px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  or sign in with email
                </span>
              </div>
            </div>

            <form onSubmit={handleEmailPasswordLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-teal-500 outline-none transition-colors"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => switchView("forgot_password")}
                    className="text-xs text-teal-600 hover:underline font-medium"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-teal-500 outline-none transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* VIEW 3: EMAIL OTP (Part 4) */}
        {viewMode === "email_otp" && (
          <form
            onSubmit={otpSent ? handleVerifyEmailOtp : handleSendEmailOtp}
            className="space-y-4"
          >
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="email"
                  required
                  disabled={otpSent}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-teal-500 outline-none transition-colors disabled:opacity-75"
                />
              </div>
            </div>

            {otpSent && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Enter 6-Digit Email OTP Code
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    required
                    value={otpToken}
                    onChange={(e) => setOtpToken(e.target.value)}
                    placeholder="123456"
                    maxLength={10}
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm tracking-widest font-mono focus:bg-white focus:border-teal-500 outline-none transition-colors"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : otpSent ? (
                <span>Verify OTP & Sign In</span>
              ) : (
                <span>Send Email Code / Magic Link</span>
              )}
            </button>

            {otpSent && (
              <button
                type="button"
                onClick={() => setOtpSent(false)}
                className="w-full text-center text-xs text-slate-500 hover:text-slate-800"
              >
                Change email address or resend
              </button>
            )}
          </form>
        )}

        {/* VIEW 4: PHONE OTP (Part 5) */}
        {viewMode === "phone_otp" && (
          <form
            onSubmit={otpSent ? handleVerifyPhoneOtp : handleSendPhoneOtp}
            className="space-y-4"
          >
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Phone Number (with country code)
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="tel"
                  required
                  disabled={otpSent}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98450 12345"
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-teal-500 outline-none transition-colors disabled:opacity-75"
                />
              </div>
            </div>

            {otpSent && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Enter 6-Digit SMS Code
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    required
                    value={otpToken}
                    onChange={(e) => setOtpToken(e.target.value)}
                    placeholder="123456"
                    maxLength={8}
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm tracking-widest font-mono focus:bg-white focus:border-teal-500 outline-none transition-colors"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : otpSent ? (
                <span>Verify SMS OTP</span>
              ) : (
                <span>Send SMS OTP Code</span>
              )}
            </button>

            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-500">
              Note: Phone OTP requires an active SMS provider (such as Twilio or MessageBird) configured in your Supabase project under <strong>Authentication &gt; Providers &gt; Phone</strong>.
            </div>
          </form>
        )}

        {/* VIEW 5: FORGOT PASSWORD (Part 22) */}
        {viewMode === "forgot_password" && (
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Registered Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-teal-500 outline-none transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Sending Link...</span>
                </>
              ) : (
                <span>Send Password Reset Link</span>
              )}
            </button>
          </form>
        )}

        {/* VIEW 6: RESET PASSWORD */}
        {viewMode === "reset_password" && (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                New Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-teal-500 outline-none transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Confirm New Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="password"
                  required
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-teal-500 outline-none transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Saving New Password...</span>
                </>
              ) : (
                <span>Update Password</span>
              )}
            </button>
          </form>
        )}

        {/* Back navigation button if in sub-views */}
        {viewMode !== "login" && viewMode !== "register" && (
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => switchView("login")}
              className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Back to Sign In
            </button>
          </div>
        )}

        {/* ALTERNATIVE AUTH METHODS (Email OTP, Phone OTP) */}
        {(viewMode === "login" || viewMode === "register") && (
          <>
            <div className="relative my-6 text-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200" />
              </div>
              <span className="relative bg-white px-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Passwordless Sign-In
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {/* Email OTP / Magic Link */}
              <button
                type="button"
                onClick={() => switchView("email_otp")}
                className="py-2.5 px-3 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5"
              >
                <Mail className="w-3.5 h-3.5 text-slate-500" />
                <span>Email OTP</span>
              </button>

              {/* Phone OTP */}
              <button
                type="button"
                onClick={() => switchView("phone_otp")}
                className="py-2.5 px-3 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5"
              >
                <Phone className="w-3.5 h-3.5 text-slate-500" />
                <span>Phone OTP</span>
              </button>
            </div>
          </>
        )}

        {/* Footer Admin Portal Notice (Part 9: No public "Register as Admin" button) */}
        <div className="mt-8 pt-4 border-t border-slate-100 text-center">
          <p className="text-[11px] text-slate-400">
            Municipal Officer or City Administrator?
          </p>
          <button
            type="button"
            onClick={onNavigateToAdmin}
            className="text-xs font-bold text-slate-700 hover:text-teal-700 inline-flex items-center gap-1 mt-1 transition-colors"
          >
            <Shield className="w-3 h-3 text-slate-500" /> Access Municipal Admin Portal in Footer
          </button>
        </div>
      </div>
    </div>
  );
};
