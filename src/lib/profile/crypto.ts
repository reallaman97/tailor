import { encryptText, decryptText } from "@/lib/crypto/envelope";

/** Encrypts a required text field. */
export function encryptField(dek: Buffer, value: string): string {
  return encryptText(dek, value);
}

/** Decrypts a required text field. */
export function decryptField(dek: Buffer, blob: string): string {
  return decryptText(dek, blob);
}

/** Encrypts an optional text field, passing through null/undefined as null. */
export function encryptOptionalField(dek: Buffer, value: string | null | undefined): string | null {
  if (value === null || value === undefined || value === "") return null;
  return encryptText(dek, value);
}

/** Decrypts an optional text field, passing through null as null. */
export function decryptOptionalField(dek: Buffer, blob: string | null): string | null {
  if (blob === null) return null;
  return decryptText(dek, blob);
}

/** Encrypts a JSON-serializable value as a single ciphertext blob. */
export function encryptJson<T>(dek: Buffer, value: T): string {
  return encryptText(dek, JSON.stringify(value));
}

/** Decrypts a JSON-serializable value previously stored with {@link encryptJson}. */
export function decryptJson<T>(dek: Buffer, blob: string): T {
  return JSON.parse(decryptText(dek, blob)) as T;
}
