import { describe, expect, it } from "vitest";

import request from "supertest";
import app from "../app";
import { UserModel } from "../models/user";

describe("POST /api/auth/register", () => {
  it("registers a new user", async () => {
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

    expect(response.body.data.token).toEqual(expect.any(String));

    const user = await UserModel.findOne({
      email: "john@example.com",
    }).lean();

    expect(user).not.toBeNull();
    expect(user?.passwordHash).not.toBe("password123");
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

    expect(response.body.data.token).toEqual(expect.any(String));
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

    const token = loginResponse.body.data.token;

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
