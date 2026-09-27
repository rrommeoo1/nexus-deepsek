import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const env = readFileSync(resolve(root, ".env.example"), "utf8");
const readme = readFileSync(resolve(root, "README.md"), "utf8");
const api = readFileSync(resolve(root, "lib/api.js"), "utf8");
const server = readFileSync(resolve(root, "server.js"), "utf8");
const required = ["NODE_ENV", "NEXUS_SESSION_SECRET", "NEXUS_ORIGIN", "NEXUS_ACCEPTED_ORIGINS", "NEXUS_WC_PROJECT_ID", "NEXUS_WC_PROJECT_ATTESTED", "NEXUS_WC_ATTESTED_ORIGINS", "NEXUS_DATA_DIR", "NEXUS_RATE_LIMIT_MODE", "NEXUS_TRUST_PROXY", "HOST", "PORT"];
const checks = {
  env_contract_complete: required.every((key) => new RegExp(`^${key}=`, "m").test(env)),
  committed_secret_empty: /^NEXUS_SESSION_SECRET=\s*$/m.test(env),
  lan_bind_documented: /^HOST=0\.0\.0\.0$/m.test(env) && readme.includes("0.0.0.0"),
  production_steps_documented: readme.includes("## Configurare production") && readme.includes("NEXUS_DATA_DIR"),
  health_route_present: api.includes('method === "GET" && path === "/health"'),
  health_listen_documented: server.includes("Health: http://localhost:${port}/health"),
  critical_local_gates_documented: ["npm run audit:reads", "npm run audit:supply-chain", "npm run release:check"].every((item) => readme.includes(item)),
  external_gates_not_hidden: readme.includes("## Gates externe încă necesare"),
};
const passed = Object.values(checks).filter(Boolean).length;
const report = { schema: "NEXUS_DEPLOYMENT_CONTRACT_V1", cycle: 172, required_env: required, checks,
  summary: { total: Object.keys(checks).length, passed, failed: Object.keys(checks).length - passed },
  external_network: false, incremental_cost: 0,
  gate: passed === Object.keys(checks).length ? "PASS_LOCAL" : "FAIL_LOCAL" };
process.stdout.write(JSON.stringify(report, null, 2) + "\n");
if (report.gate !== "PASS_LOCAL") process.exitCode = 1;
