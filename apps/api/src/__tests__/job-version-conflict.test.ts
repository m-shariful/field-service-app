import { describe, expect, it } from "vitest";

import request from "supertest";
import app from "../app";
import { JobModel } from "../models/job";

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

describe("job optimistic concurrency", () => {
  it("increments version after a successful update", async () => {
    const { user, accessToken } = await createTestUser(
      "Version User",
      "version@example.com",
    );

    await JobModel.create({
      id: "job-version-001",
      userId: user.id,
      title: "AC repair",
      scheduledAt: "2026-10-10T10:00:00.000Z",
      location: "Rajshahi",
      status: "scheduled",
      priority: "high",
    });

    const response = await request(app)
      .patch("/api/jobs/job-version-001/status")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        status: "in_progress",
        baseVersion: 1,
      });

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe("in_progress");
    expect(response.body.data.version).toBe(2);
  });

  it("rejects a stale version without overwriting the current job", async () => {
    const { user, accessToken } = await createTestUser(
      "Conflict User",
      "conflict@example.com",
    );

    await JobModel.create({
      id: "job-version-002",
      userId: user.id,
      title: "Generator repair",
      scheduledAt: "2026-10-10T11:00:00.000Z",
      location: "Rajshahi",
      status: "scheduled",
      priority: "medium",
    });

    const firstUpdate = await request(app)
      .patch("/api/jobs/job-version-002/status")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        status: "in_progress",
        baseVersion: 1,
      });

    expect(firstUpdate.status).toBe(200);
    expect(firstUpdate.body.data.version).toBe(2);

    // Simulates another device still editing version 1.
    const staleUpdate = await request(app)
      .patch("/api/jobs/job-version-002/status")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        status: "completed",
        baseVersion: 1,
      });

    expect(staleUpdate.status).toBe(409);

    expect(staleUpdate.body.error.code).toBe("JOB_VERSION_CONFLICT");

    expect(staleUpdate.body.error.details.expectedVersion).toBe("1");

    expect(staleUpdate.body.error.details.currentVersion).toBe("2");

    const latestJob = await JobModel.findOne({
      id: "job-version-002",
      userId: user.id,
    }).lean();

    expect(latestJob?.status).toBe("in_progress");
    expect(latestJob?.version).toBe(2);
  });

  it("allows only one concurrent update from the same baseVersion", async () => {
    const { user, accessToken } = await createTestUser(
      "Concurrent Version User",
      "concurrent-version@example.com",
    );

    await JobModel.create({
      id: "job-version-concurrent-001",
      userId: user.id,
      title: "Concurrent status update",
      scheduledAt: "2026-10-10T12:00:00.000Z",
      location: "Rajshahi",
      status: "scheduled",
      priority: "medium",
    });

    const sendUpdate = () =>
      request(app)
        .patch("/api/jobs/job-version-concurrent-001/status")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          status: "in_progress",
          baseVersion: 1,
        });

    const responses = await Promise.all([sendUpdate(), sendUpdate()]);

    expect(
      responses.map((response) => response.status).sort((a, b) => a - b),
    ).toEqual([200, 409]);

    const savedJob = await JobModel.findOne({
      id: "job-version-concurrent-001",
      userId: user.id,
    }).lean();

    expect(savedJob?.status).toBe("in_progress");
    expect(savedJob?.version).toBe(2);
  });
});
