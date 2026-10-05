import { describe, it, expect } from "vitest";
import { randomBytes } from "node:crypto";
import sharp from "sharp";
import { archiveScreenshot, ARCHIVE_MIME_TYPE } from "./screenshot-archive";

/** A colorful, noisy "screenshot" (think photos and gradients) — the kind PNG stores poorly. */
async function fakeScreenshot(width: number, height: number): Promise<Buffer> {
  return sharp(randomBytes(width * height * 3), { raw: { width, height, channels: 3 } }).png().toBuffer();
}

describe("archiveScreenshot", () => {
  it("stores a large screenshot as a much smaller grayscale WebP, at most 1280px wide", async () => {
    const original = await fakeScreenshot(2560, 1440);
    const archived = await archiveScreenshot(original);

    expect(archived?.mimeType).toBe(ARCHIVE_MIME_TYPE);
    expect(archived!.data.byteLength).toBeLessThan(original.byteLength / 2);
    const meta = await sharp(archived!.data).metadata();
    expect(meta.width).toBe(1280);
    expect(meta.height).toBe(720);
    // WebP has no grayscale mode — it decodes as RGB, but with R = G = B.
    const { channels } = await sharp(archived!.data).stats();
    expect(channels[0].mean).toBeCloseTo(channels[1].mean, 0);
    expect(channels[1].mean).toBeCloseTo(channels[2].mean, 0);
  });

  it("keeps a tall full-page capture tall instead of shrinking it to a sliver", async () => {
    const archived = await archiveScreenshot(await fakeScreenshot(1920, 6000));
    const meta = await sharp(archived!.data).metadata();
    expect(meta.width).toBe(1280);
    expect(meta.height).toBe(4000);
  });

  it("returns null for data that isn't an image, so the caller keeps the original", async () => {
    expect(await archiveScreenshot(Buffer.from("not an image at all"))).toBeNull();
  });
});
