import {
  clearSessionTokens,
  getAccessToken,
  getRefreshToken,
  saveSessionTokens,
} from "@/storage/auth-storage";

import { authDebug } from "@/debug/auth-debug";
import { ApiError } from "./api-error";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL;

if (!API_BASE_URL) {
  throw new Error("EXPO_PUBLIC_API_URL is not configured");
}

interface ApiErrorResponse {
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
}

export interface RefreshTokenResponse {
  data: {
    accessToken: string;
    refreshToken: string;
  };
}

type UnauthorizedHandler = () => void | Promise<void>;

let unauthorizedHandler: UnauthorizedHandler | null = null;

/**
 * Only one refresh request can run at a time.
 *
 * Learning:
 * If five API requests receive 401 at the same time,
 * we do not want five refresh requests hitting the backend.
 *
 * Instead:
 *
 * Request A ─┐
 * Request B ─┤
 * Request C ─┼──> same refreshPromise
 * Request D ─┤
 * Request E ─┘
 *
 * One refresh happens and all callers wait for it.
 */
let refreshPromise: Promise<RefreshResult> | null = null;

type RefreshResult = "REFRESHED" | "INVALID_SESSION" | "NETWORK_ERROR";

export function setUnauthorizedHandler(handler: UnauthorizedHandler): void {
  unauthorizedHandler = handler;
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const accessToken = await getAccessToken();

  if (!accessToken) {
    return {};
  }

  return {
    Authorization: `Bearer ${accessToken}`,
  };
}

async function parseApiError(response: Response): Promise<ApiError> {
  let payload: ApiErrorResponse | null = null;

  try {
    payload = (await response.json()) as ApiErrorResponse;
  } catch {
    // Response body was not valid JSON.
  }

  const message =
    payload?.error?.message ?? `Request failed with status ${response.status}`;

  const code = payload?.error?.code;

  return new ApiError(message, response.status, code);
}

/**
 * Public request handler.
 *
 * This must NOT try to refresh a token.
 *
 * It is used for:
 * - login
 * - register
 * - Google login
 * - refresh
 * - logout
 */
async function publicRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${API_BASE_URL}${path}`;

  const headers = new Headers(options.headers);

  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  authDebug("API_PUBLIC_REQUEST", {
    method: options.method ?? "GET",
    path,
  });

  let response: Response;

  try {
    response = await fetch(url, {
      ...options,
      headers,
    });
  } catch (error) {
    authDebug("API_NETWORK_ERROR", {
      path,
      error: error instanceof Error ? error.message : String(error),
    });

    throw error;
  }

  if (response.ok) {
    authDebug("API_PUBLIC_SUCCESS", {
      method: options.method ?? "GET",
      path,
      status: response.status,
    });

    return response.json() as Promise<T>;
  }

  const apiError = await parseApiError(response);

  authDebug("API_PUBLIC_ERROR", {
    method: options.method ?? "GET",
    path,
    status: response.status,
    code: apiError.code,
  });

  throw apiError;
}

/**
 * Refresh the access token.
 *
 * Important:
 * - The refresh endpoint itself is public.
 * - It must NOT recursively call refresh.
 * - A 401 means the session is invalid.
 * - A network error does NOT automatically mean logout.
 */
async function performRefreshAccessToken(): Promise<RefreshResult> {
  const refreshToken = await getRefreshToken();

  if (!refreshToken) {
    authDebug("REFRESH_NO_TOKEN");

    return "INVALID_SESSION";
  }

  authDebug("REFRESH_START", {
    hasRefreshToken: true,
  });

  try {
    const response = await publicRequest<RefreshTokenResponse>(
      "/api/auth/refresh",
      {
        method: "POST",
        body: JSON.stringify({
          refreshToken,
        }),
      },
    );

    await saveSessionTokens(
      response.data.accessToken,
      response.data.refreshToken,
    );

    authDebug("REFRESH_SUCCESS", {
      accessTokenRotated: true,
      refreshTokenRotated: true,
    });

    return "REFRESHED";
  } catch (error) {
    if (error instanceof ApiError) {
      authDebug("REFRESH_FAILED", {
        status: error.status,
        code: error.code,
      });

      if (error.status === 401) {
        /**
         * Learning:
         * A refresh-token 401 means the server no longer
         * considers the refresh session valid.
         *
         * Examples:
         * - absolute timeout
         * - idle timeout
         * - logout
         * - refresh-token reuse
         * - invalid refresh token
         */
        await clearSessionTokens();

        authDebug("SESSION_INVALIDATED_AFTER_REFRESH_FAILURE", {
          reason: error.code,
        });

        return "INVALID_SESSION";
      }

      return "NETWORK_ERROR";
    }

    authDebug("REFRESH_NETWORK_ERROR", {
      error: error instanceof Error ? error.message : String(error),
    });

    return "NETWORK_ERROR";
  }
}

async function refreshAccessToken(): Promise<RefreshResult> {
  if (!refreshPromise) {
    refreshPromise = performRefreshAccessToken();

    refreshPromise.finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
}

interface AuthenticatedRequestOptions extends RequestInit {
  authRequired?: boolean;
  allowRefresh?: boolean;
}

async function request<T>(
  path: string,
  options: AuthenticatedRequestOptions = {},
): Promise<T> {
  const { authRequired = true, allowRefresh = true, ...fetchOptions } = options;

  const url = `${API_BASE_URL}${path}`;

  const headers = new Headers(fetchOptions.headers);

  if (fetchOptions.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (authRequired) {
    const authHeaders = await getAuthHeaders();

    for (const [key, value] of Object.entries(authHeaders)) {
      headers.set(key, value);
    }
  }

  authDebug("API_REQUEST", {
    method: fetchOptions.method ?? "GET",
    path,
    authenticated: authRequired,
    retryEnabled: allowRefresh,
  });

  let response: Response;

  try {
    response = await fetch(url, {
      ...fetchOptions,
      headers,
    });
  } catch (error) {
    authDebug("API_NETWORK_ERROR", {
      method: fetchOptions.method ?? "GET",
      path,
      error: error instanceof Error ? error.message : String(error),
    });

    throw error;
  }

  if (response.ok) {
    authDebug("API_SUCCESS", {
      method: fetchOptions.method ?? "GET",
      path,
      status: response.status,
    });

    return response.json() as Promise<T>;
  }

  const apiError = await parseApiError(response);

  if (response.status === 401 && authRequired) {
    authDebug("ACCESS_TOKEN_REJECTED", {
      method: fetchOptions.method ?? "GET",
      path,
      status: response.status,
      code: apiError.code,
      canRefresh: allowRefresh,
    });

    if (allowRefresh) {
      const refreshResult = await refreshAccessToken();

      if (refreshResult === "REFRESHED") {
        authDebug("API_REQUEST_RETRY", {
          method: fetchOptions.method ?? "GET",
          path,
        });

        const retryResponse = await request<T>(path, {
          ...fetchOptions,
          authRequired: true,
          allowRefresh: false,
        });

        authDebug("API_REQUEST_RETRY_SUCCESS", {
          method: fetchOptions.method ?? "GET",
          path,
        });

        return retryResponse;
      }

      if (refreshResult === "INVALID_SESSION") {
        authDebug("UNAUTHORIZED_SESSION", {
          reason: "refresh_session_invalid",
        });

        await unauthorizedHandler?.();
      }

      if (refreshResult === "NETWORK_ERROR") {
        authDebug("REFRESH_NETWORK_FAILURE_SESSION_PRESERVED");
      }
    } else {
      authDebug("UNAUTHORIZED_AFTER_REFRESH_RETRY", {
        path,
      });

      await unauthorizedHandler?.();
    }
  }

  authDebug("API_ERROR", {
    method: fetchOptions.method ?? "GET",
    path,
    status: response.status,
    code: apiError.code,
  });

  throw apiError;
}

export async function apiGet<T>(path: string): Promise<T> {
  return request<T>(path, {
    method: "GET",
  });
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function apiPostPublic<T>(
  path: string,
  body: unknown,
): Promise<T> {
  return publicRequest<T>(path, {
    method: "POST",
    body: JSON.stringify(body),
  });
}
