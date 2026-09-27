const VISIBILITY = new Set(["public", "followers", "friends", "private"]);

function gateVisibility(level, context) {
  if (!VISIBILITY.has(level)) return { allow: false, reason: "VISIBILITY_INVALID" };
  if (level === "public") return { allow: true, reason: "PUBLIC" };
  if (level === "followers") return context.follows
    ? { allow: true, reason: "FOLLOWER" }
    : { allow: false, reason: "FOLLOW_REQUIRED" };
  if (level === "friends") return context.mutual
    ? { allow: true, reason: "MUTUAL" }
    : { allow: false, reason: "MUTUAL_REQUIRED" };
  return context.privateEntitlement
    ? { allow: true, reason: "PRIVATE_ENTITLEMENT" }
    : { allow: false, reason: "PRIVATE_ENTITLEMENT_REQUIRED" };
}

export function evaluatePrivacy({
  viewerId,
  viewerPersona,
  ownerId,
  ownerPersona,
  ownerVisibility,
  resourceVisibility,
  resourceStatus = "active",
  blocked = false,
  follows = false,
  mutual = false,
  privateEntitlement = false,
}) {
  const base = { follows: Boolean(follows), mutual: Boolean(mutual), privateEntitlement: Boolean(privateEntitlement) };
  if (!Number.isInteger(Number(viewerId)) || !Number.isInteger(Number(ownerId)) || !viewerPersona || !ownerPersona) return { allow: false, reason: "SUBJECT_INVALID" };
  if (resourceStatus !== "active") return { allow: false, reason: "RESOURCE_INACTIVE" };
  if (viewerPersona !== ownerPersona) return { allow: false, reason: "PERSONA_MISMATCH" };
  if (blocked) return { allow: false, reason: "BLOCKED" };
  if (Number(viewerId) === Number(ownerId)) return { allow: true, reason: "OWNER" };
  const ownerGate = gateVisibility(ownerVisibility, base);
  if (!ownerGate.allow) return { allow: false, reason: `PROFILE_${ownerGate.reason}` };
  const resourceGate = gateVisibility(resourceVisibility, base);
  if (!resourceGate.allow) return { allow: false, reason: `RESOURCE_${resourceGate.reason}` };
  return { allow: true, reason: resourceGate.reason === "PUBLIC" ? ownerGate.reason : resourceGate.reason };
}
