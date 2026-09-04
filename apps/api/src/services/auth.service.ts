import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
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

  const passwordMatches = await bcrypt.compare(
    input.password,
    user.passwordHash,
  );

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
