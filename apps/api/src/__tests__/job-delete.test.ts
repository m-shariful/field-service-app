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

describe("DELETE /api/jobs/:id", () => {
  it("soft-deletes a job and returns a tombstone in incremental sync", async () => {
    const { user, accessToken } = await createTestUser(
      "Delete Test User",
      "delete-test@example.com",
    );

    await JobModel.create({
      id: "job-delete-001",
      userId: user.id,
      title: "Cancelled generator repair",
      scheduledAt: "2026-10-30T10:00:00.000Z",
      location: "Rajshahi",
      status: "scheduled",
      priority: "high",
    });

    const response = await request(app)
      .delete("/api/jobs/job-delete-001")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ baseVersion: 1 });

    expect(response.status).toBe(200);
    expect(response.body.data.version).toBe(2);
    expect(response.body.data.deletedAt).toEqual(expect.any(String));

    const storedJob = await JobModel.findOne({
      id: "job-delete-001",
      userId: user.id,
    }).lean();

    expect(storedJob).not.toBeNull();
    expect(storedJob?.deletedAt).toBeTruthy();

    const listResponse = await request(app)
      .get("/api/jobs")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(listResponse.status).toBe(200);
    expect(
      listResponse.body.data.map((job: { id: string }) => job.id),
    ).not.toContain("job-delete-001");

    const syncResponse = await request(app)
      .get("/api/jobs/sync")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(syncResponse.status).toBe(200);

    expect(syncResponse.body.data.items).toContainEqual(
      expect.objectContaining({
        id: "job-delete-001",
        version: 2,
        deletedAt: expect.any(String),
      }),
    );
  });

  it("rejects a delete based on a stale server version", async () => {
    const { user, accessToken } = await createTestUser(
      "Stale Delete User",
      "stale-delete@example.com",
    );

    await JobModel.create({
      id: "job-delete-stale-001",
      userId: user.id,
      title: "Generator repair",
      scheduledAt: "2026-10-30T11:00:00.000Z",
      location: "Rajshahi",
      status: "scheduled",
      priority: "high",
    });

    const updateResponse = await request(app)
      .patch("/api/jobs/job-delete-stale-001/status")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        status: "in_progress",
        baseVersion: 1,
      });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.data.version).toBe(2);

    const deleteResponse = await request(app)
      .delete("/api/jobs/job-delete-stale-001")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ baseVersion: 1 });

    expect(deleteResponse.status).toBe(409);
    expect(deleteResponse.body.error.code).toBe("JOB_VERSION_CONFLICT");

    const storedJob = await JobModel.findOne({
      id: "job-delete-stale-001",
      userId: user.id,
    }).lean();

    expect(storedJob?.deletedAt).toBeFalsy();
    expect(storedJob?.version).toBe(2);
    expect(storedJob?.status).toBe("in_progress");
  });

  it("rejects a delete request without a valid base version", async () => {
    const { accessToken } = await createTestUser(
      "Invalid Delete User",
      "invalid-delete@example.com",
    );

    const response = await request(app)
      .delete("/api/jobs/job-missing-version")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({});

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(response.body.error.details.baseVersion).toBe(
      "baseVersion must be a positive integer",
    );
  });
});
