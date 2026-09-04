import { describe, expect, it } from "vitest";

import request from "supertest";
import app from "../app";
import { JobModel } from "../models/job";

// Manual Test
// describe("API test setup", () => {
//   it("runs successfully", () => {
//     expect(true).toBe(true);
//   });
// });

// Real end-point test for GET /api/jobs with supertest
// describe("GET /api/jobs", () => {
//   it("returns a successful response", async () => {
//     const response = await request(app).get("/api/jobs");

//     console.log("Response body:", response.body); // Log the response body for debugging

//     expect(response.status).toBe(200);
//     expect(response.body).toHaveProperty("data");
//     expect(Array.isArray(response.body.data)).toBe(true);
//   });
// });

/**
 * Notice that we're testing the API contract, not implementation details.
 * We're not asserting how's JobModel.find() is called.
 * We're asserting what a client actually cares about: the HTTP response.
 * And this is called integration testing, because we're testing the integration of multiple components
 * where multiple application layers participate (Express, controllers, services, database).
 * This is different from unit testing, where we would test each component in isolation.
 * Integration tests are slower than unit tests, but they give us more confidence that the system works as a whole.
 */

async function createTestUser(name: string, email: string) {
  const response = await request(app).post("/api/auth/register").send({
    name,
    email,
    password: "password123",
  });

  expect(response.status).toBe(201);

  return {
    user: response.body.data.user,
    token: response.body.data.token,
  };
}

describe("GET /api/jobs", () => {
  it("returns an empty job list when no jobs exist", async () => {
    const { token } = await createTestUser("Test User", "job@example.com");

    const response = await request(app)
      .get("/api/jobs")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: [],
    });
  });

  it("returns jobs from the database", async () => {
    const { user, token } = await createTestUser(
      "Test User",
      "job@example.com",
    );
    await JobModel.create({
      id: "job-test-001",
      userId: user.id,
      title: "Test AC Inspection",
      scheduledAt: "2026-09-10T10:00:00+06:00",
      location: "Rajshahi City",
      status: "scheduled",
      priority: "high",
    });

    const response = await request(app)
      .get("/api/jobs")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);

    expect(response.body.data[0]).toMatchObject({
      id: "job-test-001",
      title: "Test AC Inspection",
      location: "Rajshahi City",
      status: "scheduled",
      priority: "high",
    });
  });
});

// Test 1
// MongoDB → empty
//        ↓
// GET /jobs → []

// Test 2
// MongoDB → job-test-001
//        ↓
// GET /jobs → [job-test-001]

// Get job by ID
describe("GET /api/jobs/:id", () => {
  it("returns a job when the job exists", async () => {
    const { user, token } = await createTestUser(
      "Test User",
      "job@example.com",
    );

    await JobModel.create({
      id: "job-test-002",
      userId: user.id,
      title: "Test Job Details",
      scheduledAt: "2026-09-11T10:00:00+06:00",
      location: "Rajshahi City",
      status: "scheduled",
      priority: "medium",
    });

    const response = await request(app)
      .get("/api/jobs/job-test-002")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);

    expect(response.body).toMatchObject({
      data: {
        id: "job-test-002",
        title: "Test Job Details",
        location: "Rajshahi City",
        status: "scheduled",
        priority: "medium",
      },
    });
  });

  it("returns 404 when the job does not exist", async () => {
    const { token } = await createTestUser("Test User", "job@example.com");

    const response = await request(app)
      .get("/api/jobs/job-does-not-exist")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(404);

    expect(response.body).toEqual({
      error: {
        code: "JOB_NOT_FOUND",
        message: "Job not found",
      },
    });
  });
});

// Create job
describe("POST /api/jobs", () => {
  it("creates a job with valid input", async () => {
    const { token } = await createTestUser("Test User", "job@example.com");
    const response = await request(app)
      .post("/api/jobs")
      .send({
        title: "New AC Installation",
        scheduledAt: "2026-09-15T10:00:00+06:00",
        location: "Rajshahi City",
        priority: "high",
      })
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(201);

    expect(response.body.data).toMatchObject({
      title: "New AC Installation",
      scheduledAt: "2026-09-15T10:00:00+06:00",
      location: "Rajshahi City",
      status: "scheduled",
      priority: "high",
    });

    expect(response.body.data.id).toMatch(/^job-\d+$/);

    const createdJob = await JobModel.findOne({
      title: "New AC Installation",
    }).lean();

    expect(createdJob).not.toBeNull();
    expect(createdJob?.status).toBe("scheduled");
  });

  it("rejects invalid job input", async () => {
    const { token } = await createTestUser("Test User", "job@example.com");
    const response = await request(app)
      .post("/api/jobs")
      .send({
        title: "   ",
        scheduledAt: "not-a-date",
        location: "",
        priority: "critical",
      })
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(400);

    expect(response.body).toEqual({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid job data",
        details: {
          title: "Title is required",
          location: "Location is required",
          scheduledAt: "Scheduled date and time must be valid",
          priority: "Priority must be low, medium, high, or urgent",
        },
      },
    });
  });

  // Test suite with malformed request-body coverage. This protects the API boundary against clients sending empty, missing, or incorrectly typed payloads.
  it("rejects an empty request body", async () => {
    const { token } = await createTestUser("Test User", "job@example.com");
    const response = await request(app)
      .post("/api/jobs")
      .send({})
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(400);

    expect(response.body).toEqual({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid job data",
        details: {
          title: "Title is required",
          location: "Location is required",
          scheduledAt: "Scheduled date and time is required",
          priority: "Priority must be low, medium, high, or urgent",
        },
      },
    });
  });

  it("rejects a non-object request body", async () => {
    const { token } = await createTestUser("Test User", "job@example.com");
    const response = await request(app)
      .post("/api/jobs")
      .send([])
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(400);

    expect(response.body).toEqual({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid job data",
        details: {
          body: "Request body must be an object",
        },
      },
    });
  });
});

// Update job status
describe("PATCH /api/jobs/:id/status", () => {
  it("moves a scheduled job to in_progress", async () => {
    const { user, token } = await createTestUser(
      "Test User",
      "job@example.com",
    );
    await JobModel.create({
      id: "job-status-001",
      userId: user.id,
      title: "Start Test Job",
      scheduledAt: "2026-09-20T10:00:00+06:00",
      location: "Rajshahi City",
      status: "scheduled",
      priority: "medium",
    });

    const response = await request(app)
      .patch("/api/jobs/job-status-001/status")
      .send({
        status: "in_progress",
      })
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);

    expect(response.body.data).toMatchObject({
      id: "job-status-001",
      status: "in_progress",
    });

    const updatedJob = await JobModel.findOne({
      id: "job-status-001",
    }).lean();

    expect(updatedJob?.status).toBe("in_progress");
  });

  it("moves an in_progress job to completed", async () => {
    const { user, token } = await createTestUser(
      "Test User",
      "job@example.com",
    );
    await JobModel.create({
      id: "job-status-002",
      userId: user.id,
      title: "Complete Test Job",
      scheduledAt: "2026-09-20T11:00:00+06:00",
      location: "Rajshahi City",
      status: "in_progress",
      priority: "high",
    });

    const response = await request(app)
      .patch("/api/jobs/job-status-002/status")
      .send({
        status: "completed",
      })
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);

    expect(response.body.data).toMatchObject({
      id: "job-status-002",
      status: "completed",
    });
  });

  it("rejects an invalid status value", async () => {
    const { token } = await createTestUser("Test User", "job@example.com");
    const response = await request(app)
      .patch("/api/jobs/job-status-003/status")
      .send({
        status: "cancelled",
      })
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(400);

    expect(response.body).toEqual({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid job data",
        details: {
          status: "Status must be scheduled, in_progress, or completed",
        },
      },
    });
  });

  it("rejects an invalid status transition", async () => {
    const { user, token } = await createTestUser(
      "Test User",
      "job@example.com",
    );
    await JobModel.create({
      id: "job-status-004",
      userId: user.id,
      title: "Invalid Transition Test",
      scheduledAt: "2026-09-20T12:00:00+06:00",
      location: "Rajshahi City",
      status: "scheduled",
      priority: "medium",
    });

    const response = await request(app)
      .patch("/api/jobs/job-status-004/status")
      .send({
        status: "completed",
      })
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(400);

    expect(response.body).toMatchObject({
      error: {
        code: "INVALID_STATUS_TRANSITION",
      },
    });
  });

  it("returns 404 when updating a nonexistent job", async () => {
    const { token } = await createTestUser("Test User", "job@example.com");
    const response = await request(app)
      .patch("/api/jobs/job-does-not-exist/status")
      .send({
        status: "in_progress",
      })
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(404);

    expect(response.body).toEqual({
      error: {
        code: "JOB_NOT_FOUND",
        message: "Job not found",
      },
    });
  });

  // malformed-body tests
  it("rejects an empty status request body", async () => {
    const { token } = await createTestUser("Test User", "job@example.com");
    const response = await request(app)
      .patch("/api/jobs/job-status-005/status")
      .send({})
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(400);

    expect(response.body).toEqual({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid job data",
        details: {
          status: "Status must be scheduled, in_progress, or completed",
        },
      },
    });
  });
});

describe("Job ownership", () => {
  it("does not allow one user to access another user's job", async () => {
    const owner = await createTestUser("Owner", "owner@example.com");

    const otherUser = await createTestUser("Other User", "other@example.com");

    await JobModel.create({
      id: "job-owned-by-owner",
      userId: owner.user.id,
      title: "Private Job",
      scheduledAt: "2026-09-20T10:00:00+06:00",
      location: "Rajshahi City",
      status: "scheduled",
      priority: "high",
    });

    const response = await request(app)
      .get("/api/jobs/job-owned-by-owner")
      .set("Authorization", `Bearer ${otherUser.token}`);

    expect(response.status).toBe(404);

    expect(response.body).toEqual({
      error: {
        code: "JOB_NOT_FOUND",
        message: "Job not found",
      },
    });
  });
});

describe("Job authentication", () => {
  it("rejects unauthenticated job list requests", async () => {
    const response = await request(app).get("/api/jobs");

    expect(response.status).toBe(401);

    expect(response.body).toEqual({
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication required",
      },
    });
  });

  it("rejects unauthenticated job creation", async () => {
    const response = await request(app).post("/api/jobs").send({
      title: "Unauthorized Job",
      scheduledAt: "2026-09-20T10:00:00+06:00",
      location: "Rajshahi City",
      priority: "medium",
    });

    expect(response.status).toBe(401);

    expect(response.body).toEqual({
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication required",
      },
    });
  });
});
