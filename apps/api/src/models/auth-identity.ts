import { Schema, model } from "mongoose";

export type AuthProvider = "google";

export interface AuthIdentity {
  userId: string;
  provider: AuthProvider;
  providerUserId: string;
}

const authIdentitySchema = new Schema<AuthIdentity>(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    provider: {
      type: String,
      required: true,
      enum: ["google"],
    },
    providerUserId: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

// Learning: one external account can map to only one application user.
authIdentitySchema.index(
  {
    provider: 1,
    providerUserId: 1,
  },
  {
    unique: true,
  },
);

export const AuthIdentityModel = model<AuthIdentity>(
  "AuthIdentity",
  authIdentitySchema,
);
