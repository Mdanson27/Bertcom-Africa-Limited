import { createAuthClient } from "@neondatabase/neon-js/auth";

const authUrl = (import.meta.env.VITE_NEON_AUTH_URL || "").trim().replace(/\/$/, "");

export const isNeonAuthConfigured = Boolean(authUrl);

type AuthError = { message?: string } | null | undefined;

interface BertcomNeonAuthClient {
  getSession: () => Promise<{
    data?: {
      session?: unknown;
      user?: Record<string, unknown>;
    } | null;
    error?: AuthError;
  }>;
  token: () => Promise<{
    data?: { token?: string } | null;
    error?: AuthError;
  }>;
  signIn: {
    email: (input: { email: string; password: string }) => Promise<{
      data?: unknown;
      error?: AuthError;
    }>;
    social: (input: {
      provider: "google";
      callbackURL: string;
    }) => Promise<{
      data?: unknown;
      error?: AuthError;
    }>;
  };
  signOut: () => Promise<unknown>;
}

const authClient: BertcomNeonAuthClient | null = isNeonAuthConfigured
  ? (createAuthClient(authUrl) as unknown as BertcomNeonAuthClient)
  : null;

export function getNeonAuthClient(): BertcomNeonAuthClient {
  if (!authClient) {
    throw new Error("Bertcom authentication is not configured yet.");
  }
  return authClient;
}

export function getAuthCallbackUrl(): string {
  return new URL(import.meta.env.BASE_URL || "/", window.location.origin).toString();
}
