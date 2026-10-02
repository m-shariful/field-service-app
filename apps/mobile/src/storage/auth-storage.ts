import * as SecureStore from "expo-secure-store";

import { Platform } from "react-native";

// Learning: access and refresh tokens are both credentials,
// so both live in the device's secure storage.
const ACCESS_TOKEN_KEY = "field_service_access_token";

const REFRESH_TOKEN_KEY = "field_service_refresh_token";

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
