import { Schema, model } from "mongoose";

export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
}

const userSchema = new Schema<User>(
  {
    id: {
      type: String,
      required: true,
      unique: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    passwordHash: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

export const UserModel = model<User>("User", userSchema);
