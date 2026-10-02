type AuthDebugMeta = Record<string, unknown>;

function sanitizeMeta(meta: AuthDebugMeta): AuthDebugMeta {
  const safe: AuthDebugMeta = {};

  for (const [key, value] of Object.entries(meta)) {
    const normalizedKey = key.toLowerCase();

    if (
      normalizedKey.includes("token") ||
      normalizedKey.includes("secret") ||
      normalizedKey.includes("password")
    ) {
      safe[key] = "[REDACTED]";
      continue;
    }

    safe[key] = value;
  }

  return safe;
}

export function authDebug(event: string, meta: AuthDebugMeta = {}): void {
  if (process.env.NODE_ENV === "production") {
    return;
  }

  console.info(`[AUTH] ${event}`, sanitizeMeta(meta));
}
