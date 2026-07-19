import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH_BYTES = 32; // AES-256
const IV_LENGTH_BYTES = 12; // 96-bit nonce, standard for GCM
const AUTH_TAG_LENGTH_BYTES = 16;

export class EnvelopeCryptoError extends Error {}

let cachedMasterKey: Buffer | null = null;

/**
 * The app-wide master key that wraps every user's per-user data encryption
 * key (DEK). Never used to encrypt profile data directly.
 */
export function getMasterKey(): Buffer {
  if (cachedMasterKey) return cachedMasterKey;

  const raw = process.env.MASTER_KEY;
  if (!raw) {
    throw new EnvelopeCryptoError(
      "MASTER_KEY environment variable is not set. Generate one with: openssl rand -base64 32"
    );
  }

  const key = Buffer.from(raw, "base64");
  if (key.length !== KEY_LENGTH_BYTES) {
    throw new EnvelopeCryptoError(
      `MASTER_KEY must decode to ${KEY_LENGTH_BYTES} bytes, got ${key.length}. Generate one with: openssl rand -base64 32`
    );
  }

  cachedMasterKey = key;
  return key;
}

/** Only for tests: clears the memoized master key so env var changes take effect. */
export function _resetMasterKeyCache(): void {
  cachedMasterKey = null;
}

/** Generates a fresh random 256-bit data encryption key for one user. */
export function generateDek(): Buffer {
  return randomBytes(KEY_LENGTH_BYTES);
}

/**
 * Encrypts a buffer with AES-256-GCM under the given key.
 * Returns iv || authTag || ciphertext, base64-encoded, safe to store in a
 * single text column.
 */
export function encryptBuffer(key: Buffer, plaintext: Buffer): string {
  if (key.length !== KEY_LENGTH_BYTES) {
    throw new EnvelopeCryptoError(`Encryption key must be ${KEY_LENGTH_BYTES} bytes, got ${key.length}`);
  }

  const iv = randomBytes(IV_LENGTH_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return Buffer.concat([iv, authTag, ciphertext]).toString("base64");
}

/** Reverses {@link encryptBuffer}. Throws if the key is wrong or the blob was tampered with. */
export function decryptBuffer(key: Buffer, blob: string): Buffer {
  if (key.length !== KEY_LENGTH_BYTES) {
    throw new EnvelopeCryptoError(`Decryption key must be ${KEY_LENGTH_BYTES} bytes, got ${key.length}`);
  }

  const raw = Buffer.from(blob, "base64");
  if (raw.length < IV_LENGTH_BYTES + AUTH_TAG_LENGTH_BYTES) {
    throw new EnvelopeCryptoError("Ciphertext blob is too short to contain an iv and auth tag");
  }

  const iv = raw.subarray(0, IV_LENGTH_BYTES);
  const authTag = raw.subarray(IV_LENGTH_BYTES, IV_LENGTH_BYTES + AUTH_TAG_LENGTH_BYTES);
  const ciphertext = raw.subarray(IV_LENGTH_BYTES + AUTH_TAG_LENGTH_BYTES);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  try {
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch {
    throw new EnvelopeCryptoError("Failed to decrypt: wrong key or corrupted/tampered ciphertext");
  }
}

/** String convenience wrapper around {@link encryptBuffer} for UTF-8 text fields. */
export function encryptText(key: Buffer, plaintext: string): string {
  return encryptBuffer(key, Buffer.from(plaintext, "utf8"));
}

/** String convenience wrapper around {@link decryptBuffer} for UTF-8 text fields. */
export function decryptText(key: Buffer, blob: string): string {
  return decryptBuffer(key, blob).toString("utf8");
}

/** Wraps a freshly generated per-user DEK under the master key, for storage on User.encryptedDek. */
export function wrapDek(dek: Buffer): string {
  return encryptBuffer(getMasterKey(), dek);
}

/** Unwraps a user's DEK from User.encryptedDek using the master key. */
export function unwrapDek(encryptedDek: string): Buffer {
  return decryptBuffer(getMasterKey(), encryptedDek);
}
