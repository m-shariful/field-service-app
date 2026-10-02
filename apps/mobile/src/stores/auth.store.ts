import { create } from "zustand";

import { setUnauthorizedHandler } from "@/api/client";

import { getCurrentUser, type AuthResponse } from "@/api/auth";

import { authDebug } from "@/debug/auth-debug";

import {
  clearSessionTokens,
  getAccessToken,
  getRefreshToken,
  saveSessionTokens,
} from "@/storage/auth-storage";

interface AuthUser {
  id: string;
  name: string;
  email: string;
}

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

export const useAuthStore = create<AuthState>((set) => {
  const signOut = async () => {
    authDebug("LOGOUT_START");

    try {
      const refreshToken = await getRefreshToken();

      if (refreshToken) {
        authDebug("SERVER_LOGOUT_REQUEST", {
          hasRefreshToken: true,
        });

        try {
          // Avoids creating an unnecessary top-level circular dependency while we're still finishing the auth refactor.
          const { apiPostPublic } = await import("@/api/client");

          await apiPostPublic("/api/auth/logout", {
            refreshToken,
          });

          authDebug("SERVER_LOGOUT_SUCCESS");
        } catch (error) {
          /**
           * Learning:
           * Logout is intentionally best-effort on the server.
           *
           * Even if the network is unavailable,
           * local credentials must be removed.
           */
          authDebug("SERVER_LOGOUT_FAILED", {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    } finally {
      await clearSessionTokens();

      authDebug("LOCAL_TOKENS_CLEARED");

      set({
        user: null,
        isAuthenticated: false,
        isLoading: false,
      });

      authDebug("SESSION_SIGNED_OUT");
    }
  };

  /**
   * Learning:
   *
   * API client owns token refresh.
   * Auth store owns the application-level session state.
   *
   * When the API client determines that the session
   * is no longer recoverable, it calls this handler.
   */
  setUnauthorizedHandler(async () => {
    authDebug("UNAUTHORIZED_HANDLER_TRIGGERED");

    await signOut();
  });

  return {
    user: null,
    isAuthenticated: false,
    isLoading: true,

    initializeAuth: async () => {
      authDebug("INITIALIZE_START");

      try {
        set({
          isLoading: true,
        });

        const accessToken = await getAccessToken();

        const refreshToken = await getRefreshToken();

        authDebug("PERSISTED_SESSION_CHECK", {
          hasAccessToken: Boolean(accessToken),
          hasRefreshToken: Boolean(refreshToken),
        });

        if (!accessToken || !refreshToken) {
          authDebug("INCOMPLETE_SESSION_FOUND");

          await clearSessionTokens();

          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
          });

          authDebug("INITIALIZE_NO_SESSION");

          return;
        }

        try {
          /**
           * Learning:
           *
           * If the access token has expired,
           * apiGet() -> 401 -> refresh -> retry
           *
           * So initializeAuth does not need to manually
           * implement token refresh.
           */
          const response = await getCurrentUser();

          set({
            user: response.data,
            isAuthenticated: true,
            isLoading: false,
          });

          authDebug("SESSION_RESTORED", {
            userId: response.data.id,
          });
        } catch (error) {
          authDebug("SESSION_RESTORE_FAILED", {
            error: error instanceof Error ? error.message : String(error),
          });

          await clearSessionTokens();

          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
          });
        }
      } catch (error) {
        authDebug("INITIALIZE_FAILED", {
          error: error instanceof Error ? error.message : String(error),
        });

        await clearSessionTokens();

        set({
          user: null,
          isAuthenticated: false,
          isLoading: false,
        });
      }
    },

    setSession: async (authResponse: AuthResponse) => {
      const { user, accessToken, refreshToken } = authResponse.data;

      authDebug("SESSION_RECEIVED", {
        userId: user.id,
        accessToken,
        refreshToken,
      });

      await saveSessionTokens(accessToken, refreshToken);

      authDebug("SESSION_TOKENS_SAVED", {
        hasAccessToken: Boolean(accessToken),
        hasRefreshToken: Boolean(refreshToken),
      });

      set({
        user,
        isAuthenticated: true,
        isLoading: false,
      });

      authDebug("SESSION_ACTIVE", {
        userId: user.id,
      });
    },

    signOut,
  };
});
