import { createHash, randomBytes, randomUUID } from "crypto";

import { AuthIdentityModel } from "../models/auth-identity";
import type { AuthUser } from "../types/auth";
import { OAuth2Client } from "google-auth-library";
import { RefreshSessionModel } from "../models/refresh-session";
import { UserModel } from "../models/user";
import { authDebug } from "../utils/auth-debug";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET is not configured");
  }

  return secret;
}

function getJwtExpiresIn(): string {
  return process.env.JWT_EXPIRES_IN || "15m";
}

function getPositiveDays(
  environmentVariable: string,
  fallback: number,
): number {
  const value = process.env[environmentVariable];

  if (!value) {
    return fallback;
  }

  const days = Number(value);

  if (!Number.isFinite(days) || days <= 0) {
    throw new Error(`${environmentVariable} must be a positive number`);
  }

  return days;
}

function getRefreshIdleDays(): number {
  return getPositiveDays("REFRESH_TOKEN_IDLE_DAYS", 7);
}

function getRefreshAbsoluteDays(): number {
  return getPositiveDays("REFRESH_TOKEN_ABSOLUTE_DAYS", 30);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
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

function generateRefreshToken(): string {
  // Learning:
  // Refresh tokens are opaque random secrets, not JWTs.
  // 64 random bytes provides high entropy.
  return randomBytes(64).toString("base64url");
}

function hashRefreshToken(refreshToken: string): string {
  return createHash("sha256").update(refreshToken).digest("hex");
}

function calculateIdleExpiry(now: Date, absoluteExpiresAt: Date): Date {
  const configuredIdleExpiry = addDays(now, getRefreshIdleDays());

  // Learning:
  // Idle expiration can never extend beyond
  // the absolute session expiration.
  return configuredIdleExpiry < absoluteExpiresAt
    ? configuredIdleExpiry
    : absoluteExpiresAt;
}

/**
 * Creates one refresh session and returns
 * both the database identity and the opaque
 * refresh token.
 */
async function createRefreshSession(
  userId: string,
  familyId: string = randomUUID(),
  absoluteExpiresAt: Date = addDays(new Date(), getRefreshAbsoluteDays()),
) {
  const now = new Date();

  const refreshToken = generateRefreshToken();

  const sessionId = `refresh-${randomUUID()}`;

  const idleExpiresAt = calculateIdleExpiry(now, absoluteExpiresAt);

  await RefreshSessionModel.create({
    id: sessionId,
    userId,
    familyId,
    tokenHash: hashRefreshToken(refreshToken),
    expiresAt: absoluteExpiresAt,
    idleExpiresAt,
    lastUsedAt: now,
  });

  authDebug("REFRESH_SESSION_CREATED", {
    userId,
    sessionId,
    familyId,
    expiresAt: absoluteExpiresAt.toISOString(),
    idleExpiresAt: idleExpiresAt.toISOString(),
    lastUsedAt: now.toISOString(),
  });

  return {
    sessionId,
    familyId,
    refreshToken,
  };
}

/**
 * Creates a complete application session:
 *
 * access token
 * +
 * refresh session
 */
async function createSessionTokens(user: AuthUser) {
  authDebug("SESSION_CREATION_START", {
    userId: user.id,
  });

  const accessToken = createAccessToken(user);

  const refreshSession = await createRefreshSession(user.id);

  authDebug("SESSION_CREATED", {
    userId: user.id,
    sessionId: refreshSession.sessionId,
    familyId: refreshSession.familyId,
  });

  return {
    user,
    accessToken,
    refreshToken: refreshSession.refreshToken,
  };
}

async function revokeRefreshSession(
  sessionId: string,
  reason: "LOGOUT" | "IDLE_TIMEOUT" | "ABSOLUTE_TIMEOUT",
): Promise<void> {
  const result = await RefreshSessionModel.updateOne(
    {
      id: sessionId,
      revokedAt: null,
    },
    {
      $set: {
        revokedAt: new Date(),
        revokeReason: reason,
      },
    },
  );

  authDebug("REFRESH_SESSION_REVOKED", {
    sessionId,
    reason,
    modifiedCount: result.modifiedCount,
  });
}

async function revokeRefreshTokenFamily(
  userId: string,
  familyId: string,
  reason: "REUSE_DETECTED" | "USER_REMOVED",
): Promise<void> {
  const result = await RefreshSessionModel.updateMany(
    {
      userId,
      familyId,
      revokedAt: null,
    },
    {
      $set: {
        revokedAt: new Date(),
        revokeReason: reason,
      },
    },
  );

  authDebug("REFRESH_SESSION_FAMILY_REVOKED", {
    userId,
    familyId,
    reason,
    modifiedCount: result.modifiedCount,
  });
}

/**
 * Register with email/password.
 */
export async function registerUser(input: {
  name: string;
  email: string;
  password: string;
}) {
  authDebug("REGISTER_ATTEMPT");

  const existingUser = await UserModel.findOne({
    email: input.email,
  });

  if (existingUser) {
    authDebug("REGISTER_FAILED", {
      reason: "EMAIL_ALREADY_EXISTS",
    });

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

  authDebug("REGISTER_SUCCESS", {
    userId: authUser.id,
  });

  return createSessionTokens(authUser);
}

/**
 * Login with email/password.
 */
export async function loginUser(input: { email: string; password: string }) {
  authDebug("LOGIN_ATTEMPT");

  const user = await UserModel.findOne({
    email: input.email,
  });

  if (!user) {
    authDebug("LOGIN_FAILED", {
      reason: "INVALID_CREDENTIALS",
    });

    throw new Error("INVALID_CREDENTIALS");
  }

  const passwordMatches =
    !!user.passwordHash &&
    (await bcrypt.compare(input.password, user.passwordHash));

  if (!passwordMatches) {
    authDebug("LOGIN_FAILED", {
      reason: "INVALID_CREDENTIALS",
      userId: user.id,
    });

    throw new Error("INVALID_CREDENTIALS");
  }

  const authUser = toAuthUser(user);

  authDebug("LOGIN_SUCCESS", {
    userId: authUser.id,
  });

  return createSessionTokens(authUser);
}

/**
 * Creates a short-lived JWT access token.
 *
 * jti is unique per token so that two access tokens
 * created within the same second still differ.
 */
export function createAccessToken(user: AuthUser): string {
  const jti = randomUUID();
  const userId = user.id;
  const expiresIn = getJwtExpiresIn() as jwt.SignOptions["expiresIn"];

  authDebug("ACCESS_TOKEN_CREATED", {
    userId,
    jti,
    expiresIn,
  });

  return jwt.sign(
    {
      userId,
      jti,
    },
    getJwtSecret(),
    {
      expiresIn,
    },
  );
}

export async function getUserById(id: string): Promise<AuthUser | undefined> {
  const user = await UserModel.findOne({
    id,
  }).lean();

  if (!user) {
    return undefined;
  }

  return toAuthUser(user);
}

/**
 * Refresh token service.
 *
 * Flow:
 *
 * presented refresh token
 *       ↓
 * hash token
 *       ↓
 * find session
 *       ↓
 * validate revoked/expiry/user
 *       ↓
 * create replacement session
 *       ↓
 * atomically rotate old session
 *       ↓
 * create new access token
 */
export async function refreshSession(refreshToken: string) {
  authDebug("REFRESH_ATTEMPT");

  const tokenHash = hashRefreshToken(refreshToken);

  const session = await RefreshSessionModel.findOne({
    tokenHash,
  });

  if (!session) {
    authDebug("REFRESH_SESSION_NOT_FOUND");

    throw new Error("INVALID_REFRESH_TOKEN");
  }

  authDebug("REFRESH_SESSION_FOUND", {
    sessionId: session.id,
    userId: session.userId,
    familyId: session.familyId,
    revoked: Boolean(session.revokedAt),
    revokeReason: session.revokeReason ?? null,
    expiresAt: session.expiresAt.toISOString(),
    idleExpiresAt: session.idleExpiresAt.toISOString(),
  });

  /**
   * Reuse detection
   *
   * A refresh token that has already been
   * rotated must never be accepted again.
   */
  if (session.revokedAt) {
    authDebug("REFRESH_SESSION_ALREADY_REVOKED", {
      sessionId: session.id,
      userId: session.userId,
      familyId: session.familyId,
      reason: session.revokeReason ?? "UNKNOWN",
    });

    if (session.revokeReason === "ROTATED") {
      authDebug("REFRESH_TOKEN_REUSE_DETECTED", {
        userId: session.userId,
        familyId: session.familyId,
        sessionId: session.id,
      });

      await revokeRefreshTokenFamily(
        session.userId,
        session.familyId,
        "REUSE_DETECTED",
      );

      console.warn("Refresh token reuse detected:", {
        userId: session.userId,
        familyId: session.familyId,
        sessionId: session.id,
      });

      throw new Error("REFRESH_TOKEN_REUSED");
    }

    throw new Error("INVALID_REFRESH_TOKEN");
  }

  const now = new Date();

  /**
   * Absolute lifetime check
   */
  if (session.expiresAt.getTime() <= now.getTime()) {
    authDebug("REFRESH_SESSION_EXPIRED", {
      sessionId: session.id,
      userId: session.userId,
      familyId: session.familyId,
      reason: "ABSOLUTE_TIMEOUT",
      expiresAt: session.expiresAt.toISOString(),
      now: now.toISOString(),
    });

    await revokeRefreshSession(session.id, "ABSOLUTE_TIMEOUT");

    throw new Error("INVALID_REFRESH_TOKEN");
  }

  /**
   * Idle lifetime check
   */
  if (session.idleExpiresAt.getTime() <= now.getTime()) {
    authDebug("REFRESH_SESSION_EXPIRED", {
      sessionId: session.id,
      userId: session.userId,
      familyId: session.familyId,
      reason: "IDLE_TIMEOUT",
      idleExpiresAt: session.idleExpiresAt.toISOString(),
      now: now.toISOString(),
    });

    await revokeRefreshSession(session.id, "IDLE_TIMEOUT");

    throw new Error("INVALID_REFRESH_TOKEN");
  }

  /**
   * Make sure the user still exists.
   */
  const user = await getUserById(session.userId);

  if (!user) {
    authDebug("REFRESH_USER_NOT_FOUND", {
      userId: session.userId,
      familyId: session.familyId,
      sessionId: session.id,
    });

    await revokeRefreshTokenFamily(
      session.userId,
      session.familyId,
      "USER_REMOVED",
    );

    throw new Error("INVALID_REFRESH_TOKEN");
  }

  /**
   * Create replacement session.
   *
   * We keep the same familyId and absolute
   * expiry boundary.
   */
  const replacement = await createRefreshSession(
    session.userId,
    session.familyId,
    session.expiresAt,
  );

  authDebug("REFRESH_REPLACEMENT_CREATED", {
    oldSessionId: session.id,
    newSessionId: replacement.sessionId,
    familyId: replacement.familyId,
  });

  /**
   * Atomic compare-and-set.
   *
   * Only one concurrent request can successfully
   * rotate the current session.
   */
  const rotated = await RefreshSessionModel.findOneAndUpdate(
    {
      _id: session._id,
      revokedAt: null,
    },
    {
      $set: {
        revokedAt: now,
        revokeReason: "ROTATED",
        replacedBySessionId: replacement.sessionId,
        lastUsedAt: now,
      },
    },
    {
      new: true,
    },
  );

  if (!rotated) {
    /**
     * Another request won the race.
     *
     * The original refresh token has therefore
     * been concurrently reused.
     *
     * Revoke the entire family.
     */
    authDebug("CONCURRENT_REFRESH_DETECTED", {
      userId: session.userId,
      familyId: session.familyId,
      sessionId: session.id,
      replacementSessionId: replacement.sessionId,
    });

    await revokeRefreshTokenFamily(
      session.userId,
      session.familyId,
      "REUSE_DETECTED",
    );

    console.warn("Concurrent refresh/reuse detected:", {
      userId: session.userId,
      familyId: session.familyId,
      sessionId: session.id,
    });

    throw new Error("REFRESH_TOKEN_REUSED");
  }

  authDebug("REFRESH_SESSION_ROTATED", {
    oldSessionId: session.id,
    newSessionId: replacement.sessionId,
    familyId: session.familyId,
  });

  const accessToken = createAccessToken(user);

  authDebug("REFRESH_SUCCESS", {
    userId: session.userId,
    familyId: session.familyId,
    oldSessionId: session.id,
    newSessionId: replacement.sessionId,
  });

  return {
    user,
    accessToken,
    refreshToken: replacement.refreshToken,
  };
}

/**
 * Logout
 *
 * Logout is intentionally idempotent.
 */
export async function logoutUser(refreshToken: string): Promise<void> {
  const tokenHash = hashRefreshToken(refreshToken);

  const session = await RefreshSessionModel.findOne({
    tokenHash,
  });

  if (!session) {
    authDebug("LOGOUT_SESSION_NOT_FOUND");

    return;
  }

  if (session.revokedAt) {
    authDebug("LOGOUT_SESSION_ALREADY_REVOKED", {
      sessionId: session.id,
      userId: session.userId,
      familyId: session.familyId,
      reason: session.revokeReason ?? "UNKNOWN",
    });

    return;
  }

  authDebug("LOGOUT_ATTEMPT", {
    sessionId: session.id,
    userId: session.userId,
    familyId: session.familyId,
  });

  await revokeRefreshSession(session.id, "LOGOUT");

  authDebug("LOGOUT_SUCCESS", {
    sessionId: session.id,
    userId: session.userId,
    familyId: session.familyId,
  });
}

/**
 * Google OAuth
 */
const googleClient = new OAuth2Client();

function getGoogleClientId(): string {
  const clientId = process.env.GOOGLE_CLIENT_ID;

  if (!clientId) {
    throw new Error("GOOGLE_CLIENT_ID is not configured");
  }

  return clientId;
}

export async function loginWithGoogle(idToken: string) {
  authDebug("GOOGLE_LOGIN_ATTEMPT");

  let ticket;

  try {
    ticket = await googleClient.verifyIdToken({
      idToken,
      audience: getGoogleClientId(),
    });
  } catch (error) {
    console.error("Google ID token verification failed:", error);

    authDebug("GOOGLE_LOGIN_FAILED", {
      reason: "INVALID_GOOGLE_TOKEN",
    });

    throw new Error("INVALID_GOOGLE_TOKEN");
  }

  const payload = ticket.getPayload();

  if (!payload?.sub) {
    authDebug("GOOGLE_LOGIN_FAILED", {
      reason: "INVALID_GOOGLE_TOKEN",
    });

    throw new Error("INVALID_GOOGLE_TOKEN");
  }

  if (payload.iss !== "https://accounts.google.com") {
    authDebug("GOOGLE_LOGIN_FAILED", {
      reason: "INVALID_GOOGLE_TOKEN",
    });

    throw new Error("INVALID_GOOGLE_TOKEN");
  }

  if (!payload.email) {
    authDebug("GOOGLE_LOGIN_FAILED", {
      reason: "GOOGLE_EMAIL_MISSING",
    });

    throw new Error("GOOGLE_EMAIL_MISSING");
  }

  if (!payload.email_verified) {
    authDebug("GOOGLE_LOGIN_FAILED", {
      reason: "GOOGLE_EMAIL_NOT_VERIFIED",
    });

    throw new Error("GOOGLE_EMAIL_NOT_VERIFIED");
  }

  const providerUserId = payload.sub;

  const existingIdentity = await AuthIdentityModel.findOne({
    provider: "google",
    providerUserId,
  });

  if (existingIdentity) {
    const existingUser = await getUserById(existingIdentity.userId);

    if (!existingUser) {
      authDebug("GOOGLE_LOGIN_FAILED", {
        reason: "AUTH_IDENTITY_ORPHANED",
        userId: existingIdentity.userId,
      });

      throw new Error("AUTH_IDENTITY_ORPHANED");
    }

    authDebug("GOOGLE_IDENTITY_FOUND", {
      userId: existingUser.id,
    });

    return createSessionTokens(existingUser);
  }

  const normalizedEmail = payload.email.toLowerCase();

  const existingUser = await UserModel.findOne({
    email: normalizedEmail,
  });

  if (existingUser) {
    authDebug("GOOGLE_ACCOUNT_LINK_REQUIRED", {
      userId: existingUser.id,
    });

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

  authDebug("GOOGLE_USER_CREATED", {
    userId: authUser.id,
  });

  return createSessionTokens(authUser);
}
