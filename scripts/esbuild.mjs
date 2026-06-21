import { context, build } from "esbuild";
import {
  extensionBuildOptions,
  webviewBuildOptions
} from "../esbuild.config.mjs";

const isWatchMode = process.argv.includes("--watch");
const isProductionBuild = process.argv.includes("--production");

const sharedOptions = {
  minify: isProductionBuild,
  legalComments: "none"
};

const buildOptions = [
  { ...extensionBuildOptions, ...sharedOptions },
  { ...webviewBuildOptions, ...sharedOptions }
];

try {
  if (isWatchMode) {
    const contexts = await Promise.all(
      buildOptions.map((options) => context(options))
    );

    await Promise.all(contexts.map((buildContext) => buildContext.watch()));
    console.log("Watching Wayfinder extension and webview sources...");
  } else {
    await Promise.all(buildOptions.map((options) => build(options)));
  }
} catch (error) {
  console.error("Wayfinder build failed.", error);
  process.exitCode = 1;
}
