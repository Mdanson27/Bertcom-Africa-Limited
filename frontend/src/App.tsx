import React, { useEffect, useState } from "react";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { ThemeProvider } from "@/hooks/useTheme";
import { AppShell } from "@/components/layout/AppShell";
import type { NavItem } from "@/components/layout/Sidebar";
import { LoginPage } from "@/pages/LoginPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { UsersPage } from "@/pages/UsersPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { HomePage } from "@/pages/HomePage";
import { ProjectsPage } from "@/pages/ProjectsPage";
import { DocumentsPage } from "@/pages/DocumentsPage";
import { BusinessPage } from "@/pages/BusinessPage";
import { TasksPage } from "@/pages/TasksPage";
import { ReportsPage } from "@/pages/ReportsPage";
import { TelemetryStream } from "@/features/dashboard/TelemetryStream";
import { SystemHealthProvider, useSystemHealth } from "@/features/dashboard/SystemHealthContext";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { ToastProvider } from "@/components/ui/Toast";

const AuthenticatedApp: React.FC = () => {
  const { isAuthenticated, isLoading, isPlatformAdmin, refreshProfile } = useAuth();
  const { refreshHealth } = useSystemHealth();
  const [currentTab, setCurrentTab] = useState<NavItem>("home");
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (isAuthenticated) setCurrentTab(isPlatformAdmin ? "dashboard" : "home");
  }, [isAuthenticated, isPlatformAdmin]);

  if (isLoading) return <div className="min-h-screen flex items-center justify-center bg-background"><LoadingSpinner label="Opening Bertcom..." /></div>;
  if (!isAuthenticated) return <LoginPage />;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.allSettled([refreshProfile(), ...(isPlatformAdmin ? [refreshHealth()] : [])]);
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <AppShell currentTab={currentTab} onSelectTab={setCurrentTab} onRefreshAll={handleRefresh} isRefreshing={isRefreshing}>
      {currentTab === "dashboard" && isPlatformAdmin && <DashboardPage />}
      {currentTab === "users" && isPlatformAdmin && <UsersPage />}
      {currentTab === "telemetry" && isPlatformAdmin && <div className="max-w-4xl"><TelemetryStream /></div>}
      {currentTab === "home" && <HomePage onNavigate={setCurrentTab} />}
      {currentTab === "projects" && <ProjectsPage />}
      {currentTab === "documents" && <DocumentsPage />}
      {currentTab === "business" && <BusinessPage />}
      {currentTab === "tasks" && <TasksPage />}
      {currentTab === "reports" && <ReportsPage />}
      {currentTab === "settings" && <SettingsPage />}
    </AppShell>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <SystemHealthProvider>
            <ToastProvider><AuthenticatedApp /></ToastProvider>
          </SystemHealthProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
