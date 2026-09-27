// Bounded, deterministic, local-only soak. This composes the real repository
// actor lab with the crash-window and abuse drills; it never opens a socket.
import { performance } from "node:perf_hooks";
import { runActors } from "./actors.js";
import { runAbuseSimulation } from "./abuse-simulation.mjs";
import { runMutationOutboxDrill } from "./mutation-outbox-drill.mjs";

const bounded = (value, minimum, maximum, fallback) =>
  Math.max(minimum, Math.min(maximum, Number(value) || fallback));

export function runLocalSoak({ rounds = 3, actors = 100 } = {}) {
  rounds = bounded(rounds, 1, 10, 3);
  actors = bounded(actors, 10, 1_000, 100);
  const samples = [];
  const started = performance.now();

  for (let round = 0; round < rounds; round++) {
    const roundStarted = performance.now();
    const actor = runActors({ count: actors, seed: 0x4e585553 + round });
    const abuse = runAbuseSimulation({ actorCount: Math.max(10, Math.ceil(actors / 4)) });
    const outbox = runMutationOutboxDrill();
    samples.push({
      round: round + 1,
      elapsed_ms: Math.round(performance.now() - roundStarted),
      actor_gate: actor.deployment_gate,
      actor_issues: actor.issues.length,
      abuse_gate: abuse.gate,
      abuse_failed: abuse.check_summary.failed,
      outbox_gate: outbox.gate,
      outbox_failed: outbox.summary.failed,
    });
  }

  const ordered = samples.map((sample) => sample.elapsed_ms).sort((a, b) => a - b);
  const p95 = ordered[Math.max(0, Math.ceil(ordered.length * 0.95) - 1)];
  const checks = {
    every_round_passed: samples.every((sample) => sample.actor_gate === "PASS"
      && sample.abuse_gate === "PASS_LOCAL" && sample.outbox_gate === "PASS_LOCAL"),
    no_detected_issues: samples.every((sample) => sample.actor_issues === 0
      && sample.abuse_failed === 0 && sample.outbox_failed === 0),
    bounded_round_latency: p95 < 15_000,
  };
  const passed = Object.values(checks).filter(Boolean).length;
  return {
    schema: "NEXUS_BOUNDED_LOCAL_SOAK_V1",
    configuration: { rounds, actors_per_round: actors, abuse_actors_per_round: Math.max(10, Math.ceil(actors / 4)) },
    samples,
    latency: { p95_ms: p95, total_ms: Math.round(performance.now() - started), threshold_ms: 15_000 },
    checks,
    summary: { total: Object.keys(checks).length, passed, failed: Object.keys(checks).length - passed },
    local_mock_only: true,
    network_egress: false,
    real_funds: false,
    incremental_cost: 0,
    production_capacity_claim: "NOT_CLAIMED",
    gate: passed === Object.keys(checks).length ? "PASS_LOCAL" : "FAIL_LOCAL",
  };
}

if (process.argv[1]?.endsWith("local-soak.mjs")) {
  const rounds = process.argv.find((value) => value.startsWith("--rounds="))?.split("=")[1];
  const actors = process.argv.find((value) => value.startsWith("--actors="))?.split("=")[1];
  const report = runLocalSoak({ rounds, actors });
  console.log(JSON.stringify(report, null, 2));
  if (report.gate !== "PASS_LOCAL") process.exitCode = 1;
}
