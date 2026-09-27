import { build } from "esbuild";
import { NodeGlobalsPolyfillPlugin } from "@esbuild-plugins/node-globals-polyfill";
import { NodeModulesPolyfillPlugin } from "@esbuild-plugins/node-modules-polyfill";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");

await build({
  entryPoints: [resolve(ROOT, "client/device-wallet-entry.js")],
  outfile: resolve(ROOT, "public/device-wallet.js"),
  bundle: true,
  format: "iife",
  target: ["es2020"],
  platform: "browser",
  sourcemap: false,
  minify: true,
  logLevel: "info",
  plugins: [
    NodeGlobalsPolyfillPlugin({ buffer: true, process: true }),
    NodeModulesPolyfillPlugin(),
  ],
});

console.log("device-wallet.js built successfully");
