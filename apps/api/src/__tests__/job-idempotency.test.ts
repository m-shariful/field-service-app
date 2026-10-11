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

describe("job idempotency", () => {
  it("returns the same result when a create mutation is retried", async () => {
    const { accessToken } = await createTestUser(
      "Idempotent Create User",
      "idempotent-create@example.com",
    );

    const payload = {
      id: "local-job-idempotency-001",
      title: "Generator repair",
      scheduledAt: "2026-10-10T10:00:00.000Z",
      location: "Rajshahi",
      priority: "high",
    };

    const firstResponse = await request(app)
      .post("/api/jobs")
      .set("Authorization", `Bearer ${accessToken}`)
      .set("Idempotency-Key", "mutation-create-001")
      .send(payload);

    expect(firstResponse.status).toBe(201);

    const secondResponse = await request(app)
      .post("/api/jobs")
      .set("Authorization", `Bearer ${accessToken}`)
      .set("Idempotency-Key", "mutation-create-001")
      .send(payload);

    expect(secondResponse.status).toBe(201);

    expect(secondResponse.body).toEqual(firstResponse.body);

    const jobs = await JobModel.find({
      id: "local-job-idempotency-001",
    });

    expect(jobs).toHaveLength(1);
  });

  it("rejects reuse of an idempotency key with different data", async () => {
    const { accessToken } = await createTestUser(
      "Idempotent Conflict User",
      "idempotent-conflict@example.com",
    );

    const firstResponse = await request(app)
      .post("/api/jobs")
      .set("Authorization", `Bearer ${accessToken}`)
      .set("Idempotency-Key", "mutation-create-002")
      .send({
        id: "local-job-idempotency-002",
        title: "Generator repair",
        scheduledAt: "2026-10-10T10:00:00.000Z",
        location: "Rajshahi",
        priority: "high",
      });

    expect(firstResponse.status).toBe(201);

    const secondResponse = await request(app)
      .post("/api/jobs")
      .set("Authorization", `Bearer ${accessToken}`)
      .set("Idempotency-Key", "mutation-create-002")
      .send({
        id: "local-job-idempotency-002",
        title: "Different payload",
        scheduledAt: "2026-10-10T10:00:00.000Z",
        location: "Rajshahi",
        priority: "high",
      });

    expect(secondResponse.status).toBe(409);

    expect(secondResponse.body.error.code).toBe("IDEMPOTENCY_KEY_REUSED");
  });

  it("makes repeated status updates idempotent", async () => {
    const { user, accessToken } = await createTestUser(
      "Idempotent Update User",
      "idempotent-update@example.com",
    );

    await JobModel.create({
      id: "job-idempotency-update",
      userId: user.id,
      title: "Status test",
      scheduledAt: "2026-10-10T10:00:00.000Z",
      location: "Rajshahi",
      status: "scheduled",
      priority: "medium",
    });

    const firstResponse = await request(app)
      .patch("/api/jobs/job-idempotency-update/status")
      .set("Authorization", `Bearer ${accessToken}`)
      .set("Idempotency-Key", "mutation-update-001")
      .send({
        status: "in_progress",
      });

    expect(firstResponse.status).toBe(200);

    const secondResponse = await request(app)
      .patch("/api/jobs/job-idempotency-update/status")
      .set("Authorization", `Bearer ${accessToken}`)
      .set("Idempotency-Key", "mutation-update-001")
      .send({
        status: "in_progress",
      });

    expect(secondResponse.status).toBe(200);

    expect(secondResponse.body).toEqual(firstResponse.body);
  });
});
