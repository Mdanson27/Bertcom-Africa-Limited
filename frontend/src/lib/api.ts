import { client } from "@/client/client.gen";

export class ApiError extends Error {
  status?: number;
  data?: unknown;
  retryAfter?: number;

  constructor(message: string, status?: number, data?: unknown, retryAfter?: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
    this.retryAfter = retryAfter;
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

/**
 * Parses raw error and response objects from backend / fetch into user-friendly ApiError.
 */
export function parseApiError(error: unknown, response?: Response): ApiError {
  if (!response) {
    return new ApiError(
      "Unable to communicate with the server. Please try again later",
      0,
      error
    );
  }

  const status = response.status;
  const rawData: Record<string, unknown> =
    error && typeof error === "object" ? (error as Record<string, unknown>) : {};

  if (status === 401) {
    return new ApiError("Incorrect email or password", 401, error);
  }

  if (status === 429) {
    let retryAfter: number | undefined;
    const headerVal = response.headers?.get("Retry-After");
    if (headerVal) {
      const parsed = parseInt(headerVal, 10);
      if (!isNaN(parsed) && parsed > 0) retryAfter = parsed;
    }

    if (retryAfter === undefined && rawData) {
      if (typeof rawData.retry_after === "number") {
        retryAfter = rawData.retry_after;
      } else if (typeof rawData.retryAfter === "number") {
        retryAfter = rawData.retryAfter;
      } else if (typeof rawData.retry_after === "string") {
        const parsed = parseInt(rawData.retry_after, 10);
        if (!isNaN(parsed)) retryAfter = parsed;
      }
    }

    const message =
      retryAfter !== undefined
        ? `Too many requests. Please wait ${retryAfter} seconds before retrying`
        : "Too many requests. Please wait a few seconds before retrying";

    return new ApiError(message, 429, error, retryAfter);
  }

  if (status >= 500 && status <= 599) {
    return new ApiError(
      "Unable to communicate with the server. Please try again later",
      status,
      error
    );
  }

  let extractedMessage: string | null = null;
  if (rawData) {
    if (typeof rawData.detail === "string" && rawData.detail.trim()) {
      extractedMessage = rawData.detail.trim();
    } else if (Array.isArray(rawData.detail) && rawData.detail.length > 0) {
      extractedMessage = rawData.detail
        .map((d: unknown) =>
          typeof d === "string"
            ? d
            : (d as Record<string, unknown>)?.msg ||
              (d as Record<string, unknown>)?.message ||
              JSON.stringify(d)
        )
        .join("; ");
    } else if (typeof rawData.error === "string" && rawData.error.trim()) {
      extractedMessage = rawData.error.trim();
    } else if (typeof rawData.message === "string" && rawData.message.trim()) {
      extractedMessage = rawData.message.trim();
    }
  }

  if (typeof error === "string" && error.trim()) {
    extractedMessage = error.trim();
  }

  const finalMessage = extractedMessage || response.statusText || "An unexpected error occurred.";
  return new ApiError(finalMessage, status, error);
}

const rawUrl = (import.meta.env.VITE_API_URL || "").trim();
const sanitizedBase = rawUrl ? rawUrl.replace(/\/api\/v1\/?$/, "").replace(/\/$/, "") : "";

client.setConfig({
  baseUrl: sanitizedBase,
  auth: () => {
    const token = localStorage.getItem("access_token");
    return token ? token : "";
  },
});

client.interceptors.error.use((error, response, request, options) => {
  const parsedError = parseApiError(error, response);

  if (import.meta.env.DEV) {
    console.warn(`[API Error ${response?.status ?? "Network"}]:`, {
      message: parsedError.message,
      status: parsedError.status,
      retryAfter: parsedError.retryAfter,
      url: request?.url || (options as { url?: string })?.url,
      data: parsedError.data,
    });
  }

  return parsedError;
});

export { client };
