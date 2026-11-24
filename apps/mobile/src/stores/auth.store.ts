import { create } from "zustand";

import { setUnauthorizedHandler } from "@/api/client";

import { getCurrentUser, type AuthResponse } from "@/api/auth";

import { authDebug } from "@/debug/auth-debug";

import { ApiError } from "@/api/api-error";
import {
  canUseOfflineSession,
  clearOfflineSession,
  clearSessionTokens,
  getAccessToken,
  getOfflineSession,
  getRefreshToken,
  saveOfflineSession,
  saveSessionTokens,
} from "@/storage/auth-storage";

interface AuthUser {
  id: string;
  name: string;
  email: string;
}

// Learning: represents the app's current session mode.
export type SessionMode = "online" | "offline" | "signed_out";

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  sessionMode: SessionMode;

  // Learning: validates a persisted session with the backend.
  initializeAuth: () => Promise<void>;

  // Learning: stores the application's JWT and authenticated user
  // after any successful authentication method.
  setSession: (authResponse: AuthResponse) => Promise<void>;

  // Learning: removes both the local credential and in-memory session.
  signOut: () => Promise<void>;
}

async function clearLocalAuthState(): Promise<void> {
  await Promise.all([clearSessionTokens(), clearOfflineSession()]);
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
      // await clearSessionTokens();
      await clearLocalAuthState();

      authDebug("LOCAL_TOKENS_CLEARED");

      set({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        sessionMode: "signed_out",
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
    sessionMode: "signed_out",

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

          // await clearSessionTokens();
          await clearLocalAuthState();

          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            sessionMode: "signed_out",
          });

          authDebug("INITIALIZE_NO_SESSION");

          return;
        }

        try {
          /**
           * Normal online startup:
           *
           * GET /api/auth/me
           *
           * If the access token is expired:
           * apiGet() -> 401 -> refresh -> retry
           */
          const response = await getCurrentUser();

          /**
           * The server has just validated the session.
           *
           * This refreshes our local offline trust window.
           */
          await saveOfflineSession(response.data);

          set({
            user: response.data,
            isAuthenticated: true,
            isLoading: false,
            sessionMode: "online",
          });

          authDebug("SESSION_RESTORED", {
            userId: response.data.id,
          });

          return;
        } catch (error) {
          /**
           * A 401 is different from a network failure.
           *
           * 401 means the server explicitly rejected
           * the session after the API client's refresh logic.
           *
           * In this case we must NOT trust the local session.
           */
          if (error instanceof ApiError && error.status === 401) {
            authDebug("SESSION_RESTORE_REJECTED_BY_SERVER", {
              status: error.status,
              code: error.code,
            });

            await clearLocalAuthState();

            set({
              user: null,
              isAuthenticated: false,
              isLoading: false,
              sessionMode: "signed_out",
            });

            return;
          }

          /**
           * Network error / server unavailable:
           *
           * We cannot ask the server right now.
           *
           * Therefore we check whether the device still has
           * a valid locally trusted offline session.
           */
          authDebug("SESSION_SERVER_VALIDATION_UNAVAILABLE", {
            error: error instanceof Error ? error.message : String(error),
          });

          const offlineSession = await getOfflineSession();

          if (offlineSession && canUseOfflineSession(offlineSession)) {
            set({
              user: offlineSession.user,
              isAuthenticated: true,
              isLoading: false,
              sessionMode: "offline",
            });

            authDebug("SESSION_RESTORED_OFFLINE", {
              userId: offlineSession.user.id,
              offlineAllowedUntil: offlineSession.offlineAllowedUntil,
            });

            return;
          }

          /**
           * The server could not be reached and there is
           * no valid offline trust window.
           *
           * We do NOT clear tokens here.
           *
           * They may still become valid/recoverable when the
           * device gets connectivity again.
           */
          authDebug("OFFLINE_SESSION_UNAVAILABLE");

          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            sessionMode: "signed_out",
          });
        }
      } catch (error) {
        /**
         * Unexpected local/storage failure.
         *
         * We fail closed here because we cannot reliably
         * establish the local session state.
         */
        authDebug("INITIALIZE_FAILED", {
          error: error instanceof Error ? error.message : String(error),
        });

        await clearLocalAuthState();

        set({
          user: null,
          isAuthenticated: false,
          isLoading: false,
          sessionMode: "signed_out",
        });
      }
    },

    setSession: async (authResponse: AuthResponse) => {
      const { user, accessToken, refreshToken } = authResponse.data;

      authDebug("SESSION_RECEIVED", {
        userId: user.id,
      });

      await saveSessionTokens(accessToken, refreshToken);

      /**
       * Login/register/Google authentication all come
       * from a successful server response.
       *
       * Therefore we can establish offline trust now.
       */
      await saveOfflineSession(user);

      authDebug("SESSION_TOKENS_AND_OFFLINE_TRUST_SAVED", {
        userId: user.id,
      });

      set({
        user,
        isAuthenticated: true,
        isLoading: false,
        sessionMode: "online",
      });

      authDebug("SESSION_ACTIVE", {
        userId: user.id,
      });
    },

    signOut,
  };
});
