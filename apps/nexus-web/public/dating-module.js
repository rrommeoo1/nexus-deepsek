let datingView = "discover";
let datingEpoch = 0;

const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
const mutationKey = (scope) => `${scope}:${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`}`;
const formatDate = (seconds) => new Date(Number(seconds) * 1000).toLocaleString();
const labels = {
  woman: "Femeie", man: "Bărbat", nonbinary: "Non-binar", self_described: "Autodescris", private: "Privat",
  long_term: "Relație de lungă durată", partnership: "Parteneriat", slow_dating: "Slow dating", casual: "Dating casual",
  friendship: "Prietenie", non_monogamy: "Non-monogamie etică", exploring: "Încă explorez",
  same_intention: "Aceeași intenție", shared_interests: "Interese comune", same_city_bucket: "Aceeași zonă urbană",
};

function valid(result, deps) {
  return result?.ok === true && Number(result.viewer_id) === Number(deps.state.user.id) && result.viewer_persona === "dating";
}

function shell(vp, deps, content = '<div class="datingLoading">Se încarcă…</div>') {
  vp.innerHTML = `<div class="screen scrollScreen datingWorkspace">
    <header class="datingHero"><span><small>COMPATIBILITY · CONSENT · SAFETY</small><h2>Nexus Dating</h2><p>Selecție mutuală, identitate separată și întâlniri mai sigure.</p></span><i>♥</i></header>
    <aside class="datingTruth"><b>Fără scor de atractivitate</b><span>Like-urile sunt private. Un match apare numai după alegere reciprocă.</span></aside>
    <nav class="datingTabs" aria-label="Nexus Dating">
      ${[["discover","Descoperă"],["profile","Profil"],["matches","Conexiuni"],["safety","Siguranță"]].map(([id,label]) => `<button type="button" data-dating-view="${id}" class="${datingView === id ? "active" : ""}">${label}</button>`).join("")}
    </nav><main id="dating-content" aria-live="polite">${content}</main></div>`;
  vp.querySelectorAll("[data-dating-view]").forEach((button) => button.addEventListener("click", () => { datingView = button.dataset.datingView; renderDatingWorkspace(vp, deps); }));
}

function candidateCard(candidate) {
  const reasons = candidate.compatibility_reasons.map((reason) => `<span>${esc(labels[reason] || reason)}</span>`).join("");
  return `<article class="datingCandidate" data-candidate="${candidate.user_id}">
    <div class="datingPortrait"><i>${esc(candidate.display_name.slice(0, 1).toUpperCase())}</i><small>Imaginea Dating rămâne separată</small></div>
    <div class="datingCandidateInfo"><header><span><h3>${esc(candidate.display_name)}, ${candidate.age}</h3><small>@${esc(candidate.handle)} · ${esc(candidate.city_bucket || "zonă nedeclarată")}</small></span><em>${esc(labels[candidate.intention] || candidate.intention)}</em></header>
    <p>${esc(candidate.bio || "Profil fără descriere")}</p><div class="datingChips">${candidate.interests.slice(0, 5).map((item) => `<span>${esc(item)}</span>`).join("")}</div>
    <section class="datingPassport"><b>Trust Passport</b><span>18+ declarat local</span><span>Foto: ${esc(candidate.trust_passport.photo_verification)}</span><span>Întâlniri: dovezi insuficiente</span></section>
    <div class="datingReasons">${reasons || "Compatibilitate mutuală de bază"}</div>
    <footer><button type="button" data-dating-decision="pass">Treci</button><button type="button" class="like" data-dating-decision="like">Îmi place</button></footer></div>
  </article>`;
}

async function renderDiscovery(vp, deps, epoch) {
  const host = vp.querySelector("#dating-content");
  const result = await deps.api("/api/dating/discovery").catch(() => null);
  if (epoch !== datingEpoch || !valid(result, deps) || result.policy !== "MUTUAL_ELIGIBILITY_NO_DESIRABILITY_SCORE") return void (host.innerHTML = '<div class="datingError">Discovery nu a trecut verificarea de privacy.</div>');
  host.innerHTML = result.candidates.length ? `<div class="datingDeck">${result.candidates.map(candidateCard).join("")}</div>` : `<section class="datingEmpty"><i>◇</i><h3>Nicio recomandare eligibilă acum</h3><p>Completează profilul și activează discovery. Actorii sintetici și profilurile incompatibile nu sunt afișate.</p><button type="button" data-go-profile>Configurează profilul</button></section>`;
  host.querySelector("[data-go-profile]")?.addEventListener("click", () => { datingView = "profile"; renderDatingWorkspace(vp, deps); });
  host.querySelectorAll("[data-dating-decision]").forEach((button) => button.addEventListener("click", async () => {
    const card = button.closest("[data-candidate]");
    const response = await deps.api("/api/dating/decisions", { method: "POST", headers: { "Idempotency-Key": mutationKey("dating-decision") }, body: { target_user_id: Number(card.dataset.candidate), action: button.dataset.datingDecision } });
    if (!response.ok || Number(response.actor_id) !== Number(deps.state.user.id) || response.actor_persona !== "dating") return deps.toast(response.error || "Alegerea nu a fost salvată");
    deps.toast(response.match ? "Este match — conversația Dating este pregătită" : "Alegere salvată privat");
    renderDatingWorkspace(vp, deps);
  }));
}

async function renderProfile(vp, deps, epoch) {
  const host = vp.querySelector("#dating-content"), result = await deps.api("/api/dating/profile").catch(() => null);
  if (epoch !== datingEpoch || !valid(result, deps) || result.privacy !== "DATING_ONLY") return void (host.innerHTML = '<div class="datingError">Profilul Dating nu a putut fi verificat.</div>');
  const profile = result.profile || {};
  host.innerHTML = `<form id="dating-profile-form" class="datingForm"><header><span><small>IDENTITATE INDEPENDENTĂ</small><h3>Profilul meu Dating</h3></span><b>18+</b></header>
    <label>Nume afișat<input name="display_name" maxlength="60" value="${esc(profile.display_name || "")}" required></label>
    <div class="datingGrid"><label>Vârsta<input name="age" type="number" min="18" max="99" value="${esc(profile.age || "")}" required></label>
    <label>Identitate<select name="gender">${["woman","man","nonbinary","self_described","private"].map((id) => `<option value="${id}" ${profile.gender === id ? "selected" : ""}>${labels[id]}</option>`).join("")}</select></label>
    <label>Caut<select name="seeking" multiple size="4">${["woman","man","nonbinary","self_described"].map((id) => `<option value="${id}" ${profile.seeking?.includes(id) ? "selected" : ""}>${labels[id]}</option>`).join("")}</select></label>
    <label>Intenție<select name="intention">${["long_term","partnership","slow_dating","casual","friendship","non_monogamy","exploring"].map((id) => `<option value="${id}" ${profile.intention === id ? "selected" : ""}>${labels[id]}</option>`).join("")}</select></label></div>
    <label>Oraș / zonă aproximativă<input name="city_bucket" maxlength="80" value="${esc(profile.city_bucket || "")}" placeholder="ex. Warszawa Centrum"></label>
    <label>Interese, separate prin virgulă<input name="interests" maxlength="300" value="${esc((profile.interests || []).join(", "))}" placeholder="muzică, călătorii, sport"></label>
    <label>Despre mine<textarea name="bio" maxlength="500">${esc(profile.bio || "")}</textarea></label>
    <label>Discovery<select name="visibility"><option value="paused" ${profile.visibility === "paused" ? "selected" : ""}>Pauză — invizibil</option><option value="discoverable" ${profile.visibility === "discoverable" ? "selected" : ""}>Vizibil persoanelor compatibile</option><option value="private" ${profile.visibility === "private" ? "selected" : ""}>Privat</option></select></label>
    <label class="datingAck"><input name="adult" type="checkbox" required> Confirm că am minimum 18 ani. Aceasta nu este încă verificare de identitate.</label>
    <button>Salvează profilul Dating</button><small>Datele și preferințele Dating nu sunt folosite în Social, Work, reclame sau reputație.</small></form>`;
  host.querySelector("#dating-profile-form").addEventListener("submit", async (event) => {
    event.preventDefault(); const data = new FormData(event.currentTarget);
    const response = await deps.api("/api/dating/profile", { method: "PUT", headers: { "Idempotency-Key": mutationKey("dating-profile") }, body: {
      display_name: data.get("display_name"), age: Number(data.get("age")), gender: data.get("gender"), seeking: data.getAll("seeking"), intention: data.get("intention"),
      interests: String(data.get("interests") || "").split(",").map((item) => item.trim()).filter(Boolean), bio: data.get("bio"), city_bucket: data.get("city_bucket"), visibility: data.get("visibility"), adult_confirmed: data.get("adult") === "on",
    } });
    deps.toast(response.ok ? "Profil Dating salvat" : (response.error || "Profilul nu a fost salvat"));
    if (response.ok) { datingView = "discover"; renderDatingWorkspace(vp, deps); }
  });
}

async function renderMatches(vp, deps, epoch) {
  const host = vp.querySelector("#dating-content"), [matches, plans] = await Promise.all([deps.api("/api/dating/matches"), deps.api("/api/dating/meet-plans")]);
  if (epoch !== datingEpoch || !valid(matches, deps) || !valid(plans, deps) || plans.precise_location_stored !== false) return void (host.innerHTML = '<div class="datingError">Conexiunile nu au trecut verificarea de acces.</div>');
  host.innerHTML = `<section class="datingConnections"><h3>Conexiuni reciproce</h3>${matches.matches.length ? matches.matches.map((match) => `<article><header><span><b>@${esc(match.other_handle)}</b><small>Match reciproc · chat Dating separat</small></span><em>activ</em></header><div class="datingMatchActions"><button data-open-dating-chat="${match.conversation_id || ""}" ${match.conversation_id ? "" : "disabled"}>Mesaj</button><button data-unmatch="${match.id}">Unmatch</button><button class="danger" data-block-match="${match.id}">Blochează</button></div><form data-meet-create="${match.id}"><input name="zone" maxlength="100" placeholder="Loc public / zonă aproximativă" required><input name="when" type="datetime-local" required><input name="pin" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" placeholder="PIN 4 cifre" required><button>Propune întâlnire</button></form></article>`).join("") : '<p class="datingMuted">Niciun match. Like-urile unilaterale nu sunt afișate.</p>'}</section>
    <section class="datingPlans"><h3>Planuri private</h3>${plans.meet_plans.length ? plans.meet_plans.map((plan) => `<article><header><b>${esc(plan.zone_bucket)}</b><span>${formatDate(plan.scheduled_at)}</span></header><p>${esc(plan.status)} · confirmări ${Number(plan.low_confirmed) + Number(plan.high_confirmed)}/2</p><footer>${plan.status === "proposed" && Number(plan.proposer_id) !== Number(deps.state.user.id) ? `<button data-meet-action="accept" data-plan="${plan.id}">Acceptă</button>` : ""}${plan.status === "accepted" ? `<button data-meet-action="confirm" data-plan="${plan.id}">Confirmă cu PIN</button>` : ""}${["proposed","accepted"].includes(plan.status) ? `<button data-meet-action="cancel" data-plan="${plan.id}">Anulează</button>` : ""}</footer></article>`).join("") : '<p class="datingMuted">Niciun plan activ.</p>'}</section>`;
  host.querySelectorAll("[data-open-dating-chat]").forEach((button) => button.addEventListener("click", () => deps.openConversation?.(Number(button.dataset.openDatingChat))));
  for (const selector of ["[data-unmatch]", "[data-block-match]"]) host.querySelectorAll(selector).forEach((button) => button.addEventListener("click", async () => {
    const matchId = Number(button.dataset.unmatch || button.dataset.blockMatch), action = button.dataset.blockMatch ? "block" : "unmatch";
    const response = await deps.api(`/api/dating/matches/${matchId}`, { method: "PATCH", headers: { "Idempotency-Key": mutationKey(`dating-${action}`) }, body: { action } });
    deps.toast(response.ok ? (action === "block" ? "Profil blocat" : "Conexiune închisă") : (response.error || "Acțiunea a eșuat")); if (response.ok) renderDatingWorkspace(vp, deps);
  }));
  host.querySelectorAll("[data-meet-create]").forEach((form) => form.addEventListener("submit", async (event) => {
    event.preventDefault(); const data = new FormData(form);
    const response = await deps.api(`/api/dating/matches/${form.dataset.meetCreate}/meet-plans`, { method: "POST", headers: { "Idempotency-Key": mutationKey("dating-meet") }, body: { zone_bucket: data.get("zone"), scheduled_at: Math.floor(new Date(String(data.get("when"))).getTime() / 1000), pin: data.get("pin") } });
    deps.toast(response.ok ? "Plan propus privat" : (response.error || "Planul nu a fost creat")); if (response.ok) renderDatingWorkspace(vp, deps);
  }));
  host.querySelectorAll("[data-meet-action]").forEach((button) => button.addEventListener("click", async () => {
    const action = button.dataset.meetAction, pin = action === "confirm" ? (globalThis.prompt?.("PIN-ul comun de 4 cifre:", "") || "") : "";
    const response = await deps.api(`/api/dating/meet-plans/${button.dataset.plan}`, { method: "PATCH", headers: { "Idempotency-Key": mutationKey(`dating-meet-${action}`) }, body: { action, pin } });
    deps.toast(response.ok ? "Plan actualizat" : (response.error || "Actualizarea a eșuat")); if (response.ok) renderDatingWorkspace(vp, deps);
  }));
}

function renderSafety(vp) {
  vp.querySelector("#dating-content").innerHTML = `<section class="datingSafety"><div><i>1</i><span><b>Video înainte de întâlnire</b><p>Folosește apelul Nexus din conversația Dating. Nicio conversație nu traversează spre Social.</p></span></div><div><i>2</i><span><b>Loc public, nu adresă exactă</b><p>Planurile păstrează numai zona aproximativă și un PIN hash-only.</p></span></div><div><i>3</i><span><b>Nu trimite bani unui match nou</b><p>Crypto, investițiile și cererile urgente de bani sunt semnale de risc.</p></span></div><div><i>4</i><span><b>Block închide match-ul și chatul</b><p>Unmatch-ul este privat; block-ul prevalează imediat asupra discovery și mesageriei.</p></span></div></section>`;
}

export async function renderDatingWorkspace(vp, deps) {
  const epoch = ++datingEpoch;
  shell(vp, deps);
  if (datingView === "profile") return renderProfile(vp, deps, epoch);
  if (datingView === "matches") return renderMatches(vp, deps, epoch);
  if (datingView === "safety") return renderSafety(vp);
  return renderDiscovery(vp, deps, epoch);
}

export async function renderPriveGate(vp, deps) {
  const status = await deps.api("/api/prive/status").catch(() => null);
  const truthful = status?.code === "PRIVE_EXTERNAL_GATES_REQUIRED" && status.safe_preview_only === true && status.explicit_media_available === false && status.real_payments === false;
  vp.innerHTML = `<div class="screen scrollScreen priveGate"><header><span><small>ADULT SAFETY BOUNDARY</small><h2>Nexus Privé 18+</h2></span><i>18+</i></header><section><b>${truthful ? "Protecțiile sunt active" : "Stare indisponibilă"}</b><h3>Preview sigur, fără conținut explicit</h3><p>Privé nu este activat doar printr-un checkbox. Lansarea cere age assurance, policy pe țară, consent și rights, operațiuni de safety și review juridic independent.</p><ul><li>Fără media explicită în demo</li><li>Fără plăți sau camere private reale</li><li>Fără discovery public sau indexare</li><li>Nicio identitate Dating nu este reutilizată automat</li></ul><button type="button" disabled>Acces blocat corect</button></section></div>`;
}
