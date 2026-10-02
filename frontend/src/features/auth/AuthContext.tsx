import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { ApiError } from "@/lib/api";
import {
  AUTH_SESSION_EXPIRED_EVENT,
  clearCachedAccessToken,
  getAccessToken,
  getCachedAccessToken,
} from "@/lib/authSession";
import {
  getAuthCallbackUrl,
  getNeonAuthClient,
  isNeonAuthConfigured,
} from "@/lib/neonAuth";

export interface AuthUser {
  id: string;
  email: string;
  full_name: string;
  is_active: boolean;
  is_superuser: boolean;
  role: string;
  image?: string | null;
}

const PLATFORM_ADMIN_EMAIL = "automindsafrica@gmail.com";

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isPlatformAdmin: boolean;
  authConfigured: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function normalizeRole(role: unknown): string {
  if (Array.isArray(role)) {
    return role.map(String).join(",");
  }
  return typeof role === "string" && role ? role : "authenticated";
}

function mapNeonUser(raw: Record<string, unknown>): AuthUser {
  const role = normalizeRole(raw.role);
  const email = String(raw.email || "").trim().toLowerCase();

  return {
    id: String(raw.id || ""),
    email,
    full_name: String(raw.name || raw.email || "Bertcom User"),
    is_active: !Boolean(raw.banned),
    is_superuser: email === PLATFORM_ADMIN_EMAIL,
    role,
    image: typeof raw.image === "string" ? raw.image : null,
  };
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(() => getCachedAccessToken());
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const clearSession = useCallback(() => {
    clearCachedAccessToken();
    setToken(null);
    setUser(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!isNeonAuthConfigured) {
      clearSession();
      setIsLoading(false);
      return;
    }

    try {
      const authClient = getNeonAuthClient();
      const sessionResult = await authClient.getSession();

      if (sessionResult.error || !sessionResult.data?.session || !sessionResult.data?.user) {
        clearSession();
        return;
      }

      const jwt = await getAccessToken(true);
      if (!jwt) {
        clearSession();
        return;
      }

      setToken(jwt);
      setUser(mapNeonUser(sessionResult.data.user as unknown as Record<string, unknown>));
    } catch {
      clearSession();
    } finally {
      setIsLoading(false);
    }
  }, [clearSession]);

  useEffect(() => {
    void refreshProfile();
  }, [refreshProfile]);

  useEffect(() => {
    const handleExpiredSession = () => {
      clearSession();
      setIsLoading(false);
    };

    window.addEventListener(AUTH_SESSION_EXPIRED_EVENT, handleExpiredSession);
    return () => window.removeEventListener(AUTH_SESSION_EXPIRED_EVENT, handleExpiredSession);
  }, [clearSession]);

  const login = async (email: string, password: string) => {
    if (!isNeonAuthConfigured) {
      throw new ApiError("Bertcom authentication is not configured yet.");
    }

    setIsLoading(true);
    try {
      const result = await getNeonAuthClient().signIn.email({ email, password });

      if (result.error) {
        throw new ApiError(result.error.message || "Incorrect email or password.");
      }

      await refreshProfile();
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithGoogle = async () => {
    if (!isNeonAuthConfigured) {
      throw new ApiError("Bertcom authentication is not configured yet.");
    }

    const result = await getNeonAuthClient().signIn.social({
      provider: "google",
      callbackURL: getAuthCallbackUrl(),
    });

    if (result?.error) {
      throw new ApiError(result.error.message || "Google sign-in could not be started.");
    }
  };

  const logout = async () => {
    try {
      if (isNeonAuthConfigured) {
        await getNeonAuthClient().signOut();
      }
    } finally {
      clearSession();
    }
  };

  const isPlatformAdmin = Boolean(
    user?.email && user.email.trim().toLowerCase() === PLATFORM_ADMIN_EMAIL,
  );
  const isAdmin = isPlatformAdmin;

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated: !!user,
        isAdmin,
        isPlatformAdmin,
        authConfigured: isNeonAuthConfigured,
        login,
        loginWithGoogle,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
