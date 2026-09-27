import { sha256Hex } from "./security.js";

export const MODERATION_POLICY_VERSION = "nexus-social-safety-2026-08-24.3";
export const CONTENT_PROVENANCE = Object.freeze([
  "NOT_DECLARED",
  "AI_GENERATED",
  "AI_ASSISTED",
  "CAMERA_CAPTURED_DECLARED",
]);
export const REPORT_CATEGORIES = Object.freeze([
  "SCAM_FRAUD",
  "ILLEGAL_GOODS",
  "HARASSMENT_THREAT",
  "HATE",
  "SEXUAL_CONTENT",
  "CHILD_SAFETY",
  "PERSONAL_DATA",
  "MISINFORMATION_CONTEXT",
  "IMPERSONATION",
  "COPYRIGHT",
  // A reader can flag content that is allegedly illegal in their jurisdiction, which is a
  // different legal track from an ordinary policy report. The category is recorded with
  // the same honesty rules: no automatic removal, no pseudo-verdict.
  "ILLEGAL_CONTENT",
]);

const BLOCK_RULES = Object.freeze([
  {
    code: "CREDENTIAL_THEFT_SOLICITATION",
    pattern: /\b(?:send|share|trimite|d[ăa]-?mi)\b.{0,48}\b(?:seed phrase|private key|fraza seed|cheia privat[ăa])\b/iu,
    reason: "Solicitare explicită de secret de portofel",
  },
  {
    code: "DIRECT_VIOLENT_THREAT",
    pattern: /\b(?:i will kill you|te voi omor[iî]|o s[ăa] te omor)\b/iu,
    reason: "Amenințare directă explicită detectată",
  },
  {
    code: "EXPLICIT_ILLEGAL_DRUG_SALE",
    pattern: /(?<![\p{L}\p{M}\p{N}_])(?:v[âa]nd|sell)(?![\p{L}\p{M}\p{N}_])[\s\p{L}\p{M}\p{N}-]{0,64}?(?<![\p{L}\p{M}\p{N}_])(?:cocaine|cocain[ăa]|heroin|fentanyl)(?![\p{L}\p{M}\p{N}_])/iu,
    reason: "Ofertă explicită pentru bunuri ilegale detectată",
  },
]);

const CONTEXT_RULES = Object.freeze([
  { code: "POLITICAL_CONTENT", pattern: /\b(?:politic[ăa]?|election|alegeri|parlament|government|guvern|candidat)\b/iu, reason: "Conținut politic; nu este penalizat pentru punctul de vedere" },
  { code: "NEWS_CLAIM", pattern: /\b(?:breaking(?: news)?|știre|stire|news report|surse(?:le)? spun|sources say)\b/iu, reason: "Afirmație cu aspect de știre" },
  { code: "HEALTH_CLAIM", pattern: /\b(?:vindec[ăa]|cure[sd]?|tratament garantat|miracle treatment|medical advice)\b/iu, reason: "Afirmație de sănătate care poate necesita surse" },
  { code: "FINANCIAL_CLAIM", pattern: /\b(?:profit garantat|guaranteed profit|risk[- ]free return|randament garantat)\b/iu, reason: "Afirmație financiară care poate necesita surse" },
]);

function normalizedText(value) {
  return String(value ?? "").normalize("NFKC").replace(/\s+/g, " ").trim().toLowerCase();
}

function safetyText(value) {
  return normalizedText(value)
    .replace(/[\p{Cf}\u00ad]/gu, "")
    .replace(/[\p{P}\p{S}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function benignSafetyContext(code, normalized) {
  if (code === "CREDENTIAL_THEFT_SOLICITATION") {
    return /^(?:please )?(?:do not|don t|never|nu) (?:ever )?(?:send|share|trimite|da|dă) (?:your |the |a |o )?(?:seed phrase|private key|fraza seed|cheia privat[ăa])(?: (?:with|to|c[ăa]tre) (?:anyone|nimeni|nim[ăa]nui))?$/iu.test(normalized);
  }
  if (code === "DIRECT_VIOLENT_THREAT") {
    return /^(?:quote|quoted|citat|citez|example|exemplu|fiction|fictional|educa[tț]ional) (?:i will kill you|te voi omor[iî]|o s[ăa] te omor) (?:(?:i|we|eu|noi) )?(?:condemn|condamn|report|reported|raportez)(?: (?:this|aceast[ăa]) (?:threat|amenin[tț]are))?$/iu.test(normalized);
  }
  if (code === "EXPLICIT_ILLEGAL_DRUG_SALE") {
    return /^(?:i |eu )?(?:sell|v[âa]nd) (?:a |o )?(?:book|carte|article|articol|documentary|documentar|course|curs) (?:about|despre) (?:cocaine|cocain[ăa]|heroin|fentanyl)(?: (?:policy|politic[ăa]|history|istorie|risks|riscuri|law|legisla[tț]ie))?$/iu.test(normalized);
  }
  return false;
}

export function normalizeProvenance(value) {
  const candidate = String(value ?? "NOT_DECLARED").trim().toUpperCase();
  if (candidate === "USER" || candidate === "UNKNOWN") return "NOT_DECLARED";
  return CONTENT_PROVENANCE.includes(candidate) ? candidate : null;
}

export function assessSocialContent({ text, provenance = "NOT_DECLARED", mediaKind = "text" }) {
  const normalized = normalizedText(text);
  const safetyNormalized = safetyText(text);
  const normalizedProvenance = normalizeProvenance(provenance);
  if (!normalizedProvenance) throw new Error("CONTENT_PROVENANCE_INVALID");
  const matchedBlocking = BLOCK_RULES.filter((rule) => rule.pattern.test(safetyNormalized));
  const blocking = matchedBlocking.filter((rule) => !benignSafetyContext(rule.code, safetyNormalized));
  const contextualSafety = matchedBlocking.filter((rule) => benignSafetyContext(rule.code, safetyNormalized));
  const context = CONTEXT_RULES.filter((rule) => rule.pattern.test(normalized));
  const hasLink = /https?:\/\/[^\s]+/iu.test(normalized);
  const labels = context.map((rule) => ({ code: rule.code, basis: "LOCAL_TEXT_RULE", meaning: rule.reason }));
  for (const rule of contextualSafety) labels.push({
    code: "SAFETY_CONTEXT_" + rule.code,
    basis: "LOCAL_CONTEXT_RULE",
    meaning: "Regula a găsit un citat, avertisment sau context educațional; conținutul nu a fost blocat automat",
  });
  if (normalizedProvenance === "AI_GENERATED" || normalizedProvenance === "AI_ASSISTED") {
    labels.push({ code: normalizedProvenance, basis: "AUTHOR_DECLARATION", meaning: "Declarație a autorului; nu este o verificare independentă" });
  }
  if (hasLink) labels.push({ code: "SOURCE_LINK_PRESENT", basis: "TEXT_STRUCTURE", meaning: "Textul conține un link; sursa nu a fost verificată" });
  if (!hasLink && context.some((rule) => ["NEWS_CLAIM", "HEALTH_CLAIM", "FINANCIAL_CLAIM"].includes(rule.code))) {
    labels.push({ code: "SOURCE_NOT_PROVIDED", basis: "TEXT_STRUCTURE", meaning: "Nu a fost găsit un link către o sursă" });
  }
  for (const rule of blocking) labels.push({ code: rule.code, basis: "LOCAL_TEXT_RULE", meaning: rule.reason });

  const decision = blocking.length ? "BLOCK" : labels.length ? "ALLOW_WITH_CONTEXT" : "ALLOW";
  const riskLevel = blocking.length ? "HIGH" : labels.length ? "CONTEXT" : "LOW";
  const assessment = {
    policyVersion: MODERATION_POLICY_VERSION,
    engine: "LOCAL_DETERMINISTIC_RULES_V1",
    decision,
    riskLevel,
    labels,
    reasons: blocking.length ? blocking.map((rule) => rule.reason) : [...context, ...contextualSafety].map((rule) => rule.reason),
    provenance: {
      status: normalizedProvenance,
      independentlyVerified: false,
    },
    factualStatus: "NOT_FACT_CHECKED",
    visualSafety: mediaKind === "text" ? "NOT_APPLICABLE" : "NOT_ANALYZED_BY_LOCAL_DEMO",
    automatedOnly: true,
    humanVerified: false,
    truthPercentage: null,
  };
  return { ...assessment, assessmentHash: sha256Hex(JSON.stringify(assessment)) };
}

export function publicAssessment(value) {
  if (!value) return null;
  const parse = (raw, fallback) => {
    try { return JSON.parse(raw); } catch { return fallback; }
  };
  return {
    policyVersion: value.policy_version,
    engine: value.engine,
    decision: value.decision,
    riskLevel: value.risk_level,
    labels: parse(value.labels_json, []),
    reasons: parse(value.reasons_json, []),
    provenance: parse(value.provenance_json, { status: "NOT_DECLARED", independentlyVerified: false }),
    factualStatus: value.factual_status,
    visualSafety: value.visual_safety,
    automatedOnly: true,
    humanVerified: false,
    truthPercentage: null,
    assessmentHash: value.assessment_hash,
    authorDisputed: Boolean(value.author_disputed),
    createdAt: value.created_at,
  };
}
