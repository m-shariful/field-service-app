import { Schema, model } from "mongoose";

export type IdempotencyStatus = "PROCESSING" | "COMPLETED";

export interface IdempotencyKey {
  userId: string;
  key: string;
  scope: string;

  requestHash: string;

  status: IdempotencyStatus;

  executionToken?: string | null;

  responseStatus?: number | null;
  responseBody?: unknown;

  expiresAt: Date;

  createdAt: Date;
  updatedAt: Date;
}

const idempotencyKeySchema = new Schema<IdempotencyKey>(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },

    key: {
      type: String,
      required: true,
    },

    scope: {
      type: String,
      required: true,
    },

    requestHash: {
      type: String,
      required: true,
    },

    status: {
      type: String,
      enum: ["PROCESSING", "COMPLETED"],
      required: true,
    },

    executionToken: {
      type: String,
      default: null,
    },

    responseStatus: {
      type: Number,
      default: null,
    },

    responseBody: {
      type: Schema.Types.Mixed,
      default: null,
    },

    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

idempotencyKeySchema.index(
  {
    userId: 1,
    scope: 1,
    key: 1,
  },
  {
    unique: true,
  },
);

idempotencyKeySchema.index(
  {
    expiresAt: 1,
  },
  {
    expireAfterSeconds: 0,
  },
);

export const IdempotencyKeyModel = model<IdempotencyKey>(
  "IdempotencyKey",
  idempotencyKeySchema,
);

// Idempotency Key Example Document
// {
//   "userId": "user-123",
//   "key": "abc-123",
//   "scope": "CREATE_ORDER",

//   "requestHash": "sha256(...)",

//   "status": "COMPLETED",

//   "executionToken": null,

//   "responseStatus": 201,

//   "responseBody": {
//     "orderId": "order-789"
//   },

//   "expiresAt": "2026-10-09T00:00:00Z"
// }
