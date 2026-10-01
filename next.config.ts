import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

// Content-Security-Policy: defence-in-depth against XSS and data exfiltration.
// This app loads no third-party scripts, styles, fonts, or frames, so every
// resource type is locked to our own origin. A static policy (rather than a
// per-request nonce) keeps it simple and pairs with the header block below;
// `'unsafe-inline'` is required because Next.js injects inline bootstrap/
// hydration scripts and styles without a nonce here, and `'unsafe-eval'` is
// only added in dev (React uses eval for richer error overlays; production
// needs neither).
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
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
  // Base-resume import parses uploaded PDF/DOCX files server-side. Both parsers
  // load their own internals at runtime (pdf-parse bundles pdf.js and its
  // worker), so they must be required from node_modules rather than bundled.
  serverExternalPackages: ["pdf-parse", "mammoth"],
  experimental: {
    serverActions: {
      // Proof-of-application screenshots are uploaded through a server action
      // and may be up to 4.5MB (MAX_SCREENSHOT_BYTES); the default cap is 1MB,
      // which silently rejected most full-page screenshots. The client also
      // re-encodes oversized images before sending (screenshot-upload.tsx).
      bodySizeLimit: "5mb",
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
