import { describe, expect, it } from "vitest";

import { JobModel } from "../models/job";
import app from "../app";
import request from "supertest";

async function createTestUser(name: string, email: string) {
  const response = await request(app).post("/api/auth/register").send({
    name,
    email,
    password: "password123",
  });

  expect(response.status).toBe(201);

  return {
    user: response.body.data.user,

    accessToken: response.body.data.accessToken,
  };
}

describe("GET /api/jobs/sync", () => {
  it("returns the first page", async () => {
    const { user, accessToken } = await createTestUser(
      "Sync User",
      "sync@example.com",
    );

    await JobModel.create({
      id: "job-sync-001",
      userId: user.id,
      title: "First job",
      scheduledAt: "2026-10-10T10:00:00.000Z",
      location: "Rajshahi",
      status: "scheduled",
      priority: "high",
    });

    const response = await request(app)
      .get("/api/jobs/sync")
      .query({
        limit: 50,
      })
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);

    expect(response.body.data.items).toHaveLength(1);

    expect(response.body.data.nextCursor).toEqual(expect.any(String));

    expect(response.body.data.hasMore).toBe(false);
  });

  it("returns only changes after the cursor", async () => {
    const { user, accessToken } = await createTestUser(
      "Cursor User",
      "cursor@example.com",
    );

    const first = await JobModel.create({
      id: "job-cursor-001",
      userId: user.id,
      title: "First",
      scheduledAt: "2026-10-10T10:00:00.000Z",
      location: "Rajshahi",
      status: "scheduled",
      priority: "medium",
    });

    const firstResponse = await request(app)
      .get("/api/jobs/sync")
      .set("Authorization", `Bearer ${accessToken}`);

    const cursor = firstResponse.body.data.nextCursor;

    expect(cursor).toEqual(expect.any(String));

    await JobModel.create({
      id: "job-cursor-002",
      userId: user.id,
      title: "Second",
      scheduledAt: "2026-10-11T10:00:00.000Z",
      location: "Dhaka",
      status: "scheduled",
      priority: "high",
    });

    const secondResponse = await request(app)
      .get("/api/jobs/sync")
      .query({
        cursor,
      })
      .set("Authorization", `Bearer ${accessToken}`);

    expect(secondResponse.status).toBe(200);

    expect(
      secondResponse.body.data.items.map((job: { id: string }) => job.id),
    ).toContain("job-cursor-002");

    expect(
      secondResponse.body.data.items.map((job: { id: string }) => job.id),
    ).not.toContain(first.id);
  });

  it("does not return another user's jobs", async () => {
    const first = await createTestUser("User One", "one@example.com");

    const second = await createTestUser("User Two", "two@example.com");

    await JobModel.create({
      id: "job-private-001",
      userId: second.user.id,
      title: "Private",
      scheduledAt: "2026-10-10T10:00:00.000Z",
      location: "Rajshahi",
      status: "scheduled",
      priority: "high",
    });

    const response = await request(app)
      .get("/api/jobs/sync")
      .set("Authorization", `Bearer ${first.accessToken}`);

    expect(response.status).toBe(200);

    expect(response.body.data.items).toHaveLength(0);
  });

  it("rejects an invalid cursor", async () => {
    const { accessToken } = await createTestUser(
      "Invalid Cursor",
      "invalid-cursor@example.com",
    );

    const response = await request(app)
      .get("/api/jobs/sync")
      .query({
        cursor: "not-a-real-cursor",
      })
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(400);

    expect(response.body.error.code).toBe("INVALID_SYNC_CURSOR");
  });
});
