

import path from "node:path";

const rootDir = process.cwd();

export const extensionBuildOptions = {
  entryPoints: [path.join(rootDir, "src", "extension.ts")],
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node20",
  outfile: path.join(rootDir, "dist", "extension.js"),
  external: ["vscode"],
  sourcemap: true,
  logLevel: "info"
};

export const webviewBuildOptions = {
  entryPoints: [path.join(rootDir, "webview", "src", "main.ts")],
  bundle: true,
  platform: "browser",
  format: "iife",
  target: "es2022",
  outfile: path.join(rootDir, "dist", "webview", "main.js"),
  sourcemap: true,
  logLevel: "info"
};