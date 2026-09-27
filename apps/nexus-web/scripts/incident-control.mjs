// Local operational control plane. Status is read-only by default. Mutating a
// control requires an explicit execute flag and a scoped environment gate.
import { openDb } from "../lib/db.js";
import { applyOperationalControl, operationalStatus, OPERATIONAL_CONTROL_KEYS } from "../lib/operational-controls.js";

function argument(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : null;
}

const execute = process.argv.includes("--execute");
const db = openDb();
try {
  if (!execute) {
    console.log(JSON.stringify({ mode: "status", mutated: false, ...operationalStatus(db) }, null, 2));
  } else {
    if (process.env.NEXUS_INCIDENT_CONTROL_EXECUTE !== "1") throw new Error("incident control execution denied");
    const controlKey = argument("control");
    if (!OPERATIONAL_CONTROL_KEYS.includes(controlKey)) throw new Error(`control must be one of: ${OPERATIONAL_CONTROL_KEYS.join(", ")}`);
    const result = applyOperationalControl({
      db,
      controlKey,
      action: argument("action"),
      severity: argument("severity"),
      reasonCode: argument("reason"),
      approvalId: argument("approval") || process.env.NEXUS_INCIDENT_APPROVAL_ID,
      actor: process.env.NEXUS_INCIDENT_ACTOR,
      checker: process.env.NEXUS_INCIDENT_CHECKER || null,
      incidentId: argument("incident"),
    });
    console.log(JSON.stringify({ mode: "execute", ...result, ...operationalStatus(db) }, null, 2));
  }
} finally {
  db.close();
}
