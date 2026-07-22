import { z } from "zod";

/**
 * Single source of truth for server-side environment configuration.
 *
 * Parsing is lazy and cached (see {@link getServerEnv}) so importing this module
 * never runs validation at build time — only when config is actually read, and
 * once eagerly at server boot via `src/instrumentation.ts`, which turns a
 * misconfiguration into one clear startup failure instead of a a surprise 500
 * deep inside a request.
 */
const serverEnvSchema = z.object({
  // Postgres connection string (Neon pooled connection in prod/dev).
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  // App-wide master key wrapping every per-user/per-profile DEK. Must decode
  // from base64 to exactly 32 bytes (AES-256). Generate: openssl rand -base64 32
  MASTER_KEY: z
    .string()
    .refine((value) => safeBase64ByteLength(value) === 32, {
      message: "MASTER_KEY must decode from base64 to 32 bytes (openssl rand -base64 32)",
    }),

  // Auth.js session/CSRF signing secret. Generate: openssl rand -base64 32
  AUTH_SECRET: z.string().min(1, "AUTH_SECRET is required"),

  // Transactional email (password reset). Optional at boot; required only when
  // a reset email is actually sent (see src/lib/email/resend.ts).
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().min(1).default("onboarding@resend.dev"),

  // Base URL used to build links in emails.
  APP_URL: z.url().default("http://localhost:3000"),

  // OpenAI: env key is the fallback when no per-app Settings override is set.
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().min(1).default("gpt-4.1-mini"),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

function safeBase64ByteLength(value: string): number {
  try {
    return Buffer.from(value, "base64").length;
  } catch {
    return -1;
  }
}

let cached: ServerEnv | null = null;

/**
 * Validated, typed server env. Parses `process.env` on first call and caches
 * the result; throws a single aggregated error listing every invalid/missing
 * variable if validation fails.
 */
export function getServerEnv(): ServerEnv {
  if (cached) return cached;

  const parsed = serverEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid server environment configuration:\n${issues}`);
  }

  cached = parsed.data;
  return cached;
}

/** Only for tests: clears the memoized env so a changed process.env re-parses. */
export function _resetServerEnvCache(): void {
  cached = null;
}
