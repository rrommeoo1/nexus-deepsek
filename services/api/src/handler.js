// Minimal HTTP-style handler for the core API. Returns JSON responses; no
// framework, no network, no secrets. Used by the deterministic tests to prove
// the request → authorization → response chain.

import { canAccess, normalizePersona } from "./identity.js";

function json(status, payload) {
  return { status, body: JSON.stringify(payload), headers: { "content-type": "application/json" } };
}

function badRequest(message) {
  return json(400, { ok: false, error: message });
}

function unauthorized(message = "unauthorized") {
  return json(401, { ok: false, error: message });
}

// `context` is a plain verified session object:
//   { authenticated: boolean, id: string, persona: string }
// It is produced by the (future) auth layer; this packet only consumes it.
export function createMeHandler({ users, profiles }) {
  return function me(context) {
    if (!context || context.authenticated !== true) return unauthorized();
    if (typeof context.id !== "string" || !users.get(context.id)) {
      return unauthorized("unknown identity");
    }

    const persona = normalizePersona(context.persona);
    if (!persona) return badRequest("invalid persona");

    const resource = { ownerId: context.id, persona };
    if (!canAccess(resource, { ...context, persona })) {
      return unauthorized("persona out of scope");
    }

    const user = users.get(context.id);
    const profile = profiles.get(`${context.id}:${persona}`) ?? null;
    return json(200, {
      ok: true,
      identity: { id: user.id, handle: user.handle },
      persona,
      profile: profile ?? { persona, name: user.handle, bio: "" },
    });
  };
}