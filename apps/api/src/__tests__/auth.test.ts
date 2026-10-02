import { describe, expect, it } from "vitest";

import request from "supertest";
import app from "../app";
import { RefreshSessionModel } from "../models/refresh-session";
import { UserModel } from "../models/user";

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

process.env.JWT_EXPIRES_IN = "15m";
process.env.REFRESH_TOKEN_IDLE_DAYS = "7";
process.env.REFRESH_TOKEN_ABSOLUTE_DAYS = "30";
process.env.GOOGLE_CLIENT_ID =
  process.env.GOOGLE_CLIENT_ID || "test-google-client-id";

describe("POST /api/auth/register", () => {
  it("registers a new user and creates a session", async () => {
    const response = await request(app).post("/api/auth/register").send({
      name: "John Technician",
      email: "john@example.com",
      password: "password123",
    });

    expect(response.status).toBe(201);

    expect(response.body.data.user).toMatchObject({
      name: "John Technician",
      email: "john@example.com",
    });

    expect(response.body.data.accessToken).toEqual(expect.any(String));

    expect(response.body.data.refreshToken).toEqual(expect.any(String));

    const user = await UserModel.findOne({
      email: "john@example.com",
    }).lean();

    expect(user).not.toBeNull();

    expect(user?.passwordHash).not.toBe("password123");

    const session = await RefreshSessionModel.findOne({
      userId: response.body.data.user.id,
    });

    expect(session).not.toBeNull();
  });

  it("rejects duplicate email addresses", async () => {
    await UserModel.create({
      id: "user-existing",
      name: "Existing User",
      email: "john@example.com",
      passwordHash: "hashed-password",
    });

    const response = await request(app).post("/api/auth/register").send({
      name: "Another User",
      email: "john@example.com",
      password: "password123",
    });

    expect(response.status).toBe(409);

    expect(response.body).toEqual({
      error: {
        code: "EMAIL_ALREADY_EXISTS",
        message: "An account with this email already exists",
      },
    });
  });
});

describe("POST /api/auth/login", () => {
  it("logs in with valid credentials", async () => {
    const registerResponse = await request(app)
      .post("/api/auth/register")
      .send({
        name: "Login User",
        email: "login@example.com",
        password: "password123",
      });

    expect(registerResponse.status).toBe(201);

    const response = await request(app).post("/api/auth/login").send({
      email: "login@example.com",
      password: "password123",
    });

    expect(response.status).toBe(200);

    expect(response.body.data.user).toMatchObject({
      name: "Login User",
      email: "login@example.com",
    });

    expect(response.body.data.accessToken).toEqual(expect.any(String));

    expect(response.body.data.refreshToken).toEqual(expect.any(String));
  });

  it("rejects invalid credentials", async () => {
    await request(app).post("/api/auth/register").send({
      name: "Login User",
      email: "invalid@example.com",
      password: "password123",
    });

    const response = await request(app).post("/api/auth/login").send({
      email: "invalid@example.com",
      password: "wrong-password",
    });

    expect(response.status).toBe(401);

    expect(response.body).toEqual({
      error: {
        code: "INVALID_CREDENTIALS",
        message: "Invalid email or password",
      },
    });
  });
});

describe("GET /api/auth/me", () => {
  it("returns the authenticated user", async () => {
    const loginResponse = await request(app).post("/api/auth/register").send({
      name: "Authenticated User",
      email: "auth@example.com",
      password: "password123",
    });

    const token = loginResponse.body.data.accessToken;

    const response = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);

    expect(response.body).toEqual({
      data: {
        id: expect.any(String),
        name: "Authenticated User",
        email: "auth@example.com",
      },
    });
  });

  it("rejects requests without authentication", async () => {
    const response = await request(app).get("/api/auth/me");

    expect(response.status).toBe(401);

    expect(response.body).toEqual({
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication required",
      },
    });
  });

  it("rejects an invalid token", async () => {
    const response = await request(app)
      .get("/api/auth/me")
      .set("Authorization", "Bearer invalid-token");

    expect(response.status).toBe(401);

    expect(response.body).toEqual({
      error: {
        code: "UNAUTHORIZED",
        message: "Invalid or expired authentication token",
      },
    });
  });
});

describe("POST /api/auth/refresh", () => {
  it("rotates a refresh token", async () => {
    const registerResponse = await request(app)
      .post("/api/auth/register")
      .send({
        name: "Refresh User",
        email: "refresh@example.com",
        password: "password123",
      });

    const firstAccessToken = registerResponse.body.data.accessToken;

    const firstRefreshToken = registerResponse.body.data.refreshToken;

    const response = await request(app).post("/api/auth/refresh").send({
      refreshToken: firstRefreshToken,
    });

    expect(response.status).toBe(200);

    expect(response.body.data.accessToken).toEqual(expect.any(String));

    expect(response.body.data.refreshToken).toEqual(expect.any(String));

    expect(response.body.data.accessToken).not.toBe(firstAccessToken);

    expect(response.body.data.refreshToken).not.toBe(firstRefreshToken);

    const meResponse = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${response.body.data.accessToken}`);

    expect(meResponse.status).toBe(200);
  });

  it("rejects an invalid refresh token", async () => {
    const response = await request(app).post("/api/auth/refresh").send({
      refreshToken: "invalid-refresh-token",
    });

    expect(response.status).toBe(401);

    expect(response.body.error.code).toBe("INVALID_REFRESH_TOKEN");
  });

  it("detects refresh token reuse and revokes the family", async () => {
    const registerResponse = await request(app)
      .post("/api/auth/register")
      .send({
        name: "Reuse Test User",
        email: "reuse@example.com",
        password: "password123",
      });

    const userId = registerResponse.body.data.user.id;

    const firstRefreshToken = registerResponse.body.data.refreshToken;

    const firstRefresh = await request(app).post("/api/auth/refresh").send({
      refreshToken: firstRefreshToken,
    });

    expect(firstRefresh.status).toBe(200);

    const secondRefreshToken = firstRefresh.body.data.refreshToken;

    // Old token has already been rotated.
    const reuseResponse = await request(app).post("/api/auth/refresh").send({
      refreshToken: firstRefreshToken,
    });

    expect(reuseResponse.status).toBe(401);

    expect(reuseResponse.body.error.code).toBe("INVALID_REFRESH_TOKEN");

    // Active replacement token must also be invalid
    // after family-wide revocation.
    const replacementResponse = await request(app)
      .post("/api/auth/refresh")
      .send({
        refreshToken: secondRefreshToken,
      });

    expect(replacementResponse.status).toBe(401);

    const sessions = await RefreshSessionModel.find({
      userId,
    });

    expect(sessions.length).toBe(2);

    expect(sessions.every((session) => !!session.revokedAt)).toBe(true);
  });

  it("rejects an idle-expired refresh session", async () => {
    const registerResponse = await request(app)
      .post("/api/auth/register")
      .send({
        name: "Idle Timeout User",
        email: "idle@example.com",
        password: "password123",
      });

    const userId = registerResponse.body.data.user.id;

    const refreshToken = registerResponse.body.data.refreshToken;

    await RefreshSessionModel.updateOne(
      { userId },
      {
        $set: {
          idleExpiresAt: new Date(Date.now() - 1000),
        },
      },
    );

    const response = await request(app).post("/api/auth/refresh").send({
      refreshToken,
    });

    expect(response.status).toBe(401);

    expect(response.body.error.code).toBe("INVALID_REFRESH_TOKEN");
  });

  it("rejects an absolute-expired refresh session", async () => {
    const registerResponse = await request(app)
      .post("/api/auth/register")
      .send({
        name: "Absolute Timeout User",
        email: "absolute@example.com",
        password: "password123",
      });

    const userId = registerResponse.body.data.user.id;

    const refreshToken = registerResponse.body.data.refreshToken;

    await RefreshSessionModel.updateOne(
      { userId },
      {
        $set: {
          expiresAt: new Date(Date.now() - 1000),
        },
      },
    );

    const response = await request(app).post("/api/auth/refresh").send({
      refreshToken,
    });

    expect(response.status).toBe(401);

    expect(response.body.error.code).toBe("INVALID_REFRESH_TOKEN");
  });
});

describe("POST /api/auth/logout", () => {
  it("revokes the current refresh session", async () => {
    const registerResponse = await request(app)
      .post("/api/auth/register")
      .send({
        name: "Logout User",
        email: "logout@example.com",
        password: "password123",
      });

    const refreshToken = registerResponse.body.data.refreshToken;

    const logoutResponse = await request(app).post("/api/auth/logout").send({
      refreshToken,
    });

    expect(logoutResponse.status).toBe(200);

    const refreshResponse = await request(app).post("/api/auth/refresh").send({
      refreshToken,
    });

    expect(refreshResponse.status).toBe(401);

    expect(refreshResponse.body.error.code).toBe("INVALID_REFRESH_TOKEN");
  });
});

describe("POST /api/auth/google", () => {
  it("rejects an invalid Google ID token", async () => {
    const response = await request(app).post("/api/auth/google").send({
      idToken: "invalid",
    });

    expect(response.status).toBe(401);

    expect(response.body.error.code).toBe("INVALID_GOOGLE_TOKEN");
  });
});
