import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  platform: "node",
  banner: {
    js: `
      import { createRequire as __$topLevelCreateRequire } from 'module';
      const require = __$topLevelCreateRequire(import.meta.url);
    `,
  },
});
