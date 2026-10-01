import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import "@/lib/api";
import {
  healthGetHealth,
  healthReadyGetReadiness,
  healthStartupGetStartup,
} from "@/client/sdk.gen";

export type HealthStatus = "healthy" | "unhealthy" | "loading";

export interface SubsystemHealth {
  name: string;
  status: HealthStatus;
  latencyMs?: number;
  details: string;
}

interface SystemHealthContextValue {
  api: SubsystemHealth;
  database: SubsystemHealth;
  valkey: SubsystemHealth;
  migrations: SubsystemHealth;
  clusterHealthy: boolean | null;
  isChecking: boolean;
  lastCheckedAt: Date | null;
  refreshHealth: () => Promise<void>;
}

const initialApi: SubsystemHealth = {
  name: "Litestar ASGI API",
  status: "loading",
  details: "Checking API",
};
const initialDatabase: SubsystemHealth = {
  name: "PostgreSQL & TimescaleDB",
  status: "loading",
  details: "Checking database",
};
const initialValkey: SubsystemHealth = {
  name: "Valkey In-Memory Cache",
  status: "loading",
  details: "Checking cache",
};
const initialMigrations: SubsystemHealth = {
  name: "Alembic Migrations",
  status: "loading",
  details: "Checking schema",
};

const SystemHealthContext = createContext<SystemHealthContextValue | undefined>(undefined);

const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

function extractDependencies(result: unknown): Record<string, unknown> {
  const response = result as {
    data?: Record<string, unknown>;
    error?: Record<string, unknown>;
  };
  const payload = response?.data ?? response?.error ?? {};
  const detail =
    payload.detail && typeof payload.detail === "object"
      ? (payload.detail as Record<string, unknown>)
      : undefined;
  const deps = payload.dependencies ?? detail?.dependencies;
  return deps && typeof deps === "object" ? (deps as Record<string, unknown>) : {};
}

function extractSchemaVersion(result: unknown): string | null {
  const response = result as { data?: Record<string, unknown> };
  const version = response?.data?.schema_version;
  return typeof version === "string" && version ? version : null;
}

async function runReadinessAttempt(): Promise<{
  databaseHealthy: boolean;
  valkeyHealthy: boolean;
  latencyMs: number;
}> {
  const start = performance.now();
  try {
    const result = await healthReadyGetReadiness();
    const latencyMs = Math.round(performance.now() - start);
    const deps = extractDependencies(result);
    return {
      databaseHealthy: deps.database === "healthy",
      valkeyHealthy: deps.valkey === "healthy",
      latencyMs,
    };
  } catch {
    return {
      databaseHealthy: false,
      valkeyHealthy: false,
      latencyMs: Math.round(performance.now() - start),
    };
  }
}

export const SystemHealthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [api, setApi] = useState<SubsystemHealth>(initialApi);
  const [database, setDatabase] = useState<SubsystemHealth>(initialDatabase);
  const [valkey, setValkey] = useState<SubsystemHealth>(initialValkey);
  const [migrations, setMigrations] = useState<SubsystemHealth>(initialMigrations);
  const [isChecking, setIsChecking] = useState(false);
  const [lastCheckedAt, setLastCheckedAt] = useState<Date | null>(null);
  const checkingRef = useRef(false);

  const refreshHealth = useCallback(async () => {
    if (checkingRef.current) return;

    checkingRef.current = true;
    setIsChecking(true);

    try {
      const apiPromise = (async (): Promise<SubsystemHealth> => {
        const start = performance.now();
        try {
          const result = await healthGetHealth();
          const latencyMs = Math.round(performance.now() - start);
          const healthy = Boolean(result.response?.ok);
          return {
            name: "Litestar ASGI API",
            status: healthy ? "healthy" : "unhealthy",
            latencyMs,
            details: healthy ? "HTTP 200 OK" : "API degraded",
          };
        } catch {
          return {
            name: "Litestar ASGI API",
            status: "unhealthy",
            latencyMs: Math.round(performance.now() - start),
            details: "API unreachable",
          };
        }
      })();

      const readinessPromise = (async () => {
        let attempt = await runReadinessAttempt();
        let retried = false;

        if (!attempt.databaseHealthy || !attempt.valkeyHealthy) {
          retried = true;
          await sleep(900);
          attempt = await runReadinessAttempt();
        }

        const suffix = retried ? " after retry" : "";

        return {
          database: {
            name: "PostgreSQL & TimescaleDB",
            status: attempt.databaseHealthy ? "healthy" : "unhealthy",
            latencyMs: attempt.latencyMs,
            details: attempt.databaseHealthy
              ? `Connection verified${suffix}`
              : "Database readiness failed",
          } satisfies SubsystemHealth,
          valkey: {
            name: "Valkey In-Memory Cache",
            status: attempt.valkeyHealthy ? "healthy" : "unhealthy",
            latencyMs: attempt.latencyMs,
            details: attempt.valkeyHealthy
              ? `Ping verified${suffix}`
              : "Valkey readiness failed",
          } satisfies SubsystemHealth,
        };
      })();

      const migrationsPromise = (async (): Promise<SubsystemHealth> => {
        const start = performance.now();
        try {
          const result = await healthStartupGetStartup();
          const latencyMs = Math.round(performance.now() - start);
          const healthy = Boolean(result.response?.ok);
          const schemaVersion = extractSchemaVersion(result);
          return {
            name: "Alembic Migrations",
            status: healthy ? "healthy" : "unhealthy",
            latencyMs,
            details: healthy
              ? `Schema head verified${schemaVersion ? ` · ${schemaVersion}` : ""}`
              : "Migration check failed",
          };
        } catch {
          return {
            name: "Alembic Migrations",
            status: "unhealthy",
            latencyMs: Math.round(performance.now() - start),
            details: "Migration probe failed",
          };
        }
      })();

      const [nextApi, nextReadiness, nextMigrations] = await Promise.all([
        apiPromise,
        readinessPromise,
        migrationsPromise,
      ]);

      setApi(nextApi);
      setDatabase(nextReadiness.database);
      setValkey(nextReadiness.valkey);
      setMigrations(nextMigrations);
      setLastCheckedAt(new Date());
    } finally {
      checkingRef.current = false;
      setIsChecking(false);
    }
  }, []);

  useEffect(() => {
    void refreshHealth();
    const interval = window.setInterval(() => {
      void refreshHealth();
    }, 30000);

    return () => window.clearInterval(interval);
  }, [refreshHealth]);

  const clusterHealthy = useMemo(() => {
    const statuses = [api.status, database.status, valkey.status, migrations.status];
    if (statuses.some((status) => status === "loading")) return null;
    return statuses.every((status) => status === "healthy");
  }, [api.status, database.status, valkey.status, migrations.status]);

  const value = useMemo(
    () => ({
      api,
      database,
      valkey,
      migrations,
      clusterHealthy,
      isChecking,
      lastCheckedAt,
      refreshHealth,
    }),
    [
      api,
      database,
      valkey,
      migrations,
      clusterHealthy,
      isChecking,
      lastCheckedAt,
      refreshHealth,
    ],
  );

  return <SystemHealthContext.Provider value={value}>{children}</SystemHealthContext.Provider>;
};

export function useSystemHealth(): SystemHealthContextValue {
  const context = useContext(SystemHealthContext);
  if (!context) {
    throw new Error("useSystemHealth must be used within SystemHealthProvider");
  }
  return context;
}
