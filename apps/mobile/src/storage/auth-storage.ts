import * as SecureStore from "expo-secure-store";

// expo-secure-store is a library that provides a secure way to store key-value pairs on the device. It uses the device's secure storage mechanisms, such as Keychain on iOS and Keystore on Android, to store sensitive information like access tokens, passwords, and other secrets. This ensures that the data is encrypted and protected from unauthorized access.
// For persistent storage of JWT token
const ACCESS_TOKEN_KEY = "field_service_access_token";

export async function saveAccessToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, token);
}

export async function getAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
}

export async function clearAccessToken(): Promise<void> {
  await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
}
