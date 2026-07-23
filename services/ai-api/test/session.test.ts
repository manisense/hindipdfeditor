import { describe, expect, it } from "vitest";

import { createSession, verifySession } from "../src/session";

const SECRET = "0123456789abcdef0123456789abcdef";
const NOW = Date.UTC(2026, 6, 22, 12, 0, 0);

describe("AI session tokens", () => {
  it("creates and verifies a signed, pseudonymous Android session", async () => {
    const session = await createSession(
      "installation-id-123456",
      "android",
      SECRET,
      NOW,
    );
    const payload = await verifySession(
      `Bearer ${session.token}`,
      SECRET,
      NOW + 1_000,
    );
    expect(payload.platform).toBe("android");
    expect(payload.actorId).not.toContain("installation-id");
    expect(session.expiresAt).toBe(
      new Date(NOW + 24 * 60 * 60 * 1000).toISOString(),
    );
  });

  it("rejects tampered, missing, and expired sessions", async () => {
    const session = await createSession(
      "browser-id-12345678",
      "web",
      SECRET,
      NOW,
    );
    await expect(verifySession(null, SECRET, NOW)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(
      verifySession(`Bearer ${session.token.slice(0, -1)}x`, SECRET, NOW),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      verifySession(
        `Bearer ${session.token}`,
        SECRET,
        NOW + 25 * 60 * 60 * 1000,
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("fails closed when the signing secret is too short", async () => {
    await expect(
      createSession("installation-id-123456", "android", "short", NOW),
    ).rejects.toMatchObject({
      code: "INTERNAL_ERROR",
    });
  });
});
