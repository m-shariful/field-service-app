import { createHash, randomUUID } from "crypto";

import { IdempotencyKeyModel } from "../models/idempotency-key";

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * A request marked PROCESSING should not stay locked forever.
 *
 * If the mobile app dies while the server is processing a mutation,
 * another retry may reclaim the record after this period.
 *
 * The actual job operations are also designed to be safely repeatable:
 * - create uses a stable client job id
 * - status update is idempotent for the same target status
 */
const PROCESSING_TIMEOUT_MS = 60 * 1000;

export interface IdempotentExecutionResult {
  statusCode: number;
  body: unknown;
}

export class IdempotencyInProgressError extends Error {
  constructor() {
    super("IDEMPOTENCY_REQUEST_IN_PROGRESS");
    this.name = "IdempotencyInProgressError";
  }
}

export class IdempotencyKeyReuseError extends Error {
  constructor() {
    super("IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST");
    this.name = "IdempotencyKeyReuseError";
  }
}

/**
 * Produces deterministic JSON for request hashing.
 *
 * Object keys are sorted recursively so equivalent payloads
 * produce the same hash even when property order differs.
 */
function normalizeForHash(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(normalizeForHash);
  }

  if (value && typeof value === "object") {
    const object = value as Record<string, unknown>;

    return Object.keys(object)
      .sort()
      .reduce<Record<string, unknown>>((result, key) => {
        result[key] = normalizeForHash(object[key]);
        return result;
      }, {});
  }

  return value;
}

function hashRequest(payload: unknown): string {
  const normalized = JSON.stringify(normalizeForHash(payload));

  return createHash("sha256").update(normalized).digest("hex");
}

function getExpiresAt(): Date {
  return new Date(Date.now() + IDEMPOTENCY_TTL_MS);
}

function getProcessingCutoff(): Date {
  return new Date(Date.now() - PROCESSING_TIMEOUT_MS);
}

export async function executeIdempotently(options: {
  userId: string;
  key?: string;
  scope: string;
  requestPayload: unknown;
  execute: () => Promise<IdempotentExecutionResult>;
}): Promise<IdempotentExecutionResult> {
  /**
   * Existing online clients do not have to provide an
   * Idempotency-Key yet.
   *
   * The Sync Engine will always provide one.
   */
  if (!options.key) {
    return options.execute();
  }

  const key = options.key.trim();

  if (!key || key.length > 128) {
    throw new IdempotencyKeyReuseError();
  }

  const requestHash = hashRequest(options.requestPayload);

  const executionToken = randomUUID();

  let record = await IdempotencyKeyModel.findOneAndUpdate(
    {
      userId: options.userId,
      scope: options.scope,
      key,
    },
    {
      $setOnInsert: {
        userId: options.userId,
        scope: options.scope,
        key,
        requestHash,

        status: "PROCESSING",
        executionToken,

        responseStatus: null,
        responseBody: null,

        expiresAt: getExpiresAt(),
      },
    },
    {
      new: true,
      upsert: true,
    },
  );

  if (!record) {
    throw new Error("IDEMPOTENCY_RECORD_CREATION_FAILED");
  }

  if (record.requestHash !== requestHash) {
    throw new IdempotencyKeyReuseError();
  }

  /**
   * Previous request already completed.
   *
   * Return exactly the previous HTTP result.
   */
  if (record.status === "COMPLETED") {
    return {
      statusCode: record.responseStatus ?? 200,
      body: record.responseBody,
    };
  }

  /**
   * Another request currently owns the mutation.
   */
  if (record.executionToken !== executionToken) {
    const processingCutoff = getProcessingCutoff();

    /**
     * A crashed server process may have left the record
     * permanently marked as PROCESSING.
     *
     * Allow a stale lock to be reclaimed.
     */
    if (record.updatedAt <= processingCutoff) {
      record =
        (await IdempotencyKeyModel.findOneAndUpdate(
          {
            _id: record._id,
            status: "PROCESSING",
            executionToken: record.executionToken,
            updatedAt: {
              $lte: processingCutoff,
            },
          },
          {
            $set: {
              executionToken,
              updatedAt: new Date(),
            },
          },
          {
            new: true,
          },
        )) ?? record;
    }

    if (record.executionToken !== executionToken) {
      throw new IdempotencyInProgressError();
    }
  }

  const result = await options.execute();

  const completion = await IdempotencyKeyModel.updateOne(
    {
      _id: record._id,
      executionToken,
      status: "PROCESSING",
    },
    {
      $set: {
        status: "COMPLETED",
        responseStatus: result.statusCode,
        responseBody: result.body,
        updatedAt: new Date(),
      },

      $unset: {
        executionToken: "",
      },
    },
  );

  if (completion.matchedCount !== 1) {
    // Ownership was lost or the record changed.
    // Handle this explicitly; do not assume completion was saved.
  }

  return result;
}
