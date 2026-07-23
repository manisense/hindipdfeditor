export interface Env {
  GEMINI_API_KEY: string;
  SESSION_SIGNING_SECRET: string;
  TURNSTILE_SECRET_KEY: string;
  GEMINI_MODEL: string;
  ALLOWED_ORIGINS: string;
  TURNSTILE_HOSTNAMES: string;
  AI_TRANSLATION_ENABLED: string;
  AI_OCR_ENABLED: string;
  AI_DB: D1Database;
  AI_RATE_LIMITER: RateLimit;
  AI_ANALYTICS?: AnalyticsEngineDataset;
}
