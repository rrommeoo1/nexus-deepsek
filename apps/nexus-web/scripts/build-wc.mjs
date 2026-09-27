// Bundles src/wc-client.js into public/wc-bundle.js for the browser.
// WalletConnect + MultiversX SDKs are Node-oriented, so we apply the standard
// Node globals/modules polyfills via esbuild plugins.
import { build } from "esbuild";
import { NodeGlobalsPolyfillPlugin } from "@esbuild-plugins/node-globals-polyfill";
import { NodeModulesPolyfillPlugin } from "@esbuild-plugins/node-modules-polyfill";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");

await build({
  entryPoints: [resolve(ROOT, "src/wc-client.js")],
  outfile: resolve(ROOT, "public/wc-bundle.js"),
  bundle: true,
  format: "esm",
  target: ["es2020"],
  platform: "browser",
  sourcemap: false,
  minify: false,
  logLevel: "info",
  plugins: [
    NodeGlobalsPolyfillPlugin({
      buffer: true,
      process: true,
    }),
    NodeModulesPolyfillPlugin(),
  ],
});

console.log("wc-bundle.js built successfully");