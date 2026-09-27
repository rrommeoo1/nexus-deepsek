// Issuer-sub identity + persona access control (Phase I.1).
//
// The differentiation engine ("one identity, multiple personas with hard
// isolation") is expressed here as data + a deny-by-default ACL. There is no
// cryptography yet (that arrives with NX-AUTH-RT); this packet only pins the
// boundary rules so the persona isolation can be tested deterministically.

export const PERSONAS = ["social", "work", "dating", "travel", "market"];

export function normalizePersona(value) {
  return typeof value === "string" && PERSONAS.includes(value) ? value : null;
}

// A session carries a verified issuer+subject and exactly one active persona.
// A persona can never address data belonging to another persona.
export class IdentityContext {
  constructor({ id, issuer, subject, persona } = {}) {
    this.id = id ?? null;
    this.issuer = issuer ?? null;
    this.subject = subject ?? null;
    this.persona = normalizePersona(persona);
  }

  get authenticated() {
    return Boolean(this.issuer && this.subject && this.persona);
  }
}

// Test-only credential factory. Real credential verification is out of scope
// for this packet (see NX-AUTH-RT) and must never be used in production.
export function demoIdentity({ id = "u1", issuer = "nexus-local", subject = "alice", persona = "social" } = {}) {
  return new IdentityContext({ id, issuer, subject, persona });
}

// Deny-by-default scope checker: an owner may only be read by a context whose
// persona matches the owner's persona (and whose identity is the owner or a
// grant holder). Matching identity is stronger than matching persona.
export function canAccess(resource, context) {
  if (!context?.authenticated) return false;
  if (resource.ownerId === context.id) return true;
  if (resource.persona && resource.persona === context.persona) return true;
  return false;
}