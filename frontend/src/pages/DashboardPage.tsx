import React, { useEffect, useState } from "react";
import { MetricsOverviewCards } from "@/features/dashboard/MetricsOverviewCards";
import { SystemHealthCard } from "@/features/dashboard/SystemHealthCard";
import { TelemetryStream } from "@/features/dashboard/TelemetryStream";
import {
  healthGetHealth,
  healthReadyGetReadiness,
  healthStartupGetStartup,
} from "@/client/sdk.gen";
import { useAuth } from "@/hooks/useAuth";

export const DashboardPage: React.FC = () => {
  const { user, isAuthenticated } = useAuth();
  const [apiStatus, setApiStatus] = useState<string>("CHECKING");
  const [databaseHealthy, setDatabaseHealthy] = useState<boolean | null>(null);
  const [cacheHealthy, setCacheHealthy] = useState<boolean | null>(null);
  const [migrationsHealthy, setMigrationsHealthy] = useState<boolean | null>(null);

  const loadDashboardData = async () => {
    try {
      const healthRes = await healthGetHealth();
      setApiStatus(healthRes.response?.ok ? "ONLINE" : "DEGRADED");
    } catch {
      setApiStatus("OFFLINE");
    }

    try {
      const readyRes = await healthReadyGetReadiness();
      const deps = (readyRes.data?.dependencies ?? {}) as Record<string, unknown>;
      setDatabaseHealthy(Boolean(readyRes.response?.ok && deps.database === "healthy"));
      setCacheHealthy(Boolean(readyRes.response?.ok && deps.valkey === "healthy"));
    } catch {
      setDatabaseHealthy(false);
      setCacheHealthy(false);
    }

    try {
      const startupRes = await healthStartupGetStartup();
      setMigrationsHealthy(Boolean(startupRes.response?.ok));
    } catch {
      setMigrationsHealthy(false);
    }
  };

  useEffect(() => {
    void loadDashboardData();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground truncate max-w-lg">
          Hi, {user?.full_name || user?.email} 👋
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Bertcom Africa operating system overview.
        </p>
      </div>

      <MetricsOverviewCards
        apiStatus={apiStatus}
        authHealthy={isAuthenticated}
        databaseHealthy={databaseHealthy}
        cacheHealthy={cacheHealthy}
        migrationsHealthy={migrationsHealthy}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SystemHealthCard />
        <TelemetryStream />
      </div>
    </div>
  );
};

export default DashboardPage;
