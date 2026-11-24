import * as SecureStore from "expo-secure-store";

import { Platform } from "react-native";

// Learning: access and refresh tokens are both credentials,
// so both live in the device's secure storage.
const ACCESS_TOKEN_KEY = "field_service_access_token";
const REFRESH_TOKEN_KEY = "field_service_refresh_token";

const OFFLINE_SESSION_KEY = "field_service_offline_session";

/**
 * Maximum amount of time the application may trust
 * a previously server-validated session while completely offline.
 *
 * This is a product/security policy.
 * It does NOT replace server-side authentication.
 */
export const OFFLINE_SESSION_GRACE_MS = 24 * 60 * 60 * 1000;

export interface StoredAuthUser {
  id: string;
  name: string;
  email: string;
}

export interface OfflineSession {
  user: StoredAuthUser;
  lastServerValidatedAt: string;
  offlineAllowedUntil: string;
}

/**
 * Web:
 *   localStorage
 *
 * Android/iOS:
 *   expo-secure-store
 *
 * Learning:
 * expo-secure-store does not provide a secure storage implementation for web.
 * Therefore we keep the storage interface identical while changing the
 * underlying implementation by platform.
 */

function isWeb(): boolean {
  return Platform.OS === "web";
}

async function setStorageItem(key: string, value: string): Promise<void> {
  if (isWeb()) {
    // Learning:
    // localStorage is persistent across browser refreshes.
    // It is NOT equivalent to SecureStore from a security perspective.
    if (typeof localStorage === "undefined") {
      throw new Error("WEB_STORAGE_UNAVAILABLE");
    }

    localStorage.setItem(key, value);
    return;
  }

  await SecureStore.setItemAsync(key, value);
}

async function getStorageItem(key: string): Promise<string | null> {
  if (isWeb()) {
    // Learning:
    // During SSR/static rendering localStorage may not exist.
    if (typeof localStorage === "undefined") {
      return null;
    }

    return localStorage.getItem(key);
  }

  return SecureStore.getItemAsync(key);
}

async function removeStorageItem(key: string): Promise<void> {
  if (isWeb()) {
    if (typeof localStorage === "undefined") {
      return;
    }

    localStorage.removeItem(key);
    return;
  }

  await SecureStore.deleteItemAsync(key);
}

export async function saveSessionTokens(
  accessToken: string,
  refreshToken: string,
): Promise<void> {
  // await Promise.all([
  //   SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken),
  //   SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken),
  // ]);

  await Promise.all([
    setStorageItem(ACCESS_TOKEN_KEY, accessToken),
    setStorageItem(REFRESH_TOKEN_KEY, refreshToken),
  ]);
}

export async function getAccessToken(): Promise<string | null> {
  // return SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
  return getStorageItem(ACCESS_TOKEN_KEY);
}

export async function getRefreshToken(): Promise<string | null> {
  // return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  return getStorageItem(REFRESH_TOKEN_KEY);
}

export async function clearSessionTokens(): Promise<void> {
  // await Promise.all([
  //   SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
  //   SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
  // ]);

  await Promise.all([
    removeStorageItem(ACCESS_TOKEN_KEY),
    removeStorageItem(REFRESH_TOKEN_KEY),
  ]);
}

/**
 * Save locally trusted session information after
 * successful server authentication/validation.
 */
export async function saveOfflineSession(
  user: StoredAuthUser,
  validatedAt: Date = new Date(),
): Promise<void> {
  const offlineAllowedUntil = new Date(
    validatedAt.getTime() + OFFLINE_SESSION_GRACE_MS,
  );

  const session: OfflineSession = {
    user,
    lastServerValidatedAt: validatedAt.toISOString(),
    offlineAllowedUntil: offlineAllowedUntil.toISOString(),
  };

  await setStorageItem(OFFLINE_SESSION_KEY, JSON.stringify(session));
}

/**
 * Read the previously trusted offline session.
 */
export async function getOfflineSession(): Promise<OfflineSession | null> {
  const rawValue = await getStorageItem(OFFLINE_SESSION_KEY);

  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<OfflineSession>;

    if (
      !parsed.user ||
      typeof parsed.user.id !== "string" ||
      typeof parsed.user.name !== "string" ||
      typeof parsed.user.email !== "string" ||
      typeof parsed.lastServerValidatedAt !== "string" ||
      typeof parsed.offlineAllowedUntil !== "string"
    ) {
      return null;
    }

    return parsed as OfflineSession;
  } catch {
    return null;
  }
}

/**
 * Determine whether the locally trusted session is still
 * inside the offline grace window.
 */
export function canUseOfflineSession(
  session: OfflineSession,
  now: Date = new Date(),
): boolean {
  const lastValidatedAt = Date.parse(session.lastServerValidatedAt);
  const offlineAllowedUntil = Date.parse(session.offlineAllowedUntil);
  const currentTime = now.getTime();

  if (
    !Number.isFinite(lastValidatedAt) ||
    !Number.isFinite(offlineAllowedUntil)
  ) {
    return false;
  }

  if (offlineAllowedUntil <= lastValidatedAt) {
    return false;
  }

  return currentTime < offlineAllowedUntil;
}

/**
 * Remove the local offline trust record.
 *
 * This must happen when the session is explicitly invalidated,
 * such as logout or confirmed server-side authentication failure.
 */
export async function clearOfflineSession(): Promise<void> {
  await removeStorageItem(OFFLINE_SESSION_KEY);
}
