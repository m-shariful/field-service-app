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

export async function apiGet<T>(path: string): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`);
  } catch {
    throw new ApiError("Unable to connect to the server.", 0, "NETWORK_ERROR");
  }

  if (!response.ok) {
    let errorData: ApiErrorResponse | undefined;

    try {
      errorData = (await response.json()) as ApiErrorResponse;
    } catch {
      // Response did not contain JSON.
    }

    throw new ApiError(
      errorData?.error?.message ?? "API request failed.",
      response.status,
      errorData?.error?.code,
    );
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
