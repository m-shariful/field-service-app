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
      if (typeof value === "string") {
        safe[key] = {
          present: value.length > 0,
          length: value.length,
        };
      } else {
        safe[key] = "[REDACTED]";
      }

      continue;
    }

    safe[key] = value;
  }

  return safe;
}

export function authDebug(event: string, meta: AuthDebugMeta = {}): void {
  if (!__DEV__) {
    return;
  }

  console.log(`[AUTH] ${event}`, sanitizeMeta(meta));
}
