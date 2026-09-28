import { create } from "zustand";

import { ApiError } from "@/api/api-error";
import { getCurrentUser, type AuthResponse, type AuthUser } from "@/api/auth";
import {
  clearAccessToken,
  getAccessToken,
  saveAccessToken,
} from "@/storage/auth-storage";

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  // Learning: validates a persisted session with the backend.
  initializeAuth: () => Promise<void>;

  // Learning: stores the application's JWT and authenticated user
  // after any successful authentication method.
  setSession: (authResponse: AuthResponse) => Promise<void>;

  // Learning: removes both the local credential and in-memory session.
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  initializeAuth: async () => {
    console.log("=== Auth initialization started ===");

    set({
      isLoading: true,
    });

    try {
      const accessToken = await getAccessToken();

      console.log("Perisisted access token exists:", Boolean(accessToken));

      if (!accessToken) {
        set({
          user: null,
          isAuthenticated: false,
          isLoading: false,
        });

        console.log("No persisted session found.");

        return;
      }

      const response = await getCurrentUser();

      console.log("Session restored from /api/auth/me: ", response.data);

      set({
        user: response.data,
        isAuthenticated: true,
        isLoading: false,
      });

      console.log("=== Auth initialization completed ===");
    } catch (error) {
      console.log("Auth initialization failed:", error);

      // Learning: a 401 means the locally persisted credential
      // is no longer a valid application session.
      if (error instanceof ApiError && error.status === 401) {
        await clearAccessToken();
        console.log("Invalid persisted token cleared.");
      }

      set({
        user: null,
        isAuthenticated: false,
        isLoading: false,
      });
    }
  },

  setSession: async (authResponse) => {
    await saveAccessToken(authResponse.data.token);

    set({
      user: authResponse.data.user,
      isAuthenticated: true,
      isLoading: false,
    });
  },

  signOut: async () => {
    await clearAccessToken();

    set({
      user: null,
      isAuthenticated: false,
      isLoading: false,
    });
  },
}));
