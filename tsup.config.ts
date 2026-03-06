import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: {
      index: "src/index.ts",
      cli: "src/cli-entry.ts",
    },
    format: ["esm"],
    target: "node20",
    platform: "node",
    dts: true,
    sourcemap: true,
    clean: true,
    splitting: false,
    shims: false,
  },
]);
