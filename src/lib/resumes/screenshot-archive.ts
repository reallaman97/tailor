// Proof-of-application screenshots are only ever looked at by a person
// checking "did they really submit it?" — the confirmation page, its heading,
// the URL bar. They don't need color or full resolution, and they pile up in
// the database with every application, so each one is stored in an archive
// format: grayscale WebP, at most ARCHIVE_WIDTH_PX wide, low quality.
// Measured on real screenshots: 816KB PNG -> 23KB, headings still crisp.

export const ARCHIVE_MIME_TYPE = "image/webp";
const ARCHIVE_WIDTH_PX = 1280;
// Full-page captures can be very tall; only cap height where WebP itself must.
const ARCHIVE_MAX_HEIGHT_PX = 16_000;
const ARCHIVE_QUALITY = 40;

/**
 * Re-encodes a screenshot for archival storage. Returns null if the image
 * can't be processed (not decodable, or the image library is unavailable on
 * this host) — callers then keep the original, so an upload never fails here.
 */
export async function archiveScreenshot(data: Buffer): Promise<{ data: Buffer; mimeType: string } | null> {
  try {
    // Loaded lazily: sharp is a native module, and a host without it must not
    // take down every route that imports this file.
    const { default: sharp } = await import("sharp");
    const archived = await sharp(data, { failOn: "none" })
      .rotate() // apply EXIF orientation (phone photos of a screen)
      .resize({
        width: ARCHIVE_WIDTH_PX,
        height: ARCHIVE_MAX_HEIGHT_PX,
        fit: "inside",
        withoutEnlargement: true,
      })
      .grayscale()
      .webp({ quality: ARCHIVE_QUALITY, effort: 6 })
      .toBuffer();
    // Already-tiny images can come out larger; keep whichever is smaller.
    if (archived.byteLength >= data.byteLength) return null;
    return { data: archived, mimeType: ARCHIVE_MIME_TYPE };
  } catch (err) {
    console.error("[screenshot-archive] couldn't compress screenshot; storing original", err);
    return null;
  }
}
