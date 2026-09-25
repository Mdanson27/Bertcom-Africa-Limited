import { createAuthClient } from "@neondatabase/neon-js/auth";

const authUrl = (import.meta.env.VITE_NEON_AUTH_URL || "").trim().replace(/\/$/, "");

export const isNeonAuthConfigured = Boolean(authUrl);

let client: ReturnType<typeof createAuthClient> | null = null;

export function getNeonAuthClient() {
  if (!authUrl) {
    throw new Error("Bertcom authentication is not configured yet.");
  }

  if (!client) {
    client = createAuthClient(authUrl, {
      fetchOptions: {
        credentials: "include",
      },
    });
  }

  return client;
}

export function getAuthCallbackUrl(): string {
  return new URL(import.meta.env.BASE_URL || "/", window.location.origin).toString();
}
