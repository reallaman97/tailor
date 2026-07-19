import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  encryptText,
  decryptText,
  encryptBuffer,
  decryptBuffer,
  generateDek,
  wrapDek,
  unwrapDek,
  getMasterKey,
  EnvelopeCryptoError,
  _resetMasterKeyCache,
} from "./envelope";

const TEST_MASTER_KEY = Buffer.alloc(32, 7).toString("base64");

describe("envelope encryption", () => {
  beforeEach(() => {
    process.env.MASTER_KEY = TEST_MASTER_KEY;
    _resetMasterKeyCache();
  });

  afterEach(() => {
    delete process.env.MASTER_KEY;
    _resetMasterKeyCache();
  });

  it("round-trips plaintext through encryptText/decryptText", () => {
    const dek = generateDek();
    const plaintext = "1985-04-12";
    const blob = encryptText(dek, plaintext);

    expect(blob).not.toContain(plaintext);
    expect(decryptText(dek, blob)).toBe(plaintext);
  });

  it("round-trips binary buffers through encryptBuffer/decryptBuffer", () => {
    const dek = generateDek();
    const plaintext = Buffer.from([0, 1, 2, 255, 254, 253]);
    const blob = encryptBuffer(dek, plaintext);

    expect(decryptBuffer(dek, blob)).toEqual(plaintext);
  });

  it("produces different ciphertext for the same plaintext each time (random IV)", () => {
    const dek = generateDek();
    const blobA = encryptText(dek, "same input");
    const blobB = encryptText(dek, "same input");

    expect(blobA).not.toBe(blobB);
  });

  it("fails to decrypt with the wrong key", () => {
    const dekA = generateDek();
    const dekB = generateDek();
    const blob = encryptText(dekA, "sensitive data");

    expect(() => decryptText(dekB, blob)).toThrow(EnvelopeCryptoError);
  });

  it("fails to decrypt tampered ciphertext", () => {
    const dek = generateDek();
    const blob = encryptText(dek, "sensitive data");
    const raw = Buffer.from(blob, "base64");
    raw[raw.length - 1] ^= 0xff; // flip a byte in the ciphertext
    const tampered = raw.toString("base64");

    expect(() => decryptText(dek, tampered)).toThrow(EnvelopeCryptoError);
  });

  it("wraps and unwraps a per-user DEK under the master key", () => {
    const dek = generateDek();
    const wrapped = wrapDek(dek);

    expect(wrapped).not.toEqual(dek.toString("base64"));
    expect(unwrapDek(wrapped)).toEqual(dek);
  });

  it("a DEK wrapped under one master key cannot be unwrapped under another", () => {
    const dek = generateDek();
    const wrapped = wrapDek(dek);

    process.env.MASTER_KEY = Buffer.alloc(32, 99).toString("base64");
    _resetMasterKeyCache();

    expect(() => unwrapDek(wrapped)).toThrow(EnvelopeCryptoError);
  });

  it("throws a clear error when MASTER_KEY is missing", () => {
    delete process.env.MASTER_KEY;
    _resetMasterKeyCache();

    expect(() => getMasterKey()).toThrow(/MASTER_KEY environment variable is not set/);
  });

  it("throws a clear error when MASTER_KEY is the wrong length", () => {
    process.env.MASTER_KEY = Buffer.alloc(16, 1).toString("base64");
    _resetMasterKeyCache();

    expect(() => getMasterKey()).toThrow(/must decode to 32 bytes/);
  });
});
