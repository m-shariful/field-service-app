import bcrypt from "bcryptjs";
import { OAuth2Client } from "google-auth-library";
import jwt from "jsonwebtoken";
import { AuthIdentityModel } from "../models/auth-identity";
import { UserModel } from "../models/user";
import type { AuthUser } from "../types/auth";

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET is not configured");
  }

  return secret;
}

function getJwtExpiresIn(): string {
  return process.env.JWT_EXPIRES_IN || "1d";
}

function toAuthUser(user: {
  id: string;
  name: string;
  email: string;
}): AuthUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
  };
}

export async function registerUser(input: {
  name: string;
  email: string;
  password: string;
}) {
  const existingUser = await UserModel.findOne({
    email: input.email,
  });

  if (existingUser) {
    throw new Error("EMAIL_ALREADY_EXISTS");
  }

  const passwordHash = await bcrypt.hash(input.password, 12);

  const user = await UserModel.create({
    id: `user-${Date.now()}`,
    name: input.name,
    email: input.email,
    passwordHash,
  });

  const authUser = toAuthUser(user);

  return {
    user: authUser,
    token: createAccessToken(authUser),
  };
}

export async function loginUser(input: { email: string; password: string }) {
  const user = await UserModel.findOne({
    email: input.email,
  });

  if (!user) {
    throw new Error("INVALID_CREDENTIALS");
  }

  //   const passwordMatches = await bcrypt.compare(
  //     input.password,
  //     user.passwordHash,
  //   );

  // prevents a Google-only account from being treated as a password account
  const passwordMatches =
    !!user.passwordHash &&
    (await bcrypt.compare(input.password, user.passwordHash));

  if (!passwordMatches) {
    throw new Error("INVALID_CREDENTIALS");
  }

  const authUser = toAuthUser(user);

  return {
    user: authUser,
    token: createAccessToken(authUser),
  };
}

export function createAccessToken(user: AuthUser): string {
  return jwt.sign(
    {
      userId: user.id,
    },
    getJwtSecret(),
    {
      expiresIn: getJwtExpiresIn() as jwt.SignOptions["expiresIn"],
    },
  );
}

export async function getUserById(id: string): Promise<AuthUser | undefined> {
  const user = await UserModel.findOne({ id }).lean();

  if (!user) {
    return undefined;
  }

  return toAuthUser(user);
}

// Google Service
const googleClient = new OAuth2Client();

function getGoogleClientId(): string {
  const clientId = process.env.GOOGLE_CLIENT_ID;

  if (!clientId) {
    throw new Error("GOOGLE_CLIENT_ID is not configured");
  }

  return clientId;
}

// Learning: follows Google's recommendation to use sub as the stable Google-account identifier rather than email.
export async function loginWithGoogle(idToken: string) {
  let ticket;

  try {
    ticket = await googleClient.verifyIdToken({
      idToken,
      audience: getGoogleClientId(),
    });
  } catch (error) {
    // Learning: provider-specific verification errors should not leak
    // directly to the API client. Convert them into our own domain error.
    console.error("Google ID token verification failed:", error);

    throw new Error("INVALID_GOOGLE_TOKEN");
  }

  const payload = ticket.getPayload();

  if (!payload?.sub) {
    throw new Error("INVALID_GOOGLE_TOKEN");
  }

  if (payload.iss !== "https://accounts.google.com") {
    throw new Error("INVALID_GOOGLE_TOKEN");
  }

  if (!payload.email) {
    throw new Error("GOOGLE_EMAIL_MISSING");
  }

  if (!payload.email_verified) {
    throw new Error("GOOGLE_EMAIL_NOT_VERIFIED");
  }

  // Learning: Google's `sub` is the stable external identity.
  // Never use the Google email address as the provider identifier.
  const providerUserId = payload.sub;

  const existingIdentity = await AuthIdentityModel.findOne({
    provider: "google",
    providerUserId,
  });

  if (existingIdentity) {
    const existingUser = await getUserById(existingIdentity.userId);

    if (!existingUser) {
      throw new Error("AUTH_IDENTITY_ORPHANED");
    }

    return {
      user: existingUser,
      token: createAccessToken(existingUser),
    };
  }

  const normalizedEmail = payload.email.toLowerCase();

  // Learning: do not silently merge a Google identity into an existing
  // password account. Explicit account linking should be a separate flow.
  const existingUser = await UserModel.findOne({
    email: normalizedEmail,
  });

  if (existingUser) {
    throw new Error("ACCOUNT_LINK_REQUIRED");
  }

  const user = await UserModel.create({
    id: `user-${Date.now()}`,
    name: payload.name || normalizedEmail.split("@")[0],
    email: normalizedEmail,
  });

  await AuthIdentityModel.create({
    userId: user.id,
    provider: "google",
    providerUserId,
  });

  const authUser = toAuthUser(user);

  return {
    user: authUser,
    token: createAccessToken(authUser),
  };
}
