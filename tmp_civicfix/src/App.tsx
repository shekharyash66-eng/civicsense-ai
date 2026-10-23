import React, { useState, useEffect } from "react";
import { User, Complaint, CivicNotification, ComplaintDraftInput } from "./types";
import {
  getActiveUser,
  setActiveUser,
  getComplaints,
  getNotifications,
  subscribeToComplaints,
  subscribeToNotifications,
} from "./services/complaintService";
import { DEFAULT_USER, ADMIN_USER } from "./data/mockData";
import { getSupabaseClient } from "./lib/supabaseClient";
import {
  fetchOrCreateProfile,
  profileToAppUser,
  signOutUser,
  getFreshUserProfile,
} from "./services/supabaseAuthService";

// Components & Pages
import { Navbar } from "./components/common/Navbar";
import { Footer } from "./components/common/Footer";
import { LandingPage } from "./pages/LandingPage";
import { DashboardPage } from "./pages/DashboardPage";
import { ReportIssuePage } from "./pages/ReportIssuePage";
import { MyComplaintsPage } from "./pages/MyComplaintsPage";
import { ComplaintTrackingPage } from "./pages/ComplaintTrackingPage";
import { ComplaintMapPage } from "./pages/ComplaintMapPage";
import { AdminDashboardPage } from "./pages/AdminDashboardPage";
import { AuthPage, AuthViewMode } from "./pages/AuthPage";
import { ProfilePage } from "./pages/ProfilePage";
import { CivicFixAssistantChat } from "./components/chat/CivicFixAssistantChat";
import { MapsWrapper } from "./components/map/MapsWrapper";
import { SupabaseConfigModal } from "./components/database/SupabaseConfigModal";
import { Bot, Sparkles, MapPin, AlertCircle, RefreshCw } from "lucide-react";

/**
 * Parses initial route from window.location so page reloads, direct URL hits,
 * and bookmarks work seamlessly on Netlify SPA routing.
 */
function parseInitialLocation(): { route: string; viewMode: AuthViewMode; complaintId?: string } {
  if (typeof window === "undefined") {
    return { route: "landing", viewMode: "login" };
  }
  const path = window.location.pathname.toLowerCase().replace(/\/+$/, "") || "/";
  const params = new URLSearchParams(window.location.search);

  if (path === "/admin" || path.startsWith("/admin/")) {
    return { route: "admin", viewMode: "login" };
  }
  if (path === "/report") {
    return { route: "report", viewMode: "login" };
  }
  if (path === "/dashboard") {
    return { route: "dashboard", viewMode: "login" };
  }
  if (path === "/complaints" || path === "/my-reports") {
    return { route: "complaints", viewMode: "login" };
  }
  if (path === "/map") {
    return { route: "map", viewMode: "login" };
  }
  if (path === "/profile") {
    return { route: "profile", viewMode: "login" };
  }
  if (path === "/login") {
    return { route: "auth", viewMode: "login" };
  }
  if (path === "/register" || path === "/signup") {
    return { route: "auth", viewMode: "register" };
  }
  if (path === "/forgot-password") {
    return { route: "auth", viewMode: "forgot_password" };
  }
  if (path === "/reset-password") {
    return { route: "auth", viewMode: "reset_password" };
  }
  if (path.startsWith("/track/") || path.startsWith("/complaints/")) {
    const segments = path.split("/");
    const id = segments[2];
    return { route: "complaint_detail", viewMode: "login", complaintId: id || "CF-2026-0428" };
  }
  const trackParam = params.get("track") || params.get("id");
  if (trackParam) {
    return { route: "complaint_detail", viewMode: "login", complaintId: trackParam };
  }

  return { route: "landing", viewMode: "login" };
}

function getUrlForRoute(route: string, complaintId?: string, authMode?: AuthViewMode): string {
  if (route === "admin") return "/admin";
  if (route === "dashboard") return "/dashboard";
  if (route === "report") return "/report";
  if (route === "complaints") return "/complaints";
  if (route === "map") return "/map";
  if (route === "profile") return "/profile";
  if (route === "complaint_detail" && complaintId) return `/track/${encodeURIComponent(complaintId)}`;
  if (route === "auth") {
    if (authMode === "register") return "/register";
    if (authMode === "forgot_password") return "/forgot-password";
    if (authMode === "reset_password") return "/reset-password";
    return "/login";
  }
  return "/";
}

export default function App() {
  const initialLoc = parseInitialLocation();

  // Authentication user state (null when logged out)
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeRoute, setActiveRoute] = useState<string>(initialLoc.route);
  const [authViewMode, setAuthViewMode] = useState<AuthViewMode>(initialLoc.viewMode);
  const [selectedComplaintId, setSelectedComplaintId] = useState<string>(initialLoc.complaintId || "CF-2026-0428");
  const [complaints, setComplaints] = useState<Complaint[]>(() => getComplaints());
  const [notifications, setNotifications] = useState<CivicNotification[]>(() => getNotifications());

  // authLoading state during session check
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  // Permission / Auth notification banner
  const [permissionDeniedMsg, setPermissionDeniedMsg] = useState<string | null>(null);

  // Database settings modal state
  const [isDbModalOpen, setIsDbModalOpen] = useState(false);

  // AI Assistant states
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [assistantDraft, setAssistantDraft] = useState<ComplaintDraftInput | undefined>(undefined);

  // Map pin report pre-fill
  const [reportMapCoords, setReportMapCoords] = useState<{
    lat: number;
    lng: number;
    address: string;
    ward: string;
  } | undefined>(undefined);

  // Synchronize browser history / popstate
  useEffect(() => {
    const handlePopState = () => {
      const loc = parseInitialLocation();
      setActiveRoute(loc.route);
      setAuthViewMode(loc.viewMode);
      if (loc.complaintId) setSelectedComplaintId(loc.complaintId);
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // 1. Supabase Auth state initialization & listener
  useEffect(() => {
    let isSubscribed = true;

    const setupAuth = async () => {
      try {
        const supabase = getSupabaseClient();
        if (supabase) {
          // Check for OAuth error in URL hash
          if (typeof window !== "undefined" && window.location.hash.includes("error=")) {
            const hashParams = new URLSearchParams(window.location.hash.substring(1));
            const errorDesc = hashParams.get("error_description") || hashParams.get("error") || "Authentication was cancelled.";
            setPermissionDeniedMsg(`Google Sign-In Notice: ${decodeURIComponent(errorDesc.replace(/\+/g, " "))}`);
            if (sessionStorage.getItem("civicfix_oauth_pending")) {
              sessionStorage.removeItem("civicfix_oauth_pending");
            }
            if (window.history && window.location.hash) {
              window.history.replaceState(null, "", window.location.pathname);
            }
          }

          // Detect if returning from Google OAuth redirect
          const isOAuthCallback =
            typeof window !== "undefined" &&
            (window.location.hash.includes("access_token") ||
              window.location.search.includes("code=") ||
              sessionStorage.getItem("civicfix_oauth_pending") === "true");

          // Check existing session
          const { data: { session }, error: sessionErr } = await supabase.auth.getSession();
          if (sessionErr) {
            console.warn("[App Auth] Session check notice:", sessionErr.message);
          }

          if (isSubscribed && session?.user) {
            const profile = await fetchOrCreateProfile(session.user);
            if (profile) {
              const appUser = profileToAppUser(profile);
              setActiveUser(appUser);
              setCurrentUser(appUser);

              // If returning from Google OAuth or hash/search params contain tokens/code
              if (isOAuthCallback) {
                if (typeof window !== "undefined" && window.sessionStorage) {
                  sessionStorage.removeItem("civicfix_oauth_pending");
                }

                // IMPORTANT:
                // A completed Google OAuth login must ALWAYS return
                // to the public CivicFix homepage.
                //
                // Do NOT check activeRoute.
                // Do NOT check initialLoc.route.
                // Do NOT redirect to dashboard.

                setActiveRoute("landing");
                setAuthViewMode("login");

                if (typeof window !== "undefined") {
                  window.history.replaceState(null, "", "/");
                }
              }
            }
          }

          // Real-time listener for Auth events
          const { data: authListener } = supabase.auth.onAuthStateChange(
            async (event, session) => {
              console.log("[App Auth] State changed:", event);

              if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
                if (session?.user) {
                  const profile = await fetchOrCreateProfile(session.user);
                  if (profile) {
                    const appUser = profileToAppUser(profile);
                    setActiveUser(appUser);
                    setCurrentUser(appUser);

                    const pendingOAuth =
                      typeof window !== "undefined" &&
                      (sessionStorage.getItem("civicfix_oauth_pending") === "true" ||
                        window.location.hash.includes("access_token") ||
                        window.location.search.includes("code="));

                    if (pendingOAuth || isOAuthCallback) {
                      if (typeof window !== "undefined" && window.sessionStorage) {
                        sessionStorage.removeItem("civicfix_oauth_pending");
                      }

                      setActiveRoute("landing");
                      setAuthViewMode("login");

                      if (typeof window !== "undefined") {
                        window.history.replaceState(null, "", "/");
                      }
                    } else if (event === "SIGNED_IN" && activeRoute === "auth") {
                      // Password or OTP login from auth screen
                      setActiveRoute("landing");
                      setAuthViewMode("login");
                      if (typeof window !== "undefined") {
                        window.history.pushState(null, "", "/");
                      }
                    }
                  }
                }
              } else if (event === "PASSWORD_RECOVERY") {
                setAuthViewMode("reset_password");
                setActiveRoute("auth");
              } else if (event === "SIGNED_OUT") {
                setCurrentUser(null);
                setActiveRoute("landing");
                if (typeof window !== "undefined") {
                  window.history.pushState(null, "", "/");
                }
              }
            }
          );

          return () => {
            authListener?.subscription?.unsubscribe();
          };
        }
      } catch (err) {
        console.warn("[App Auth] Initialization warning:", err);
      } finally {
        if (isSubscribed) {
          setIsAuthLoading(false);
        }
      }
    };

    setupAuth();

    return () => {
      isSubscribed = false;
    };
  }, []);

  // 2. Subscribe to real-time complaint updates & notifications
  useEffect(() => {
    const unsubComplaints = subscribeToComplaints(() => {
      setComplaints(getComplaints());
    });
    const unsubNotifications = subscribeToNotifications(() => {
      setNotifications(getNotifications());
    });
    return () => {
      unsubComplaints();
      unsubNotifications();
    };
  }, []);

  // 3. Handle navigation with route protection & browser URL update
  const handleNavigate = (route: string) => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    setPermissionDeniedMsg(null);

    let nextRoute = route;
    let nextAuthMode = authViewMode;
    let nextComplaintId = selectedComplaintId;

    // Named Auth Routes
    if (route === "login") {
      nextAuthMode = "login";
      setAuthViewMode("login");
      setActiveRoute("auth");
      if (typeof window !== "undefined") window.history.pushState(null, "", "/login");
      return;
    }
    if (route === "register") {
      nextAuthMode = "register";
      setAuthViewMode("register");
      setActiveRoute("auth");
      if (typeof window !== "undefined") window.history.pushState(null, "", "/register");
      return;
    }
    if (route === "forgot-password" || route === "forgot_password") {
      nextAuthMode = "forgot_password";
      setAuthViewMode("forgot_password");
      setActiveRoute("auth");
      if (typeof window !== "undefined") window.history.pushState(null, "", "/forgot-password");
      return;
    }
    if (route === "reset-password" || route === "reset_password") {
      nextAuthMode = "reset_password";
      setAuthViewMode("reset_password");
      setActiveRoute("auth");
      if (typeof window !== "undefined") window.history.pushState(null, "", "/reset-password");
      return;
    }
    if (route === "verify-otp" || route === "verify_otp") {
      setAuthViewMode("email_otp");
      setActiveRoute("auth");
      return;
    }

    // Citizen Protected Routes
    if (route === "dashboard" || route === "complaints" || route === "my-reports" || route === "profile") {
      if (!currentUser) {
        setPermissionDeniedMsg("Please sign in or create an account to view your citizen dashboard and reports.");
        setAuthViewMode("login");
        setActiveRoute("auth");
        if (typeof window !== "undefined") window.history.pushState(null, "", "/login");
        return;
      }
      if (route === "my-reports") {
        nextRoute = "complaints";
        setActiveRoute("complaints");
        if (typeof window !== "undefined") window.history.pushState(null, "", "/complaints");
        return;
      }
    }

    // Submit Report Route (if unauthenticated, guide to login/register)
    if (route === "report" && !currentUser) {
      setPermissionDeniedMsg("Please sign in or register to submit and track your civic issue.");
      setAuthViewMode("login");
      setActiveRoute("auth");
      if (typeof window !== "undefined") window.history.pushState(null, "", "/login");
      return;
    }

    // Admin Routes
    if (route === "admin" || route === "admin-reports" || route === "admin-users") {
      setActiveRoute("admin");
      if (typeof window !== "undefined") window.history.pushState(null, "", "/admin");
      return;
    }

    if (route.startsWith("complaint-")) {
      const id = route.replace("complaint-", "");
      nextComplaintId = id;
      setSelectedComplaintId(id);
      setActiveRoute("complaint_detail");
      if (typeof window !== "undefined") window.history.pushState(null, "", `/track/${encodeURIComponent(id)}`);
      return;
    }

    if (route.startsWith("track?id=") || route.startsWith("track/")) {
      const id = route.startsWith("track?id=") ? route.replace("track?id=", "") : route.replace("track/", "");
      nextComplaintId = id;
      setSelectedComplaintId(id);
      setActiveRoute("complaint_detail");
      if (typeof window !== "undefined") window.history.pushState(null, "", `/track/${encodeURIComponent(id)}`);
      return;
    }

    if (route === "auth") {
      setAuthViewMode("login");
    }
    setActiveRoute(route);
    if (typeof window !== "undefined") {
      const targetUrl = getUrlForRoute(route, nextComplaintId, nextAuthMode);
      window.history.pushState(null, "", targetUrl);
    }
  };

  // Select complaint to track
  const handleSelectComplaint = (id: string) => {
    setSelectedComplaintId(id);
    setActiveRoute("complaint_detail");
    if (typeof window !== "undefined") {
      window.history.pushState(null, "", `/track/${encodeURIComponent(id)}`);
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Report issue from map coords
  const handleReportAtCoords = (coords: {
    lat: number;
    lng: number;
    address: string;
    ward: string;
  }) => {
    setReportMapCoords(coords);
    if (!currentUser) {
      setPermissionDeniedMsg("Please log in to report an issue at this location.");
      setAuthViewMode("login");
      setActiveRoute("auth");
    } else {
      setActiveRoute("report");
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Logout handler
  const handleLogout = async () => {
    setIsAuthLoading(true);
    try {
      await signOutUser();
      setCurrentUser(null);
      setActiveRoute("landing");
      if (typeof window !== "undefined") {
        window.history.pushState(null, "", "/");
      }
    } finally {
      setIsAuthLoading(false);
    }
  };

  // Loading Screen while Auth initializes
  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-white select-none">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-teal-700 via-teal-600 to-emerald-500 flex items-center justify-center shadow-xl shadow-teal-500/20 mb-4 animate-pulse">
          <MapPin className="w-8 h-8 text-white" />
        </div>
        <h1 className="font-heading text-2xl font-bold tracking-tight text-white">CivicFix</h1>
        <p className="text-xs text-slate-400 mt-1 flex items-center gap-2">
          <RefreshCw className="w-3.5 h-3.5 animate-spin text-teal-400" />
          <span>Verifying security session...</span>
        </p>
      </div>
    );
  }

  // Quota exceeded state
  const [isQuotaExceeded, setIsQuotaExceeded] = useState(false);

  useEffect(() => {
    const handleQuotaExceeded = () => setIsQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', handleQuotaExceeded);
    return () => window.removeEventListener('gmp-quota-exceeded', handleQuotaExceeded);
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans antialiased selection:bg-teal-100 dark:selection:bg-teal-900 selection:text-teal-900 dark:selection:text-teal-200 transition-colors">
      {/* Quota Exceeded Alert Bar */}
      {isQuotaExceeded && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-amber-950 hover:text-amber-800"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
        </div>
      )}

      {/* Permission Denied Alert Bar */}
      {permissionDeniedMsg && (
        <div className="bg-rose-600 text-white px-4 py-2.5 text-xs sm:text-sm font-semibold flex items-center justify-between shadow-md z-50 animate-in slide-in-from-top-2">
          <div className="max-w-7xl mx-auto flex items-center gap-2 flex-1">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{permissionDeniedMsg}</span>
          </div>
          <button
            onClick={() => setPermissionDeniedMsg(null)}
            className="text-white/80 hover:text-white text-xs underline font-normal"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Top Navbar */}
      <Navbar
        activeRoute={activeRoute}
        onRouteChange={handleNavigate}
        currentUser={currentUser}
        onLogout={handleLogout}
        notifications={notifications}
        onSelectComplaint={handleSelectComplaint}
        onOpenAssistant={() => setIsAssistantOpen(true)}
        onOpenDatabase={() => setIsDbModalOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1">
        {activeRoute === "landing" && (
          <LandingPage
            onNavigate={handleNavigate}
            onTrackComplaintId={handleSelectComplaint}
          />
        )}

        {activeRoute === "dashboard" && currentUser && (
          <DashboardPage
            currentUser={currentUser}
            complaints={complaints}
            onNavigate={handleNavigate}
            onSelectComplaint={handleSelectComplaint}
            onLogout={handleLogout}
          />
        )}

        {activeRoute === "report" && currentUser && (
          <ReportIssuePage
            currentUser={currentUser}
            onNavigate={handleNavigate}
            preselectedCoords={reportMapCoords}
            initialDraft={assistantDraft}
            onComplaintSubmitted={(newComplaint) => {
              setComplaints(getComplaints());
              setSelectedComplaintId(newComplaint.id);
              setAssistantDraft(undefined);
            }}
          />
        )}

        {activeRoute === "complaints" && currentUser && (
          <MyComplaintsPage
            currentUser={currentUser}
            complaints={complaints}
            onNavigate={handleNavigate}
            onSelectComplaint={handleSelectComplaint}
          />
        )}

        {activeRoute === "complaint_detail" && (
          <ComplaintTrackingPage
            complaintId={selectedComplaintId}
            currentUser={currentUser || DEFAULT_USER}
            onNavigate={handleNavigate}
          />
        )}

        {activeRoute === "map" && (
          <MapsWrapper>
            <ComplaintMapPage
              complaints={complaints}
              onNavigate={handleNavigate}
              onSelectComplaint={handleSelectComplaint}
              onReportAtCoords={handleReportAtCoords}
            />
          </MapsWrapper>
        )}

        {activeRoute === "admin" && (
          <AdminDashboardPage
            currentUser={currentUser}
            complaints={complaints}
            onNavigate={handleNavigate}
            onSelectComplaint={handleSelectComplaint}
            onLogout={handleLogout}
            onRefreshRole={async () => {
              const fresh = await getFreshUserProfile();
              if (fresh) {
                const updated = profileToAppUser(fresh);
                setCurrentUser(updated);
                setActiveUser(updated);
              }
            }}
            onUserAuthenticated={(adminUser) => {
              setCurrentUser(adminUser);
              setActiveUser(adminUser);
              setActiveRoute("admin");
            }}
          />
        )}

        {activeRoute === "auth" && (
          <AuthPage
            initialMode={authViewMode}
            onSuccess={(user) => {
              setCurrentUser(user);
              handleNavigate("landing");
            }}
            onNavigateToAdmin={() => handleNavigate("admin")}
          />
        )}

        {activeRoute === "profile" && currentUser && (
          <ProfilePage
            currentUser={currentUser}
            complaints={complaints}
            onUpdateUser={(updated) => setCurrentUser(updated)}
          />
        )}
      </main>

      {/* Global Footer (Admin link placed here strictly per user specification) */}
      <Footer onNavigate={handleNavigate} />

      {/* Floating CivicFix Assistant Launcher Button */}
      {!isAssistantOpen && (
        <button
          onClick={() => setIsAssistantOpen(true)}
          aria-label="Open CivicFix Assistant"
          className="fixed bottom-16 sm:bottom-6 right-4 sm:right-6 z-40 group flex items-center gap-2.5 bg-gradient-to-r from-slate-900 via-teal-950 to-slate-900 text-white px-3.5 py-2.5 sm:px-4 sm:py-3 rounded-full shadow-xl hover:shadow-2xl border border-teal-500/30 hover:border-teal-400 transition-all transform hover:-translate-y-0.5 active:translate-y-0"
        >
          <div className="relative w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-tr from-teal-500 to-emerald-400 text-slate-950 flex items-center justify-center font-bold shadow-md shadow-teal-500/30">
            <Bot className="w-4 h-4 sm:w-4.5 sm:h-4.5 stroke-[2.2]" />
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-slate-900 animate-pulse" />
          </div>
          <div className="text-left pr-1">
            <div className="text-xs font-bold tracking-tight text-white flex items-center gap-1.5">
              <span>CivicFix AI</span>
              <span className="hidden sm:inline-block text-[10px] font-semibold text-emerald-300 bg-emerald-950/80 px-1.5 py-0.2 rounded border border-emerald-500/30">
                Assistant
              </span>
            </div>
            <p className="text-[10px] text-teal-200/80 hidden sm:block">Ask or report issues</p>
          </div>
        </button>
      )}

      {/* CivicFix Assistant Chat Dialog */}
      <CivicFixAssistantChat
        currentUser={currentUser}
        activeRoute={activeRoute}
        selectedComplaintId={selectedComplaintId}
        complaints={complaints}
        isOpen={isAssistantOpen}
        onClose={() => setIsAssistantOpen(false)}
        onNavigate={(route) => {
          handleNavigate(route);
        }}
        onStartComplaintDraft={(draft) => {
          setAssistantDraft(draft);
          setActiveRoute("report");
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
        onSelectComplaint={(id) => {
          handleSelectComplaint(id);
        }}
      />

      {/* Supabase Database Connection & Migration Modal */}
      <SupabaseConfigModal
        isOpen={isDbModalOpen}
        onClose={() => setIsDbModalOpen(false)}
        onSyncCompleted={() => {
          setComplaints(getComplaints());
        }}
      />
    </div>
  );
}
