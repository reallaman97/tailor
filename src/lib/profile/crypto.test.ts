import { describe, it, expect } from "vitest";
import { randomBytes } from "node:crypto";
import {
  encryptField,
  decryptField,
  encryptOptionalField,
  decryptOptionalField,
  encryptJson,
  decryptJson,
} from "./crypto";

const dek = randomBytes(32);

describe("profile field encryption", () => {
  it("round-trips a required field", () => {
    const blob = encryptField(dek, "Jane Doe");
    expect(decryptField(dek, blob)).toBe("Jane Doe");
    expect(blob).not.toContain("Jane Doe");
  });

  it("encryptOptionalField passes through null/undefined/empty as null", () => {
    expect(encryptOptionalField(dek, null)).toBeNull();
    expect(encryptOptionalField(dek, undefined)).toBeNull();
    expect(encryptOptionalField(dek, "")).toBeNull();
  });

  it("round-trips a present optional field", () => {
    const blob = encryptOptionalField(dek, "1990-01-01");
    expect(blob).not.toBeNull();
    expect(decryptOptionalField(dek, blob)).toBe("1990-01-01");
  });

  it("decryptOptionalField passes through null as null", () => {
    expect(decryptOptionalField(dek, null)).toBeNull();
  });

  it("round-trips a JSON array (e.g. achievement bullets)", () => {
    const bullets = ["Shipped feature X", "Reduced latency by 30%"];
    const blob = encryptJson(dek, bullets);
    expect(decryptJson<string[]>(dek, blob)).toEqual(bullets);
  });

  it("round-trips a JSON object (e.g. address)", () => {
    const address = { line1: "123 Main St", line2: null, postalCode: "12345", country: "US" };
    const blob = encryptJson(dek, address);
    expect(decryptJson(dek, blob)).toEqual(address);
  });
});
