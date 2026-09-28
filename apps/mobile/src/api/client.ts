// api/client.ts: Central point for token handling

import { getAccessToken } from "@/storage/auth-storage";
import { ApiError } from "./api-error";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL;

if (!API_BASE_URL) {
  throw new Error("EXPO_PUBLIC_API_URL is not configured");
}

interface ApiErrorResponse {
  error?: {
    code?: string;
    message?: string;
  };
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const token = await getAccessToken();

  if (!token) return {};

  return {
    Authorization: `Bearer ${token}`,
  };
}

async function parseApiError(response: Response): Promise<ApiError> {
  let errorData: ApiErrorResponse | undefined;

  try {
    errorData = (await response.json()) as ApiErrorResponse;
  } catch {
    // Response did not contain JSON.
  }

  return new ApiError(
    errorData?.error?.message ?? "API request failed.",
    response.status,
    errorData?.error?.code,
  );
}

export async function apiGet<T>(path: string): Promise<T> {
  let response: Response;

  try {
    const authHeaders = await getAuthHeaders();
    response = await fetch(`${API_BASE_URL}${path}`, { headers: authHeaders });
  } catch {
    throw new ApiError("Unable to connect to the server.", 0, "NETWORK_ERROR");
  }

  if (!response.ok) {
    throw await parseApiError(response);
  }

  return response.json() as Promise<T>;
}

// Expo app
//    │
//    │ Wi-Fi/LAN
//    ▼
// 192.168.0.104:3000
//    │
//    ▼
// Express API

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  let response: Response;

  try {
    const authHeaders = await getAuthHeaders();
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders,
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError("Unable to connect to the server.", 0, "NETWORK_ERROR");
  }

  if (!response.ok) {
    throw await parseApiError(response);
  }

  return response.json() as Promise<T>;
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  let response;

  try {
    const authHeaders = await getAuthHeaders();
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders,
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError("Unable to connect to the server.", 0, "NETWORK_ERROR");
  }

  if (!response.ok) {
    throw await parseApiError(response);
  }

  return response.json() as Promise<T>;
}
