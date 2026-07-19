import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    setupFiles: ["./vitest.setup.ts"],
    // Integration tests hit a real Neon Postgres instance over the network;
    // cold pooler connections can take a few seconds longer than the default.
    testTimeout: 20000,
    // Each test file gets its own db.ts singleton (own pg Pool) in its own
    // worker. Running many files in parallel opened enough concurrent pools
    // to intermittently exhaust Neon's pooled connection limit, causing
    // sporadic failures unrelated to the code under test. Sequential file
    // execution trades speed for reliability here, which is the right
    // trade for a suite this size against a shared network database.
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
