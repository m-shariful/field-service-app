import type { ConnectionOptions } from "bullmq";

const DEFAULT_REDIS_URL = "redis://127.0.0.1:6379";

type RedisConnectionRole = "producer" | "worker";

export function getRedisConnectionOptions(
  role: RedisConnectionRole,
): ConnectionOptions {
  const redisUrl = process.env.REDIS_URL?.trim() || DEFAULT_REDIS_URL;
  const url = new URL(redisUrl);

  if (url.protocol !== "redis:" && url.protocol !== "rediss:") {
    throw new Error("REDIS_URL must use redis:// or rediss://");
  }

  const options: ConnectionOptions = {
    host: url.hostname,
    port: url.port ? Number(url.port) : 6379,
    maxRetriesPerRequest: role === "worker" ? null : 1,
    enableReadyCheck: true,
  };

  if (url.username) {
    options.username = decodeURIComponent(url.username);
  }

  if (url.password) {
    options.password = decodeURIComponent(url.password);
  }

  if (url.pathname.length > 1) {
    const database = Number(url.pathname.slice(1));

    if (!Number.isInteger(database) || database < 0) {
      throw new Error("REDIS_URL contains an invalid database number");
    }

    options.db = database;
  }

  if (url.protocol === "rediss:") {
    options.tls = {};
  }

  return options;
}
