import { defineConfig } from "tsup";

// Disable source maps for production builds to reduce package size
// Source maps add ~688KB to the package (344KB per format)
// They're useful for debugging but not necessary in published packages
const isWatch = process.argv.includes("--watch");
const enableSourceMaps = isWatch || process.env.SOURCEMAP === "true";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs", "esm"],
  dts: true,
  splitting: false,
  sourcemap: enableSourceMaps,
  clean: true,
  treeshake: true,
  outDir: "dist",
});
