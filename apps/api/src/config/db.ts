import mongoose from "mongoose";

export async function connectToDatabase() {
  try {
    await mongoose.connect(process.env.MONGODB_URI!);

    console.log("✅ Connected to MongoDB");
  } catch (err: any) {
    console.error("❌ Failed to connect to MongoDB:", err.message);
    process.exit(1);
  }
}
