export interface JobSyncCursor {
  updatedAt: string;
  id: string;
}

function encodeBase64Url(value: string): string {
  return Buffer.from(value, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function decodeBase64Url(value: string): string {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");

  const padding =
    normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));

  return Buffer.from(normalized + padding, "base64").toString("utf8");
}

export function encodeJobSyncCursor(cursor: JobSyncCursor): string {
  return encodeBase64Url(JSON.stringify(cursor));
}

export function decodeJobSyncCursor(encodedCursor: string): JobSyncCursor {
  if (!encodedCursor || encodedCursor.length > 512) {
    throw new Error("INVALID_SYNC_CURSOR");
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(decodeBase64Url(encodedCursor));
  } catch {
    throw new Error("INVALID_SYNC_CURSOR");
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("INVALID_SYNC_CURSOR");
  }

  const value = parsed as Record<string, unknown>;

  if (
    typeof value.updatedAt !== "string" ||
    typeof value.id !== "string" ||
    !value.updatedAt ||
    !value.id
  ) {
    throw new Error("INVALID_SYNC_CURSOR");
  }

  const timestamp = Date.parse(value.updatedAt);

  if (!Number.isFinite(timestamp)) {
    throw new Error("INVALID_SYNC_CURSOR");
  }

  return {
    updatedAt: new Date(timestamp).toISOString(),
    id: value.id,
  };
}
