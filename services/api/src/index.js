// Entrypoint: build the durable store and start the HTTP server.
// Run with `npm run dev` or `npm start` from services/api.

import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { JsonStore } from "./store.js";
import { startServer } from "./server.js";

const here = dirname(fileURLToPath(import.meta.url));
const dataFile = join(here, "..", "data", "nexus.json");
const store = new JsonStore(dataFile);

const { server, port, host } = await startServer({ store, port: 3001, host: "0.0.0.0" });
console.log(`Nexus core API listening on http://${host}:${port}`);

function shutdown(signal) {
  console.log(`\n${signal} received — closing server.`);
  server.close(() => process.exit(0));
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));