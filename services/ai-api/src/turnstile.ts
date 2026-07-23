import { ApiError } from "./errors";
import type { Env } from "./env";

type TurnstileResult = {
  success?: boolean;
  hostname?: string;
  action?: string;
};

export async function verifyTurnstile(
  token: string | undefined,
  request: Request,
  env: Env,
  fetchImpl: typeof fetch,
): Promise<void> {
  if (!token)
    throw new ApiError("FORBIDDEN", "Human verification is required.", 403);
  const body = new FormData();
  body.set("secret", env.TURNSTILE_SECRET_KEY);
  body.set("response", token);
  const remoteIp = request.headers.get("CF-Connecting-IP");
  if (remoteIp) body.set("remoteip", remoteIp);
  body.set("idempotency_key", crypto.randomUUID());

  let response: Response;
  try {
    response = await fetchImpl(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        body,
        signal: AbortSignal.timeout(10_000),
      },
    );
  } catch {
    throw new ApiError(
      "TEMPORARILY_UNAVAILABLE",
      "Human verification is temporarily unavailable.",
      503,
      true,
    );
  }
  const result = (await response
    .json()
    .catch(() => null)) as TurnstileResult | null;
  const allowedHostnames = new Set(
    env.TURNSTILE_HOSTNAMES.split(",").map((value) => value.trim()),
  );
  if (
    !response.ok ||
    result?.success !== true ||
    !result.hostname ||
    !allowedHostnames.has(result.hostname) ||
    result.action !== "ai-session"
  ) {
    throw new ApiError(
      "FORBIDDEN",
      "Human verification failed. Please try again.",
      403,
    );
  }
}
