import { afterAll, afterEach, beforeAll } from "vitest";

import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";

let mongoServer: MongoMemoryServer;

beforeAll(async () => {
  // Learning: Start a temporary MongoDB instance only for tests.
  mongoServer = await MongoMemoryServer.create();

  await mongoose.connect(mongoServer.getUri());
});

afterEach(async () => {
  // Learning: Each test starts with an empty database.
  const collections = mongoose.connection.collections;

  for (const collection of Object.values(collections)) {
    await collection.deleteMany({});
  }
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

// Test starts
//    ↓
// Temporary MongoDB
//    ↓
// Mongoose connects
//    ↓
// Test
//    ↓
// Database cleared
//    ↓
// Next test
//    ↓
// Disconnect + shutdown
