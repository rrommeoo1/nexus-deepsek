#!/usr/bin/env node
/**
 * What the DNS of a sending domain actually says — asked of the real resolver, never assumed.
 *
 * This tool exists because a claim like "SPF, DKIM and DMARC are configured" must be a measurement.
 * It performs read-only DNS lookups (no cost, no credentials), prints what came back, and separates
 * three states for every record:
 *
 *   FOUND     a record of that kind exists, and its text is printed verbatim
 *   MISSING   the resolver answered "no such record" (NXDOMAIN / NODATA)
 *   UNKNOWN   the lookup itself failed (timeout, no network) — never reported as MISSING
 *
 * It does not know your provider's DKIM selector, so it probes a short list and says which selectors
 * it probed. Whatever the provider's dashboard shows is authoritative; this only confirms it.
 *
 *   node tools/email/check-dns.mjs --domain example.com [--selector resend] [--selector s1]
 */
import { resolve4, resolveMx, resolveTxt } from "node:dns/promises";

const args = process.argv.slice(2);
function values(name) {
  const out = [];
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === `--${name}` && args[index + 1]) out.push(args[index + 1]);
    else if (args[index].startsWith(`--${name}=`)) out.push(args[index].slice(name.length + 3));
  }
  return out;
}

const domain = String(values("domain")[0] ?? "").trim().toLowerCase();
const selectors = values("selector").length
  ? values("selector")
  : ["resend", "brevo", "mail", "default", "s1"];
const json = args.includes("--json");

if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) {
  console.error("utilizare: node tools/email/check-dns.mjs --domain <domeniu> [--selector <nume>] [--json]");
  console.error("exemplu: node tools/email/check-dns.mjs --domain exemplu.ro --selector resend");
  process.exit(1);
}

function flatten(records) {
  return (records ?? []).map((chunks) => (Array.isArray(chunks) ? chunks.join("") : String(chunks)));
}

async function lookup(name, kind) {
  try {
    const records = kind === "MX" ? await resolveMx(name) : kind === "A" ? await resolve4(name) : flatten(await resolveTxt(name));
    return { state: records.length ? "FOUND" : "MISSING", records, name, kind };
  } catch (error) {
    const code = String(error?.code ?? "");
    if (code === "ENOTFOUND" || code === "ENODATA") return { state: "MISSING", records: [], name, kind, reason: code };
    return { state: "UNKNOWN", records: [], name, kind, reason: code || String(error?.message ?? "eroare DNS") };
  }
}

const findings = [];
findings.push(await lookup(domain, "MX"));
const apexTxt = await lookup(domain, "TXT");
findings.push(apexTxt);
findings.push(await lookup(`_dmarc.${domain}`, "TXT"));
for (const selector of selectors) findings.push(await lookup(`${selector}._domainkey.${domain}`, "TXT"));

const spf = apexTxt.records.find((record) => /^v=spf1\b/i.test(record)) ?? "";
const dmarc = findings.filter((entry) => entry.name === `_dmarc.${domain}`).flatMap((entry) => entry.records)
  .find((record) => /^v=DMARC1\b/i.test(record)) ?? "";
const dkim = findings.filter((entry) => entry.name.endsWith("._domainkey." + domain))
  .filter((entry) => entry.state === "FOUND" && entry.records.some((record) => /v=DKIM1|(?:^|;)\s*p=/i.test(record)));

const summary = {
  domain,
  checked_at: new Date().toISOString(),
  mx: findings[0],
  spf: { present: Boolean(spf), record: spf },
  dmarc: { present: Boolean(dmarc), record: dmarc },
  dkim: {
    present: dkim.length > 0,
    selectors_probed: selectors,
    selectors_found: dkim.map((entry) => entry.name.split("._domainkey.")[0]),
  },
  verdict: {
    mx_resolves: findings[0].state === "FOUND",
    spf: spf ? "FOUND" : (apexTxt.state === "UNKNOWN" ? "UNKNOWN" : "MISSING"),
    dmarc: dmarc ? "FOUND" : (findings.find((entry) => entry.name === `_dmarc.${domain}`)?.state === "UNKNOWN" ? "UNKNOWN" : "MISSING"),
    dkim: dkim.length ? "FOUND" : (findings.some((entry) => entry.state === "UNKNOWN") ? "UNKNOWN" : "MISSING"),
  },
};

if (json) {
  console.log(JSON.stringify({ ...summary, findings }, null, 2));
} else {
  console.log(`Domeniu: ${domain} (interogat ${summary.checked_at})`);
  console.log("");
  for (const entry of findings) {
    const label = `${entry.name} ${entry.kind}`.padEnd(46);
    if (entry.state === "FOUND") {
      for (const [index, record] of entry.records.entries()) {
        const value = typeof record === "object" ? `${record.exchange} (priority ${record.priority})` : record;
        console.log(`${index === 0 ? label : " ".repeat(label.length)} ${entry.state.padEnd(8)} ${value}`);
      }
    } else {
      console.log(`${label} ${entry.state.padEnd(8)} ${entry.reason ?? ""}`);
    }
  }
  console.log("");
  console.log(`SPF:   ${summary.verdict.spf}${spf ? " → " + spf : ""}`);
  console.log(`DKIM:  ${summary.verdict.dkim}${dkim.length ? " → selector(i): " + summary.dkim.selectors_found.join(", ") : ""}`);
  console.log(`DMARC: ${summary.verdict.dmarc}${dmarc ? " → " + dmarc : ""}`);
  console.log("");
  console.log("UNKNOWN înseamnă că interogarea a eșuat, nu că înregistrarea lipsește.");
  console.log("Valorile le publică providerul de email în dashboard; acest tool doar confirmă ce răspunde DNS-ul.");
}

process.exitCode = summary.verdict.spf === "FOUND" && summary.verdict.dkim === "FOUND" && summary.verdict.dmarc === "FOUND"
  ? 0
  : (Object.values(summary.verdict).some((value) => value === "UNKNOWN") ? 3 : 2);
