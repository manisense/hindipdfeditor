import type { AiClientPlatform } from "@hindipdfeditor/translation-contract";

import { ApiError } from "./errors";

const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

type SessionPayload = {
  actorId: string;
  platform: AiClientPlatform;
  issuedAt: number;
  expiresAt: number;
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromBase64Url(value: string): Uint8Array {
  const base64 = value
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(base64);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function hmac(value: string, secret: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(
    await crypto.subtle.sign("HMAC", key, encoder.encode(value)),
  );
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return toBase64Url(new Uint8Array(digest));
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= (left[index] ?? 0) ^ (right[index] ?? 0);
  }
  return difference === 0;
}

export async function createSession(
  clientId: string,
  platform: AiClientPlatform,
  secret: string,
  nowMs: number,
): Promise<{ token: string; expiresAt: string }> {
  if (secret.length < 32) {
    throw new ApiError(
      "INTERNAL_ERROR",
      "AI session signing is not configured.",
      500,
    );
  }
  const payload: SessionPayload = {
    actorId: await sha256(clientId),
    platform,
    issuedAt: nowMs,
    expiresAt: nowMs + SESSION_TTL_MS,
  };
  const encodedPayload = toBase64Url(encoder.encode(JSON.stringify(payload)));
  const signature = toBase64Url(await hmac(`v1.${encodedPayload}`, secret));
  return {
    token: `v1.${encodedPayload}.${signature}`,
    expiresAt: new Date(payload.expiresAt).toISOString(),
  };
}

export async function verifySession(
  authorization: string | null,
  secret: string,
  nowMs: number,
): Promise<SessionPayload> {
  if (!authorization?.startsWith("Bearer ")) {
    throw new ApiError("FORBIDDEN", "A valid AI session is required.", 401);
  }
  const token = authorization.slice("Bearer ".length);
  const [version, encodedPayload, encodedSignature, extra] = token.split(".");
  if (
    version !== "v1" ||
    !encodedPayload ||
    !encodedSignature ||
    extra !== undefined
  ) {
    throw new ApiError("FORBIDDEN", "The AI session is invalid.", 401);
  }
  let payload: SessionPayload;
  try {
    payload = JSON.parse(
      decoder.decode(fromBase64Url(encodedPayload)),
    ) as SessionPayload;
  } catch {
    throw new ApiError("FORBIDDEN", "The AI session is invalid.", 401);
  }
  const expectedSignature = await hmac(`v1.${encodedPayload}`, secret);
  if (!constantTimeEqual(expectedSignature, fromBase64Url(encodedSignature))) {
    throw new ApiError("FORBIDDEN", "The AI session is invalid.", 401);
  }
  if (
    typeof payload.actorId !== "string" ||
    (payload.platform !== "android" && payload.platform !== "web") ||
    !Number.isFinite(payload.expiresAt) ||
    payload.expiresAt <= nowMs
  ) {
    throw new ApiError("FORBIDDEN", "The AI session has expired.", 401);
  }
  return payload;
}
