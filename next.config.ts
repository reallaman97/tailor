import type { NextConfig } from "next";

const securityHeaders = [
  // Prevents the app from being embedded in a frame elsewhere (clickjacking).
  { key: "X-Frame-Options", value: "DENY" },
  // Blocks MIME-sniffing away from a response's declared Content-Type.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Sends the full referrer only to our own origin; a trimmed one cross-origin.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Disables browser features this app never uses.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // Forces HTTPS on repeat visits (Vercel serves HTTPS by default).
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Default 1MB is too small for resume PDF/DOCX uploads.
      bodySizeLimit: "5mb",
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
