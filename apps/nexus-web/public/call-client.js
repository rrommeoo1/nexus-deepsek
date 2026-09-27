let apiClient = null;
let showToast = () => {};
let currentUserId = () => null;
let currentPersona = () => null;
let session = null;
let incomingTimer = null;
const seenSignals = new Set();
const callMutationKeys = new Map();
const MAX_SEEN_SIGNALS = 512;

export function callCapability() {
  if (globalThis.isSecureContext === false) return { ready: false, reason: "Apelurile necesită HTTPS sau localhost" };
  if (!globalThis.navigator?.mediaDevices?.getUserMedia || !globalThis.RTCPeerConnection) return { ready: false, reason: "WebRTC nu este disponibil în acest browser" };
  return { ready: true, reason: "Local P2P disponibil" };
}

export function configureCallClient({ api, toast, getUserId, getPersona }) {
  apiClient = api;
  showToast = toast;
  currentUserId = getUserId;
  currentPersona = getPersona;
}

function requireConfigured() {
  if (!apiClient || typeof currentUserId !== "function" || typeof currentPersona !== "function") throw new Error("call client is not configured");
}

function callMutationKey(scope) {
  let key = callMutationKeys.get(scope);
  if (!key) {
    key = `nexus-call-${globalThis.crypto.randomUUID()}`;
    if (callMutationKeys.size >= 64) callMutationKeys.delete(callMutationKeys.keys().next().value);
    callMutationKeys.set(scope, key);
  }
  return key;
}

function releaseCallMutationKey(scope, key) {
  if (callMutationKeys.get(scope) === key) callMutationKeys.delete(scope);
}

function isBoundIntent(result, expected) {
  if (!result?.ok || !result.intent || typeof result.intent !== "object" || Array.isArray(result.intent)) return false;
  return Object.entries(expected).every(([key, value]) => result.intent[key] === value);
}

function isSafeCall(call, expected = {}) {
  const viewerId = Number(currentUserId());
  if (!call || typeof call !== "object" || Array.isArray(call)
    || !/^call:[A-Za-z0-9_-]{16,64}$/.test(String(call.call_id || ""))
    || !Number.isSafeInteger(Number(call.conversation_id)) || Number(call.conversation_id) <= 0
    || !Number.isSafeInteger(Number(call.initiated_by)) || Number(call.initiated_by) <= 0
    || !new Set(["audio", "video"]).has(call.mode)
    || !new Set(["ringing", "active", "declined", "ended", "missed", "failed"]).has(call.status)
    || call.context_persona !== currentPersona()
    || !Array.isArray(call.participants) || call.participants.length !== 2
    || !call.participants.every((participant) => Number.isSafeInteger(Number(participant?.id)) && Number(participant.id) > 0 && typeof participant.handle === "string")
    || new Set(call.participants.map((participant) => Number(participant.id))).size !== 2
    || !call.participants.some((participant) => Number(participant.id) === Number(call.initiated_by))
    || !call.participants.some((participant) => Number(participant.id) === viewerId)) return false;
  return Object.entries(expected).every(([key, value]) => key === "status"
    ? (Array.isArray(value) ? value.includes(call.status) : call.status === value)
    : (key.endsWith("_id") || key === "initiated_by" ? Number(call[key]) === Number(value) : call[key] === value));
}

function otherParticipant(call) {
  return call.participants?.find((participant) => participant.id !== currentUserId());
}

function removeCallUi() {
  clearTimeout(incomingTimer);
  incomingTimer = null;
  document.getElementById("nexus-call-layer")?.remove();
}

function stopLocalMedia() {
  clearTimeout(session?.ringTimer);
  clearTimeout(session?.heartbeatTimer);
  session?.localStream?.getTracks().forEach((track) => track.stop());
  try { session?.pc?.close(); } catch { /* Peer may already be closed. */ }
  session = null;
  seenSignals.clear();
  removeCallUi();
}
globalThis.addEventListener?.("pagehide", stopLocalMedia);

function callLayer() {
  removeCallUi();
  const layer = document.createElement("div");
  layer.id = "nexus-call-layer";
  layer.className = "callLayer";
  document.body.appendChild(layer);
  return layer;
}

function renderIncoming(call) {
  if (!isSafeCall(call, { status: "ringing" }) || Number(call.initiated_by) === Number(currentUserId())) return;
  const layer = callLayer();
  const peer = otherParticipant(call);
  const capability = callCapability();
  layer.innerHTML = '<section class="incomingCall" role="dialog" aria-modal="true" aria-labelledby="incoming-call-title"><small>APEL ' + (call.mode === "video" ? "VIDEO" : "AUDIO") + ' · LOCAL P2P</small><div class="callAvatar" aria-hidden="true">' + escapeCallText(String(peer?.display_name || peer?.handle || "N").slice(0, 2).toUpperCase()) + '</div><h3 id="incoming-call-title">' + escapeCallText(peer?.display_name || "Apel Nexus") + '</h3><p>@' + escapeCallText(peer?.handle || "nexus") + ' te apelează</p><span>' + escapeCallText(capability.ready ? "Media criptată DTLS-SRTP · fără relay" : capability.reason) + '</span><div><button id="decline-call" class="declineCall" data-modal-close type="button" aria-label="Refuză apelul">×</button><button id="accept-call" class="acceptCall" type="button" aria-label="Acceptă apelul"' + (capability.ready ? "" : " disabled") + '>✓</button></div></section>';
  const remainingMs = Math.max(0, Number(call.expires_at) * 1000 - Date.now());
  incomingTimer = setTimeout(() => { removeCallUi(); showToast("Apel nepreluat"); }, remainingMs + 250);
  document.getElementById("decline-call").onclick = async () => {
    const actorId = Number(currentUserId());
    const actorPersona = currentPersona();
    const scope = `decision:${call.call_id}:decline`;
    const key = callMutationKey(scope);
    const result = await apiClient(`/api/chat/calls/${call.call_id}/decision`, {
      method: "POST", headers: { "Idempotency-Key": key }, body: { decision: "decline" },
    }).catch(() => null);
    if (!isBoundIntent(result, { call_id: call.call_id, conversation_id: Number(call.conversation_id), actor_id: actorId, actor_persona: actorPersona, decision: "decline" })
      || !isSafeCall(result.call, { call_id: call.call_id, conversation_id: call.conversation_id, status: "declined" })) {
      showToast("Apelul nu a putut fi refuzat");
      return;
    }
    releaseCallMutationKey(scope, key);
    removeCallUi();
  };
  document.getElementById("accept-call").onclick = () => acceptIncoming(call);
}

function renderActiveCall(call, localStream, role) {
  const layer = callLayer();
  const peer = otherParticipant(call);
  layer.innerHTML = '<section class="activeCall" role="dialog" aria-modal="true" aria-labelledby="active-call-title"><header><span><small>LOCAL P2P · FĂRĂ TURN/SFU</small><h3 id="active-call-title">' + escapeCallText(peer?.display_name || peer?.handle || "Apel Nexus") + '</h3></span><em id="call-status" role="status" aria-live="polite">' + (role === "caller" ? "Aștept răspuns…" : "Conectez…") + '</em></header><div class="callVideoStage"><video id="remote-call-video" aria-label="Video participant" autoplay playsinline></video><video id="local-call-video" aria-label="Previzualizarea camerei tale" autoplay muted playsinline></video><div class="audioOnlyBadge"' + (call.mode === "audio" ? "" : " hidden") + '>◉ Apel audio</div></div><div class="callControls"><button id="toggle-call-mic" type="button" aria-pressed="false">🎙<span>Microfon</span></button><button id="toggle-call-camera" type="button" aria-pressed="false"' + (call.mode === "audio" ? " disabled" : "") + '>▣<span>Cameră</span></button><button id="end-call" class="endCall" data-modal-close type="button" aria-label="Închide apelul">×<span>Închide</span></button></div><p>WebRTC DTLS-SRTP · semnalizare prin Nexus · numai candidați locali în această versiune</p></section>';
  const localVideo = document.getElementById("local-call-video");
  localVideo.srcObject = localStream;
  if (call.mode === "audio") localVideo.hidden = true;
  document.getElementById("toggle-call-mic").onclick = (event) => toggleTrack(localStream, "audio", event.currentTarget);
  document.getElementById("toggle-call-camera").onclick = (event) => toggleTrack(localStream, "video", event.currentTarget);
  document.getElementById("end-call").onclick = () => endCurrentCall(true);
}

function toggleTrack(stream, kind, button) {
  const tracks = stream.getTracks().filter((track) => track.kind === kind);
  if (!tracks.length) return;
  const enabled = !tracks[0].enabled;
  tracks.forEach((track) => { track.enabled = enabled; });
  button.setAttribute("aria-pressed", String(!enabled));
  button.classList.toggle("off", !enabled);
}

async function acquireMedia(mode) {
  const capability = callCapability();
  if (!capability.ready) throw new Error(capability.reason);
  return globalThis.navigator.mediaDevices.getUserMedia({ audio: true, video: mode === "video" });
}

function setCallStatus(text) {
  const element = document.getElementById("call-status");
  if (element) element.textContent = text;
}

async function renewCallLease() {
  if (!session) return;
  const currentSession = session;
  const call = currentSession.call;
  const actorId = Number(currentUserId());
  const actorPersona = currentPersona();
  const leaseNonce = `lease:${globalThis.crypto.randomUUID()}`;
  const scope = `lease:${call.call_id}:${leaseNonce}`;
  const key = callMutationKey(scope);
  const result = await apiClient(`/api/chat/calls/${call.call_id}/heartbeat`, {
    method: "POST", headers: { "Idempotency-Key": key }, body: { lease_nonce: leaseNonce },
  }).catch(() => null);
  if (session !== currentSession || Number(currentUserId()) !== actorId || currentPersona() !== actorPersona) return;
  const nowSeconds = Math.floor(Date.now() / 1000);
  const valid = isBoundIntent(result, {
    call_id: call.call_id, conversation_id: Number(call.conversation_id), actor_id: actorId,
    actor_persona: actorPersona, lease_nonce: leaseNonce,
  }) && isSafeCall(result.call, { call_id: call.call_id, conversation_id: call.conversation_id, status: ["ringing", "active"] })
    && Number(result.lease_seconds) === 25 && Number.isInteger(Number(result.lease_until))
    && Number(result.lease_until) > nowSeconds && Number(result.lease_until) <= nowSeconds + 30;
  if (valid) {
    releaseCallMutationKey(scope, key);
    currentSession.heartbeatFailures = 0;
    currentSession.call = result.call;
  } else {
    currentSession.heartbeatFailures = Number(currentSession.heartbeatFailures || 0) + 1;
    if (currentSession.heartbeatFailures >= 2) {
      showToast("Conexiunea apelului s-a pierdut");
      stopLocalMedia();
      return;
    }
  }
  if (session === currentSession) currentSession.heartbeatTimer = setTimeout(renewCallLease, 8000);
}

function startCallLease() {
  if (!session) return;
  clearTimeout(session.heartbeatTimer);
  session.heartbeatTimer = setTimeout(renewCallLease, 0);
}

async function makePeer(call, localStream, role) {
  if (!isSafeCall(call, { status: ["ringing", "active"] })) throw new Error("Starea apelului nu este validă");
  seenSignals.clear();
  const pc = new globalThis.RTCPeerConnection({ iceServers: [] });
  localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));
  pc.ontrack = (event) => {
    const remote = document.getElementById("remote-call-video");
    if (remote && event.streams[0]) remote.srcObject = event.streams[0];
  };
  pc.onicecandidate = (event) => {
    if (event.candidate) sendSignal("ice", event.candidate.toJSON());
  };
  pc.onconnectionstatechange = () => {
    const labels = { connecting: "Conectez…", connected: "Conectat", disconnected: "Conexiune întreruptă", failed: "Conexiune eșuată", closed: "Apel închis" };
    setCallStatus(labels[pc.connectionState] || pc.connectionState);
    if (pc.connectionState === "failed") endCurrentCall(true);
  };
  session = { call, localStream, pc, role, pendingIce: [], offerSent: false, ringTimer: null, heartbeatTimer: null, heartbeatFailures: 0 };
  if (role === "caller") startCallLease();
  if (role === "caller" && call.status === "ringing") {
    const remainingMs = Math.max(0, Number(call.expires_at) * 1000 - Date.now());
    session.ringTimer = setTimeout(async () => {
      const current = await apiClient(`/api/chat/calls/${call.call_id}`);
      if (current?.ok && current.query?.call_id === call.call_id
        && Number(current.query.viewer_id) === Number(currentUserId()) && current.query.viewer_persona === currentPersona()
        && isSafeCall(current.call, { call_id: call.call_id, conversation_id: call.conversation_id })) await handleCallState({ call: current.call });
      else stopLocalMedia();
    }, remainingMs + 250);
  }
  return pc;
}

async function sendSignal(type, payload) {
  if (!session) return;
  const call = session.call;
  const actorId = Number(currentUserId());
  const actorPersona = currentPersona();
  const signalNonce = `signal:${globalThis.crypto.randomUUID()}`;
  const body = { type, signal_nonce: signalNonce, payload };
  for (let attempt = 0; attempt < 3; attempt++) {
    if (!session || session.call.call_id !== call.call_id || Number(currentUserId()) !== actorId || currentPersona() !== actorPersona) throw new Error("Contextul apelului s-a schimbat");
    const scope = `signal:${call.call_id}:${signalNonce}`;
    const key = callMutationKey(scope);
    const result = await apiClient(`/api/chat/calls/${call.call_id}/signal`, {
      method: "POST",
      headers: { "Idempotency-Key": key },
      body,
    }).catch(() => null);
    const bound = isBoundIntent(result, { call_id: call.call_id, conversation_id: Number(call.conversation_id), actor_id: actorId, actor_persona: actorPersona, signal_nonce: signalNonce, type })
      && typeof result.replay === "boolean" && typeof result.delivered === "boolean"
      && result.payload_persisted === false && result.replay_guard === "durable_hash_only";
    if (!bound) {
      if (attempt < 2 && result?.retryable) { await new Promise((resolve) => setTimeout(resolve, 5100)); continue; }
      throw new Error("Semnalizarea apelului a eșuat");
    }
    if (result.delivered) {
      releaseCallMutationKey(scope, key);
      return;
    }
    if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 5100));
  }
  throw new Error("Destinatarul nu este conectat la profilul acestui apel");
}

async function sendOffer() {
  if (!session || session.role !== "caller" || session.offerSent) return;
  session.offerSent = true;
  const offer = await session.pc.createOffer();
  await session.pc.setLocalDescription(offer);
  await sendSignal("offer", { type: offer.type, sdp: offer.sdp });
  setCallStatus("Sună…");
}

async function flushIce() {
  if (!session?.pc.remoteDescription) return;
  const pending = session.pendingIce.splice(0);
  for (const candidate of pending) await session.pc.addIceCandidate(candidate);
}

async function acceptIncoming(call) {
  try {
    const actorId = Number(currentUserId());
    const actorPersona = currentPersona();
    if (!isSafeCall(call, { status: "ringing" }) || Number(call.initiated_by) === actorId) throw new Error("Invitația apelului nu este validă");
    const localStream = await acquireMedia(call.mode);
    if (Number(currentUserId()) !== actorId || currentPersona() !== actorPersona) {
      localStream.getTracks().forEach((track) => track.stop());
      throw new Error("Profilul activ s-a schimbat");
    }
    renderActiveCall(call, localStream, "callee");
    await makePeer(call, localStream, "callee");
    const scope = `decision:${call.call_id}:accept`;
    const key = callMutationKey(scope);
    const accepted = await apiClient(`/api/chat/calls/${call.call_id}/decision`, {
      method: "POST", headers: { "Idempotency-Key": key }, body: { decision: "accept" },
    }).catch(() => null);
    if (!isBoundIntent(accepted, { call_id: call.call_id, conversation_id: Number(call.conversation_id), actor_id: actorId, actor_persona: actorPersona, decision: "accept" })
      || !isSafeCall(accepted.call, { call_id: call.call_id, conversation_id: call.conversation_id, status: "active" })) throw new Error("Apelul nu mai este disponibil");
    releaseCallMutationKey(scope, key);
    session.call = accepted.call;
    startCallLease();
  } catch (error) {
    stopLocalMedia();
    showToast(error.message || "Camera sau microfonul nu sunt disponibile");
  }
}

export async function startDirectCall({ conversationId, mode }) {
  requireConfigured();
  if (session) return showToast("Există deja un apel activ");
  try {
    conversationId = Number(conversationId);
    const actorId = Number(currentUserId());
    const actorPersona = currentPersona();
    if (!Number.isSafeInteger(conversationId) || conversationId <= 0 || !new Set(["audio", "video"]).has(mode) || !Number.isSafeInteger(actorId) || !actorPersona) {
      throw new Error("Cererea apelului nu este validă");
    }
    const localStream = await acquireMedia(mode);
    if (Number(currentUserId()) !== actorId || currentPersona() !== actorPersona) {
      localStream.getTracks().forEach((track) => track.stop());
      throw new Error("Profilul activ s-a schimbat");
    }
    const scope = `start:${conversationId}:${mode}`;
    const key = callMutationKey(scope);
    const started = await apiClient(`/api/chat/conversations/${conversationId}/calls`, {
      method: "POST", headers: { "Idempotency-Key": key }, body: { mode },
    }).catch(() => null);
    const validStart = isBoundIntent(started, { conversation_id: conversationId, actor_id: actorId, actor_persona: actorPersona, mode })
      && isSafeCall(started?.call, { conversation_id: conversationId, initiated_by: actorId, mode, status: "ringing" })
      && started?.transport?.media === "webrtc_dtls_srtp" && started.transport.relay === "none"
      && started.transport.topology === "local_p2p" && started.transport.secure_context_required === true;
    if (!validStart) {
      localStream.getTracks().forEach((track) => track.stop());
      throw new Error("Apelul nu a putut fi pornit");
    }
    releaseCallMutationKey(scope, key);
    renderActiveCall(started.call, localStream, "caller");
    await makePeer(started.call, localStream, "caller");
    const current = await apiClient(`/api/chat/calls/${started.call.call_id}`);
    if (current?.ok && current.query?.call_id === started.call.call_id
      && Number(current.query.viewer_id) === actorId && current.query.viewer_persona === actorPersona
      && isSafeCall(current.call, { call_id: started.call.call_id, conversation_id: conversationId, status: "active" })) {
      session.call = current.call;
      await sendOffer();
    }
  } catch (error) {
    stopLocalMedia();
    showToast(error.message || "Apelul nu a putut fi pornit");
  }
}

export async function handleCallInvite(payload) {
  if (!isSafeCall(payload?.call, { status: "ringing" }) || Number(payload.call.initiated_by) === Number(currentUserId())) return;
  if (session) return;
  renderIncoming(payload.call);
}

export async function handleCallState(payload) {
  const call = payload?.call;
  if (!isSafeCall(call)) return;
  if (!session || session.call.call_id !== call.call_id) {
    if (call.status === "ringing" && call.initiated_by !== currentUserId()) renderIncoming(call);
    return;
  }
  session.call = call;
  if (call.status === "active" && session.role === "caller") {
    clearTimeout(session.ringTimer);
    session.ringTimer = null;
    try { await sendOffer(); } catch (error) { showToast(error.message); await endCurrentCall(true); }
    return;
  }
  if (new Set(["declined", "ended", "missed", "failed"]).has(call.status)) {
    showToast(call.status === "declined" ? "Apel refuzat" : call.status === "missed" ? "Apel nepreluat" : "Apel închis");
    stopLocalMedia();
  }
}

export async function handleCallSignal(payload) {
  const allowedSignal = session && payload && typeof payload === "object" && !Array.isArray(payload)
    && payload.call_id === session.call.call_id && Number(payload.conversation_id) === Number(session.call.conversation_id)
    && Number(payload.from_user_id) !== Number(currentUserId()) && session.call.participants.some((participant) => Number(participant.id) === Number(payload.from_user_id))
    && /^[A-Za-z0-9:_-]{8,80}$/.test(String(payload.signal_nonce || ""))
    && new Set(["offer", "answer", "ice"]).has(payload.type) && payload.payload && typeof payload.payload === "object" && !Array.isArray(payload.payload);
  if (!allowedSignal || seenSignals.has(payload.signal_nonce)) return;
  seenSignals.add(payload.signal_nonce);
  if (seenSignals.size > MAX_SEEN_SIGNALS) {
    const oldestSignalNonce = seenSignals.values().next().value;
    seenSignals.delete(oldestSignalNonce);
  }
  try {
    if (payload.type === "offer" && session.role === "callee") {
      await session.pc.setRemoteDescription(payload.payload);
      await flushIce();
      const answer = await session.pc.createAnswer();
      await session.pc.setLocalDescription(answer);
      await sendSignal("answer", { type: answer.type, sdp: answer.sdp });
    } else if (payload.type === "answer" && session.role === "caller") {
      await session.pc.setRemoteDescription(payload.payload);
      await flushIce();
    } else if (payload.type === "ice") {
      if (session.pc.remoteDescription) await session.pc.addIceCandidate(payload.payload);
      else session.pendingIce.push(payload.payload);
    }
  } catch {
    showToast("Semnalizarea apelului a fost refuzată");
    await endCurrentCall(true);
  }
}

export async function endCurrentCall(notifyServer = false) {
  const call = session?.call;
  const callId = call?.call_id;
  const actorId = Number(currentUserId());
  const actorPersona = currentPersona();
  stopLocalMedia();
  if (notifyServer && callId && isSafeCall(call)) {
    const scope = `end:${callId}`;
    const key = callMutationKey(scope);
    const result = await apiClient(`/api/chat/calls/${callId}/end`, {
      method: "POST", headers: { "Idempotency-Key": key }, body: {},
    }).catch(() => null);
    if (isBoundIntent(result, { call_id: callId, conversation_id: Number(call.conversation_id), actor_id: actorId, actor_persona: actorPersona, action: "end" })
      && isSafeCall(result.call, { call_id: callId, conversation_id: call.conversation_id, status: "ended" })) releaseCallMutationKey(scope, key);
  }
}

export async function restoreCurrentCalls() {
  requireConfigured();
  const result = await apiClient("/api/chat/calls/current");
  if (!result?.ok || Number(result.query?.viewer_id) !== Number(currentUserId()) || result.query?.viewer_persona !== currentPersona()
    || !Array.isArray(result.calls) || result.calls.length > 10 || !result.calls.every((call) => isSafeCall(call, { status: ["ringing", "active"] }))) return;
  for (const call of result.calls) {
    if (call.status === "active" || (call.status === "ringing" && Number(call.initiated_by) === Number(currentUserId()))) {
      const scope = `end:${call.call_id}`;
      const key = callMutationKey(scope);
      const ended = await apiClient(`/api/chat/calls/${call.call_id}/end`, { method: "POST", headers: { "Idempotency-Key": key }, body: {} }).catch(() => null);
      if (isBoundIntent(ended, { call_id: call.call_id, conversation_id: Number(call.conversation_id), actor_id: Number(currentUserId()), actor_persona: currentPersona(), action: "end" })
        && isSafeCall(ended.call, { call_id: call.call_id, conversation_id: call.conversation_id, status: "ended" })) releaseCallMutationKey(scope, key);
    }
    else if (call.status === "ringing" && call.initiated_by !== currentUserId()) renderIncoming(call);
  }
}

function escapeCallText(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}
