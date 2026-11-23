import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// Standalone test config: skips the Start/Nitro/Varlock plugins used for the app build.
export default defineConfig({
  plugins: [viteReact()],
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["./src/test/setup.ts"],
  },
});