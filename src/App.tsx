import React, { useState } from 'react';
import { CivicProvider, useCivic } from './context/CivicContext';
import { Navbar } from './components/layout/Navbar';
import { AdminSidebar } from './components/layout/AdminSidebar';
import { LandingPage } from './components/landing/LandingPage';
import { ComplaintForm } from './components/citizen/ComplaintForm';
import { TrackComplaint } from './components/citizen/TrackComplaint';
import { MyComplaints } from './components/citizen/MyComplaints';
import { AdminOverview } from './components/admin/AdminOverview';
import { ComplaintList } from './components/admin/ComplaintList';
import { IncidentIntelligence } from './components/admin/IncidentIntelligence';
import { CivicMapView } from './components/admin/CivicMapView';
import { AnalyticsView } from './components/admin/AnalyticsView';
import { DepartmentManagement } from './components/admin/DepartmentManagement';
import { ResolutionTracking } from './components/admin/ResolutionTracking';
import { PrioritySettings } from './components/admin/PrioritySettings';
import { UserManagement } from './components/admin/UserManagement';
import { LoginPage } from './components/auth/LoginPage';
import { SignupPage } from './components/auth/SignupPage';
import { ForgotPasswordPage } from './components/auth/ForgotPasswordPage';
import { CivicAssistantChat } from './components/common/CivicAssistantChat';
import { PriorityLevel, ComplaintStatus, CivicCategory } from './types/civic';
import { AlertTriangle, RefreshCw, ShieldAlert, LogIn, Loader2 } from 'lucide-react';

function MainApp() {
  const { fetchError, refreshData, currentUser, currentRole, authLoading } = useCivic();

  const [currentView, setCurrentView] = useState<string>('landing');
  const [selectedComplaintId, setSelectedComplaintId] = useState<string>('');
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | undefined>();

  // Filter cross-navigation state
  const [filterPriority, setFilterPriority] = useState<PriorityLevel | undefined>();
  const [filterStatus, setFilterStatus] = useState<ComplaintStatus | undefined>();
  const [filterCategory, setFilterCategory] = useState<CivicCategory | undefined>();

  const handleSelectIncident = (incidentId: string) => {
    setSelectedIncidentId(incidentId);
    setCurrentView('admin-incidents');
  };

  const isAdminView = currentView.startsWith('admin');
  const canAccessAdmin = currentRole === 'Administrator' || currentRole === 'Department Officer';

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
        <div className="text-center space-y-3 bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-md max-w-sm w-full">
          <Loader2 className="w-8 h-8 animate-spin text-teal-600 dark:text-teal-400 mx-auto" />
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">Verifying session & civic permissions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors">
      {fetchError && (
        <div className="bg-red-600 text-white px-4 py-2.5 text-xs flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-200 shrink-0" />
            <span className="font-medium">{fetchError}</span>
          </div>
          <button
            onClick={() => refreshData()}
            className="flex items-center gap-1 bg-red-700 hover:bg-red-800 px-2.5 py-1 rounded text-xs font-semibold transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </button>
        </div>
      )}

      <Navbar currentView={currentView} setCurrentView={setCurrentView} />

      {isAdminView ? (
        canAccessAdmin ? (
          <div className="flex-1 flex flex-col md:flex-row">
            <AdminSidebar currentView={currentView} setCurrentView={setCurrentView} />
            <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl overflow-y-auto">
              {currentView === 'admin-overview' && (
                <AdminOverview
                  setCurrentView={setCurrentView}
                  setFilterPriority={(p) => {
                    setFilterPriority(p);
                    setCurrentView('admin-complaints');
                  }}
                  setFilterStatus={(s) => {
                    setFilterStatus(s);
                    setCurrentView('admin-complaints');
                  }}
                  setFilterCategory={(c) => {
                    setFilterCategory(c);
                    setCurrentView('admin-complaints');
                  }}
                  setSelectedComplaintId={(id) => {
                    setSelectedComplaintId(id);
                  }}
                />
              )}

              {currentView === 'admin-complaints' && (
                <ComplaintList
                  initialFilterPriority={filterPriority}
                  initialFilterStatus={filterStatus}
                  initialFilterCategory={filterCategory}
                  onSelectIncident={handleSelectIncident}
                />
              )}

              {currentView === 'admin-incidents' && (
                <IncidentIntelligence
                  initialIncidentId={selectedIncidentId}
                  setCurrentView={setCurrentView}
                />
              )}

              {currentView === 'admin-map' && (
                <CivicMapView
                  onSelectComplaint={(c) => {
                    setSelectedComplaintId(c.id);
                    setCurrentView('track');
                  }}
                  onSelectIncident={handleSelectIncident}
                />
              )}

              {currentView === 'admin-analytics' && <AnalyticsView />}

              {currentView === 'admin-departments' && <DepartmentManagement />}

              {currentView === 'admin-resolutions' && <ResolutionTracking />}

              {currentView === 'admin-settings' && <PrioritySettings />}

              {currentView === 'admin-users' && (
                currentRole === 'Administrator' ? (
                  <UserManagement />
                ) : (
                  <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl border border-rose-200 dark:border-rose-900/60 text-center space-y-3">
                    <ShieldAlert className="w-8 h-8 text-rose-600 dark:text-rose-400 mx-auto" />
                    <h3 className="font-bold text-slate-900 dark:text-white text-base">Administrator Access Required</h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400">The User Role Directory requires Administrator permissions.</p>
                  </div>
                )
              )}
            </main>
          </div>
        ) : (
          <main className="flex-1 max-w-3xl mx-auto p-8 my-12 text-center space-y-4">
            <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl border border-rose-200 dark:border-rose-900/60 shadow-lg space-y-4">
              <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-950/80 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">Protected Municipal Console</h2>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed max-w-md mx-auto">
                Access to the Municipal Operations Command & Triage Console requires an authenticated Administrator or Department Officer account.
              </p>
              <div className="pt-2 flex justify-center gap-3">
                <button
                  onClick={() => setCurrentView('login')}
                  className="px-5 py-2.5 bg-slate-900 dark:bg-teal-600 hover:bg-slate-800 dark:hover:bg-teal-500 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-2 transition-colors"
                >
                  <LogIn className="w-4 h-4 text-teal-400 dark:text-white" />
                  <span>Sign In as Authorized Officer</span>
                </button>
                <button
                  onClick={() => setCurrentView('landing')}
                  className="px-5 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-xs rounded-xl transition-colors"
                >
                  Return to Home
                </button>
              </div>
            </div>
          </main>
        )
      ) : (
        <main className="flex-1">
          {currentView === 'landing' && <LandingPage setCurrentView={setCurrentView} />}

          {currentView === 'login' && <LoginPage setCurrentView={setCurrentView} />}

          {currentView === 'signup' && <SignupPage setCurrentView={setCurrentView} />}

          {currentView === 'forgot-password' && <ForgotPasswordPage setCurrentView={setCurrentView} />}

          {currentView === 'report' && (
            <ComplaintForm
              setCurrentView={setCurrentView}
              setSelectedComplaintId={(id) => {
                setSelectedComplaintId(id);
                setCurrentView('track');
              }}
            />
          )}

          {currentView === 'track' && (
            <TrackComplaint
              initialComplaintId={selectedComplaintId}
              setCurrentView={setCurrentView}
            />
          )}

          {currentView === 'my-complaints' && (
            <MyComplaints
              setCurrentView={setCurrentView}
              setSelectedComplaintId={(id) => {
                setSelectedComplaintId(id);
                setCurrentView('track');
              }}
            />
          )}

          {currentView === 'map' && (
            <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
              <CivicMapView
                onSelectComplaint={(c) => {
                  setSelectedComplaintId(c.id);
                  setCurrentView('track');
                }}
                onSelectIncident={handleSelectIncident}
              />
            </div>
          )}
        </main>
      )}

      {/* Floating Smart AI Civic Assistant Widget */}
      <CivicAssistantChat />
    </div>
  );
}

export default function App() {
  return (
    <CivicProvider>
      <MainApp />
    </CivicProvider>
  );
}
