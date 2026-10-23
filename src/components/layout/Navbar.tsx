import React, { useState } from 'react';
import { useCivic } from '../../context/CivicContext';
import { useTheme } from '../../context/ThemeContext';
import { Shield, Menu, X, ChevronDown, LogOut, User as UserIcon, LogIn, UserPlus, Users, Sun, Moon } from 'lucide-react';

interface NavbarProps {
  currentView: string;
  setCurrentView: (view: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentView, setCurrentView }) => {
  const { currentUser, logout, currentRole } = useCivic();
  const { theme, toggleTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  const handleNavClick = (view: string) => {
    setCurrentView(view);
    setMobileMenuOpen(false);
  };

  const handleLogout = async () => {
    setUserDropdownOpen(false);
    await logout();
    setCurrentView('landing');
  };

  return (
    <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-40 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-8 h-16">
          {/* Zone 1: Single text element wordmark */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleNavClick('landing')}
              className="flex items-center gap-2 text-left group"
            >
              <div className="w-8 h-8 rounded-lg bg-red-600 dark:bg-red-950/90 border border-red-500 dark:border-red-600 flex items-center justify-center text-white shadow-xs group-hover:bg-red-700 dark:group-hover:bg-red-900 transition-colors">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap">
                CivicSense <span className="text-teal-600 dark:text-teal-400">AI</span>
              </span>
            </button>
          </div>

          {/* Zone 2: Navigation links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-300">
            <button
              onClick={() => handleNavClick('landing')}
              className={`hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0 ${
                currentView === 'landing' ? 'text-teal-700 dark:text-teal-400 font-semibold' : ''
              }`}
            >
              Home
            </button>
            <button
              onClick={() => handleNavClick('report')}
              className={`hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0 ${
                currentView === 'report' ? 'text-teal-700 dark:text-teal-400 font-semibold' : ''
              }`}
            >
              Report Issue
            </button>
            <button
              onClick={() => handleNavClick('track')}
              className={`hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0 ${
                currentView === 'track' ? 'text-teal-700 dark:text-teal-400 font-semibold' : ''
              }`}
            >
              Track Complaint
            </button>

            {(currentRole === 'Administrator' || currentRole === 'Department Officer') && (
              <button
                onClick={() => handleNavClick('admin-overview')}
                className={`hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0 ${
                  currentView.startsWith('admin') ? 'text-teal-700 dark:text-teal-400 font-semibold' : ''
                }`}
              >
                Municipal Dashboard
              </button>
            )}

            <button
              onClick={() => handleNavClick('map')}
              className={`hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0 ${
                currentView === 'map' || currentView === 'admin-map' ? 'text-teal-700 dark:text-teal-400 font-semibold' : ''
              }`}
            >
              Civic Map
            </button>
          </nav>

          {/* Zone 3: Theme Toggle & Authenticated User Persona / Auth Actions */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Theme Toggle Switch */}
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors shadow-2xs flex items-center justify-center shrink-0 cursor-pointer"
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              aria-label="Toggle Light or Dark Theme"
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-slate-700" />
              )}
            </button>

            {currentUser ? (
              <div className="relative">
                <button
                  onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200/80 dark:hover:bg-slate-700 rounded-xl border border-slate-200 dark:border-slate-700 transition-colors"
                >
                  <div className="w-6 h-6 rounded-full bg-slate-900 dark:bg-teal-500 text-teal-400 dark:text-slate-950 font-bold text-xs flex items-center justify-center">
                    {currentUser.full_name.charAt(0)}
                  </div>
                  <div className="text-left hidden sm:block">
                    <div className="text-xs font-semibold text-slate-900 dark:text-white leading-tight">
                      {currentUser.full_name}
                    </div>
                    <div className="text-[10px] text-teal-700 dark:text-teal-400 font-semibold leading-none">
                      {currentUser.role}
                    </div>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                </button>

                {userDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-60 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 py-2 z-50 space-y-1">
                    <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
                      <div className="font-bold text-xs text-slate-900 dark:text-white">{currentUser.full_name}</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono truncate">{currentUser.email}</div>
                      <span className="inline-block mt-1 text-[10px] font-semibold text-teal-800 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 px-2 py-0.5 rounded-md">
                        {currentUser.role}
                      </span>
                    </div>

                    <button
                      onClick={() => {
                        setUserDropdownOpen(false);
                        handleNavClick('my-complaints');
                      }}
                      className="w-full text-left px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-2"
                    >
                      <UserIcon className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                      <span>My Submitted Complaints</span>
                    </button>

                    {currentUser.role === 'Administrator' && (
                      <button
                        onClick={() => {
                          setUserDropdownOpen(false);
                          handleNavClick('admin-users');
                        }}
                        className="w-full text-left px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-2"
                      >
                        <Users className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                        <span>User Role Directory</span>
                      </button>
                    )}

                    <div className="pt-1 border-t border-slate-100 dark:border-slate-800">
                      <button
                        onClick={handleLogout}
                        className="w-full text-left px-3 py-2 text-xs font-semibold text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors flex items-center gap-2"
                      >
                        <LogOut className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                        <span>Sign Out Session</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleNavClick('login')}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <LogIn className="w-3.5 h-3.5 text-teal-700 dark:text-teal-400" />
                  <span>Sign In</span>
                </button>

                <button
                  onClick={() => handleNavClick('signup')}
                  className="px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-900 dark:bg-teal-600 hover:bg-slate-800 dark:hover:bg-teal-500 rounded-lg transition-colors shadow-2xs flex items-center gap-1.5"
                >
                  <UserPlus className="w-3.5 h-3.5 text-teal-400 dark:text-white" />
                  <span>Register</span>
                </button>
              </div>
            )}

            {/* Mobile menu toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-md text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 pt-2 pb-4 space-y-1">
          <button
            onClick={() => handleNavClick('landing')}
            className="w-full text-left px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-md"
          >
            Home
          </button>
          <button
            onClick={() => handleNavClick('report')}
            className="w-full text-left px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-md"
          >
            Report an Issue
          </button>
          <button
            onClick={() => handleNavClick('track')}
            className="w-full text-left px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-md"
          >
            Track Complaint
          </button>
          <button
            onClick={() => handleNavClick('admin-overview')}
            className="w-full text-left px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-md"
          >
            Admin Dashboard
          </button>
          <button
            onClick={() => handleNavClick('admin-complaints')}
            className="w-full text-left px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-md"
          >
            All Complaints
          </button>
          <button
            onClick={() => handleNavClick('admin-incidents')}
            className="w-full text-left px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-md"
          >
            Incident Intelligence
          </button>
          <button
            onClick={() => handleNavClick('map')}
            className="w-full text-left px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-md"
          >
            Interactive Civic Map
          </button>
          <button
            onClick={() => handleNavClick('admin-analytics')}
            className="w-full text-left px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-md"
          >
            Analytics & Accountability
          </button>
          <button
            onClick={() => handleNavClick('admin-settings')}
            className="w-full text-left px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-md"
          >
            AI Priority Settings
          </button>
        </div>
      )}
    </header>
  );
};
