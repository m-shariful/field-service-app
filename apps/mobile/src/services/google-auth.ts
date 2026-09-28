import {
  GoogleSignin,
  statusCodes,
} from "@react-native-google-signin/google-signin";

// Learning: the Web client ID is used here because we need an ID token
// whose audience matches the backend's GOOGLE_CLIENT_ID.
// This is the same client ID that is used in the backend for verifying the ID token.
const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

if (!webClientId) {
  throw new Error("EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID is not configured");
}

GoogleSignin.configure({
  webClientId,
});

export async function signInWithGoogle() {
  try {
    await GoogleSignin.hasPlayServices({
      showPlayServicesUpdateDialog: true,
    });

    const response = await GoogleSignin.signIn();

    if (!response.data?.idToken) {
      throw new Error("GOOGLE_ID_TOKEN_MISSING");
    }

    return {
      idToken: response.data.idToken,
      user: response.data.user,
    };
  } catch (error) {
    const errorCode =
      typeof error === "object" && error !== null && "code" in error
        ? (error as { code?: string }).code
        : undefined;

    if (errorCode === statusCodes.SIGN_IN_CANCELLED) {
      throw new Error("GOOGLE_SIGN_IN_CANCELLED");
    }

    if (errorCode === statusCodes.IN_PROGRESS) {
      throw new Error("GOOGLE_SIGN_IN_IN_PROGRESS");
    }

    if (errorCode === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      throw new Error("GOOGLE_PLAY_SERVICES_UNAVAILABLE");
    }

    throw error;
  }
}
