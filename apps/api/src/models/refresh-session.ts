import { Schema, model } from "mongoose";

export type RefreshSessionRevokeReason =
  | "ROTATED"
  | "LOGOUT"
  | "IDLE_TIMEOUT"
  | "ABSOLUTE_TIMEOUT"
  | "REUSE_DETECTED"
  | "USER_REMOVED";

export interface RefreshSession {
  id: string;
  userId: string;
  familyId: string;
  tokenHash: string;

  // Absolute maximum lifetime of this session family.
  expiresAt: Date;

  // Maximum inactivity period before this session must be renewed
  // through a new authentication flow.
  idleExpiresAt: Date;

  // Last successful use of a refresh token in this family.
  lastUsedAt: Date;

  revokedAt?: Date | null;
  revokeReason?: RefreshSessionRevokeReason | null;

  // Points from an old rotated token to the replacement session.
  replacedBySessionId?: string | null;

  // When this old session document may be removed from MongoDB.
  cleanupAt?: Date | null;
}

const refreshSessionSchema = new Schema<RefreshSession>(
  {
    id: {
      type: String,
      required: true,
      unique: true,
    },

    userId: {
      type: String,
      required: true,
      index: true,
    },

    familyId: {
      type: String,
      required: true,
      index: true,
    },

    tokenHash: {
      type: String,
      required: true,
      unique: true,
    },

    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },

    idleExpiresAt: {
      type: Date,
      required: true,
      index: true,
    },

    lastUsedAt: {
      type: Date,
      required: true,
    },

    revokedAt: {
      type: Date,
      default: null,
      index: true,
    },

    revokeReason: {
      type: String,
      enum: [
        "ROTATED",
        "LOGOUT",
        "IDLE_TIMEOUT",
        "ABSOLUTE_TIMEOUT",
        "REUSE_DETECTED",
        "USER_REMOVED",
      ],
      default: null,
    },

    replacedBySessionId: {
      type: String,
      default: null,
    },

    cleanupAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

refreshSessionSchema.index({
  userId: 1,
  familyId: 1,
});

refreshSessionSchema.index({ cleanupAt: 1 }, { expireAfterSeconds: 0 });

export const RefreshSessionModel = model<RefreshSession>(
  "RefreshSession",
  refreshSessionSchema,
);
