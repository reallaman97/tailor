-- A superadmin can optionally override OPENAI_API_KEY from Settings. Stored
-- encrypted (AES-256-GCM via the app master key) — never plaintext.
ALTER TABLE "AppSettings" ADD COLUMN "openaiApiKeyEnc" TEXT;
