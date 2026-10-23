import React, { useState, useRef, useEffect, useMemo } from "react";
import { User, CivicNotification } from "../../types";
import { NotificationDropdown } from "./NotificationDropdown";
import { useTheme } from "../../context/ThemeContext";
import {
  MapPin,
  CheckCircle,
  PlusCircle,
  FileText,
  Map,
  LayoutDashboard,
  User as UserIcon,
  Bell,
  Shield,
  Menu,
  X,
  LogOut,
  RotateCcw,
  Sparkles,
  Database,
  Sun,
  Moon
} from "lucide-react";
import { resetToDemoData } from "../../services/complaintService";

interface NavbarProps {
  activeRoute: string;
  onRouteChange: (route: string) => void;
  currentUser: User | null;
  onLogout?: () => void;
  notifications: CivicNotification[];
  onSelectComplaint: (id: string) => void;
  onOpenAssistant?: () => void;
  onOpenDatabase?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeRoute,
  onRouteChange,
  currentUser,
  onLogout,
  notifications,
  onSelectComplaint,
  onOpenAssistant,
  onOpenDatabase,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const { theme, toggleTheme } = useTheme();

  const unreadCount = notifications.filter((n) => !n.read).length;

  // Close menus on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Determine dynamic navigation items based on auth & role state
  const navItems = useMemo(() => {
    if (!currentUser) {
      return [
        { id: "landing", label: "Home" },
        { id: "map", label: "City Map" },
      ];
    }
    if (currentUser.role === "admin") {
      return [
        { id: "landing", label: "Home" },
        { id: "admin", label: "Admin Dashboard" },
        { id: "admin-reports", label: "Reports" },
        { id: "admin-users", label: "Users" },
        { id: "map", label: "City Map" },
      ];
    }
    // Citizen role
    return [
      { id: "landing", label: "Home" },
      { id: "map", label: "City Map" },
      { id: "dashboard", label: "Dashboard" },
      { id: "complaints", label: "My Reports" },
    ];
  }, [currentUser]);

  return (
    <>
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200/90 dark:border-slate-800 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Brand Logo */}
          <div
            onClick={() => onRouteChange("landing")}
            className="flex items-center gap-2.5 cursor-pointer group select-none"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-teal-700 via-teal-600 to-emerald-500 text-white flex items-center justify-center shadow-md shadow-teal-700/20 group-hover:scale-105 transition-transform">
              <div className="relative flex items-center justify-center">
                <MapPin className="w-5 h-5 fill-white stroke-teal-800" />
                <CheckCircle className="w-3.5 h-3.5 text-amber-300 absolute -bottom-1 -right-1 stroke-[2.5]" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-heading font-extrabold text-xl tracking-tight text-slate-900 dark:text-white">
                  Civic<span className="text-teal-600 dark:text-teal-400">Fix</span>
                </span>
                <span className="hidden sm:inline-block text-[10px] font-bold uppercase tracking-wider bg-teal-50 dark:bg-teal-950/80 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800/80 px-1.5 py-0.5 rounded">
                  GovTech AI
                </span>
              </div>
              <p className="text-[10px] text-slate-400 dark:text-slate-400 font-medium tracking-tight -mt-0.5 hidden md:block">
                Report civic issues. Track the fix.
              </p>
            </div>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center gap-1 text-sm font-medium">
            {navItems.map((item) => {
              const isActive = activeRoute === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onRouteChange(item.id)}
                  className={`px-3.5 py-2 rounded-xl transition-colors ${
                    isActive
                      ? "bg-slate-100 dark:bg-slate-800 text-teal-800 dark:text-teal-300 font-semibold"
                      : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/60"
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Right Action Elements */}
          <div className="flex items-center gap-2.5">
            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 transition-colors shadow-2xs"
              aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
              title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            >
              {theme === 'light' ? (
                <Moon className="w-4 h-4 text-slate-700" />
              ) : (
                <Sun className="w-4 h-4 text-amber-400" />
              )}
            </button>

            {/* Database & Cloud Sync Quick Trigger */}
            {onOpenDatabase && (
              <button
                onClick={onOpenDatabase}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/80 transition-colors shadow-2xs"
                title="Supabase Database Status & Sync"
              >
                <Database className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span className="hidden md:inline">Supabase</span>
              </button>
            )}

            {/* AI Assistant Quick Trigger */}
            {onOpenAssistant && (
              <button
                onClick={onOpenAssistant}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl text-xs font-semibold bg-teal-50 dark:bg-teal-950/60 hover:bg-teal-100 dark:hover:bg-teal-900/60 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800/80 transition-colors shadow-2xs"
                title="Open CivicFix Assistant"
              >
                <Sparkles className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 animate-pulse" />
                <span className="hidden sm:inline">Ask AI</span>
              </button>
            )}

            {/* If NOT LOGGED IN: Show explicit, high-contrast Login & Register buttons */}
            {!currentUser ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onRouteChange("login")}
                  className="px-3.5 py-2 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 hover:text-teal-700 dark:hover:text-teal-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                >
                  Login
                </button>
                <button
                  onClick={() => onRouteChange("register")}
                  className="inline-flex items-center gap-1.5 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white text-xs sm:text-sm font-semibold px-4 py-2 rounded-xl shadow-sm hover:shadow-md transition-all active:scale-95"
                >
                  Register
                </button>
              </div>
            ) : (
              <>
                {/* Notification Bell Dropdown */}
                <div className="relative" ref={notifRef}>
                  <button
                    onClick={() => setNotifOpen(!notifOpen)}
                    className="relative p-2.5 rounded-xl text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    aria-label="Notifications"
                  >
                    <Bell className="w-5 h-5" />
                    {unreadCount > 0 && (
                      <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center animate-pulse">
                        {unreadCount}
                      </span>
                    )}
                  </button>

                  {notifOpen && (
                    <NotificationDropdown
                      notifications={notifications}
                      onSelectComplaint={(id) => {
                        onSelectComplaint(id);
                        setNotifOpen(false);
                      }}
                      onClose={() => setNotifOpen(false)}
                    />
                  )}
                </div>

                {/* User Menu Dropdown */}
                <div className="relative" ref={userMenuRef}>
                  <button
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                    className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-teal-500 dark:hover:border-teal-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
                  >
                    <div className="w-7 h-7 rounded-lg bg-teal-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                      {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : "U"}
                    </div>
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 hidden md:inline max-w-[100px] truncate">
                      {currentUser.name}
                    </span>
                  </button>

                  {userMenuOpen && (
                    <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl py-2 z-50 animate-in fade-in-80 zoom-in-95">
                      <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800">
                        <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{currentUser.name}</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{currentUser.email}</p>
                        <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-teal-50 dark:bg-teal-950/80 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
                          {currentUser.role}
                        </span>
                      </div>

                      <div className="p-1 space-y-0.5 text-xs">
                        {currentUser.role === "admin" ? (
                          <>
                            <button
                              onClick={() => {
                                onRouteChange("admin");
                                setUserMenuOpen(false);
                              }}
                              className="w-full text-left px-3 py-2 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 font-medium"
                            >
                              <Shield className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                              <span>Admin Console</span>
                            </button>
                            <button
                              onClick={() => {
                                onRouteChange("admin-reports");
                                setUserMenuOpen(false);
                              }}
                              className="w-full text-left px-3 py-2 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 font-medium"
                            >
                              <FileText className="w-3.5 h-3.5 text-slate-400" />
                              <span>Manage Reports</span>
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => {
                                onRouteChange("dashboard");
                                setUserMenuOpen(false);
                              }}
                              className="w-full text-left px-3 py-2 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 font-medium"
                            >
                              <LayoutDashboard className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                              <span>Citizen Dashboard</span>
                            </button>
                            <button
                              onClick={() => {
                                onRouteChange("complaints");
                                setUserMenuOpen(false);
                              }}
                              className="w-full text-left px-3 py-2 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 font-medium"
                            >
                              <FileText className="w-3.5 h-3.5 text-slate-400" />
                              <span>My Reports</span>
                            </button>
                          </>
                        )}

                        <button
                          onClick={() => {
                            onRouteChange("profile");
                            setUserMenuOpen(false);
                          }}
                          className="w-full text-left px-3 py-2 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 font-medium"
                        >
                          <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                          <span>My Profile</span>
                        </button>

                        {onOpenDatabase && (
                          <button
                            onClick={() => {
                              onOpenDatabase();
                              setUserMenuOpen(false);
                            }}
                            className="w-full text-left px-3 py-2 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 font-medium"
                          >
                            <Database className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            <span>Supabase Database</span>
                          </button>
                        )}

                        <div className="border-t border-slate-100 dark:border-slate-800 my-1" />

                        {onLogout && (
                          <button
                            onClick={() => {
                              setUserMenuOpen(false);
                              onLogout();
                            }}
                            className="w-full text-left px-3 py-2 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center gap-2 font-semibold"
                          >
                            <LogOut className="w-3.5 h-3.5 text-rose-500" />
                            <span>Logout</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Mobile Menu Toggle Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 pt-2 pb-4 space-y-2 animate-in slide-in-from-top-2 duration-150">
            {!currentUser ? (
              <div className="grid grid-cols-2 gap-2 pt-2 pb-2">
                <button
                  onClick={() => {
                    onRouteChange("login");
                    setMobileMenuOpen(false);
                  }}
                  className="w-full py-2.5 rounded-xl font-semibold text-center text-sm border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-slate-800"
                >
                  Login
                </button>
                <button
                  onClick={() => {
                    onRouteChange("register");
                    setMobileMenuOpen(false);
                  }}
                  className="w-full py-2.5 rounded-xl font-semibold text-center text-sm bg-teal-600 text-white shadow-sm"
                >
                  Register
                </button>
              </div>
            ) : (
              currentUser.role !== "admin" && (
                <button
                  onClick={() => {
                    onRouteChange("report");
                    setMobileMenuOpen(false);
                  }}
                  className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-teal-600 to-emerald-600 text-white font-semibold py-2.5 rounded-xl shadow-sm text-sm"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Report a Civic Issue</span>
                </button>
              )
            )}

            <div className="grid grid-cols-2 gap-2 pt-1">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    onRouteChange(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`p-2.5 rounded-xl text-left text-xs font-semibold ${
                    activeRoute === item.id
                      ? "bg-teal-50 dark:bg-teal-950/80 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800"
                      : "bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300"
                  }`}
                >
                  {item.label}
                </button>
              ))}

              {currentUser && (
                <button
                  onClick={() => {
                    onRouteChange("profile");
                    setMobileMenuOpen(false);
                  }}
                  className={`p-2.5 rounded-xl text-left text-xs font-semibold ${
                    activeRoute === "profile"
                      ? "bg-teal-50 dark:bg-teal-950/80 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800"
                      : "bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300"
                  }`}
                >
                  Profile Settings
                </button>
              )}

              {currentUser && onLogout && (
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onLogout();
                  }}
                  className="col-span-2 p-2.5 rounded-xl text-center text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/65 mt-1"
                >
                  Logout ({currentUser.name})
                </button>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Mobile Floating Bottom Bar */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 px-3 py-2 flex items-center justify-around">
        {!currentUser ? (
          <>
            <button
              onClick={() => onRouteChange("landing")}
              className={`flex flex-col items-center gap-0.5 text-[10px] font-medium ${
                activeRoute === "landing" ? "text-teal-700 dark:text-teal-400 font-bold" : "text-slate-500 dark:text-slate-400"
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Home</span>
            </button>
            <button
              onClick={() => onRouteChange("map")}
              className={`flex flex-col items-center gap-0.5 text-[10px] font-medium ${
                activeRoute === "map" ? "text-teal-700 dark:text-teal-400 font-bold" : "text-slate-500 dark:text-slate-400"
              }`}
            >
              <Map className="w-4 h-4" />
              <span>Map</span>
            </button>
            <button
              onClick={() => onRouteChange("login")}
              className={`flex flex-col items-center gap-0.5 text-[10px] font-medium ${
                activeRoute === "login" || activeRoute === "auth" ? "text-teal-700 dark:text-teal-400 font-bold" : "text-slate-500 dark:text-slate-400"
              }`}
            >
              <UserIcon className="w-4 h-4" />
              <span>Login</span>
            </button>
            <button
              onClick={() => onRouteChange("register")}
              className={`flex flex-col items-center gap-0.5 text-[10px] font-medium ${
                activeRoute === "register" ? "text-teal-700 dark:text-teal-400 font-bold" : "text-teal-600 dark:text-teal-400 font-semibold"
              }`}
            >
              <PlusCircle className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              <span>Register</span>
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => onRouteChange("landing")}
              className={`flex flex-col items-center gap-0.5 text-[10px] font-medium ${
                activeRoute === "landing" ? "text-teal-700 dark:text-teal-400 font-bold" : "text-slate-500 dark:text-slate-400"
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Home</span>
            </button>
            <button
              onClick={() => onRouteChange(currentUser.role === "admin" ? "admin" : "dashboard")}
              className={`flex flex-col items-center gap-0.5 text-[10px] font-medium ${
                activeRoute === "dashboard" || activeRoute === "admin" ? "text-teal-700 dark:text-teal-400 font-bold" : "text-slate-500 dark:text-slate-400"
              }`}
            >
              <Shield className="w-4 h-4" />
              <span>{currentUser.role === "admin" ? "Admin" : "Dashboard"}</span>
            </button>
            <button
              onClick={() => onRouteChange(currentUser.role === "admin" ? "admin-reports" : "complaints")}
              className={`flex flex-col items-center gap-0.5 text-[10px] font-medium ${
                activeRoute === "complaints" || activeRoute === "admin-reports" ? "text-teal-700 dark:text-teal-400 font-bold" : "text-slate-500 dark:text-slate-400"
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Reports</span>
            </button>
            {currentUser.role !== "admin" && (
              <button
                onClick={() => onRouteChange("report")}
                className="flex flex-col items-center -mt-5"
              >
                <div className="w-12 h-12 rounded-full bg-teal-600 text-white flex items-center justify-center shadow-lg shadow-teal-600/30 ring-4 ring-white dark:ring-slate-900">
                  <PlusCircle className="w-6 h-6" />
                </div>
                <span className="text-[10px] font-bold text-teal-800 dark:text-teal-300 mt-0.5">Report</span>
              </button>
            )}
            <button
              onClick={() => onRouteChange("map")}
              className={`flex flex-col items-center gap-0.5 text-[10px] font-medium ${
                activeRoute === "map" ? "text-teal-700 dark:text-teal-400 font-bold" : "text-slate-500 dark:text-slate-400"
              }`}
            >
              <Map className="w-4 h-4" />
              <span>Map</span>
            </button>
            <button
              onClick={() => onRouteChange("profile")}
              className={`flex flex-col items-center gap-0.5 text-[10px] font-medium ${
                activeRoute === "profile" ? "text-teal-700 dark:text-teal-400 font-bold" : "text-slate-500 dark:text-slate-400"
              }`}
            >
              <UserIcon className="w-4 h-4" />
              <span>Profile</span>
            </button>
          </>
        )}
      </div>
    </>
  );
};
