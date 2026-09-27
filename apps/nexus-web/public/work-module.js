let section = "overview";
let renderEpoch = 0;

function h(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
}

function key(scope) {
  return `${scope}:${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`}`;
}

function money(cents) { return `${(Number(cents || 0) / 100).toFixed(2)} TEST-USDC`; }
function dateTime(seconds) { return new Date(Number(seconds) * 1000).toLocaleString(); }

function shell(vp, title = "Nexus Work") {
  vp.innerHTML = `<div class="screen scrollScreen workScreen">
    <header class="workHero"><span><small>PROFESSIONAL NODE</small><h2>${h(title)}</h2><p>Identitate profesională separată · date locale · zero plăți reale</p></span><i>▣</i></header>
    <nav class="workTabs" aria-label="Work"><button data-work-section="overview">Profil</button><button data-work-section="jobs">Jobs</button><button data-work-section="business">Business & Beauty</button><button data-work-section="appointments">Programări</button></nav>
    <div id="work-content" aria-live="polite"><div class="workLoading">Se încarcă…</div></div>
  </div>`;
  vp.querySelectorAll("[data-work-section]").forEach((button) => {
    button.classList.toggle("active", button.dataset.workSection === section);
    button.addEventListener("click", () => { section = button.dataset.workSection; renderWorkWorkspace(vp); });
  });
}

function valid(result, state) {
  return result?.ok === true && Number(result.viewer_id) === Number(state.user.id) && result.viewer_persona === "work";
}

async function overview(host, deps, epoch) {
  const [profileResult, jobsResult] = await Promise.all([deps.api("/api/work/profile"), deps.api("/api/work/jobs?limit=4")]);
  if (epoch !== renderEpoch || !host.isConnected) return;
  if (!valid(profileResult, deps.state) || !valid(jobsResult, deps.state)) { host.innerHTML = '<div class="workError">Profilul Work nu a putut fi încărcat în siguranță.</div>'; return; }
  const profile = profileResult.profile;
  host.innerHTML = `<section class="workIdentityCard"><div class="workAvatar">${h((profile.persona?.name || "W").slice(0, 2).toUpperCase())}</div><span><small>PROFIL WORK INDEPENDENT</small><h3>${h(profile.persona?.name || deps.state.user.display_name)}</h3><p>${h(profile.headline || "Adaugă un headline profesional")}</p><em>${h(profile.location || "Locație nesetată")} · ${h(profile.availability)}</em></span></section>
    <form id="work-profile-form" class="workForm"><h3>Editează profilul profesional</h3><label>Headline<input name="headline" maxlength="100" value="${h(profile.headline)}" /></label><label>Locație<input name="location" maxlength="100" value="${h(profile.location)}" /></label><label>Disponibilitate<select name="availability"><option value="open">Open to work</option><option value="hiring">Hiring</option><option value="not_looking">Not looking</option></select></label><label>Competențe, separate prin virgulă<input name="skills" maxlength="400" value="${h(profile.skills.join(", "))}" /></label><button type="submit">Salvează profilul Work</button></form>
    <section class="workMiniList"><header><h3>Joburi recente</h3><button type="button" id="open-jobs">Vezi toate</button></header>${jobsResult.jobs.length ? jobsResult.jobs.map(jobCard).join("") : '<p class="workEmpty">Încă nu există joburi locale.</p>'}</section>`;
  host.querySelector('[name="availability"]').value = profile.availability;
  host.querySelector("#open-jobs").addEventListener("click", () => { section = "jobs"; renderWorkWorkspace(host.closest(".screen").parentElement); });
  host.querySelector("#work-profile-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget; const data = new FormData(form);
    const skills = String(data.get("skills") || "").split(",").map((item) => item.trim()).filter(Boolean);
    const result = await deps.api("/api/work/profile", { method: "PATCH", headers: { "Idempotency-Key": key("work-profile") }, body: { headline: data.get("headline"), location: data.get("location"), availability: data.get("availability"), skills, experience: profile.experience || [] } });
    deps.toast(result.ok ? "Profilul Work a fost salvat" : (result.error || "Salvarea a eșuat"));
    if (result.ok) renderWorkWorkspace(host.closest(".screen").parentElement);
  });
}

function jobCard(job) {
  return `<article class="jobCard" data-job-id="${Number(job.id)}"><header><span><small>${h(job.company)}</small><h3>${h(job.title)}</h3></span><em>${h(job.workplace_type)}</em></header><p>${h(job.description)}</p><footer><span>${h(job.location || "Worldwide")} · ${h(job.employment_type)}</span><b>${Number(job.application_count || 0)} aplicări</b></footer>${job.applied_by_me ? '<strong class="workStatus">Aplicat ✓</strong>' : `<button type="button" data-apply-job="${Number(job.id)}">Aplică</button>`}</article>`;
}

async function jobs(host, deps, epoch) {
  const [jobsResult, mine, received] = await Promise.all([deps.api("/api/work/jobs"), deps.api("/api/work/applications?scope=mine"), deps.api("/api/work/applications?scope=received")]);
  if (epoch !== renderEpoch || !host.isConnected) return;
  if (!valid(jobsResult, deps.state) || !valid(mine, deps.state) || !valid(received, deps.state)) { host.innerHTML = '<div class="workError">Joburile nu au putut fi încărcate.</div>'; return; }
  host.innerHTML = `<section class="workGrid"><form id="job-create-form" class="workForm"><h3>Publică un job</h3><label>Titlu<input name="title" maxlength="100" required /></label><label>Companie<input name="company" maxlength="100" required /></label><label>Locație<input name="location" maxlength="100" /></label><div class="workFormRow"><label>Model<select name="workplace_type"><option value="onsite">On-site</option><option value="hybrid">Hybrid</option><option value="remote">Remote</option></select></label><label>Tip<select name="employment_type"><option value="full_time">Full time</option><option value="part_time">Part time</option><option value="contract">Contract</option><option value="internship">Internship</option></select></label></div><label>Descriere<textarea name="description" maxlength="2000" required></textarea></label><button type="submit">Publică local</button></form>
    <section class="workList"><header><h3>Joburi deschise</h3><span>${jobsResult.jobs.length}</span></header>${jobsResult.jobs.length ? jobsResult.jobs.map(jobCard).join("") : '<p class="workEmpty">Niciun job deschis.</p>'}</section></section>
    <section class="applicationBoard"><div><h3>Aplicările mele</h3>${mine.applications.length ? mine.applications.map((a) => `<p><b>${h(a.title)}</b><span>${h(a.company)} · ${h(a.status)}</span></p>`).join("") : '<p class="workEmpty">Nicio aplicare.</p>'}</div><div><h3>Primite</h3>${received.applications.length ? received.applications.map((a) => `<p><b>@${h(a.applicant_handle)}</b><span>${h(a.title)} · ${h(a.status)}</span></p>`).join("") : '<p class="workEmpty">Nicio aplicare primită.</p>'}</div></section>`;
  host.querySelector("#job-create-form").addEventListener("submit", async (event) => {
    event.preventDefault(); const data = Object.fromEntries(new FormData(event.currentTarget));
    const result = await deps.api("/api/work/jobs", { method: "POST", headers: { "Idempotency-Key": key("job-create") }, body: { business_page_id: null, ...data } });
    deps.toast(result.ok ? "Job publicat local" : (result.error || "Publicarea a eșuat")); if (result.ok) renderWorkWorkspace(host.closest(".screen").parentElement);
  });
  host.querySelectorAll("[data-apply-job]").forEach((button) => button.addEventListener("click", async () => {
    const result = await deps.api(`/api/work/jobs/${button.dataset.applyJob}/apply`, { method: "POST", headers: { "Idempotency-Key": key("job-apply") }, body: { note: "Aplicare din Nexus Work" } });
    deps.toast(result.ok ? "Aplicare trimisă" : (result.error || "Aplicarea a eșuat")); if (result.ok) renderWorkWorkspace(host.closest(".screen").parentElement);
  }));
}

function ownedPageCard(page) {
  return `<article class="businessOwnerCard"><header><span><small>${h(page.category)}</small><h3>${h(page.name)}</h3></span><em>${h(page.verification_status)}</em></header><p>${h(page.description)}</p><form data-service-page="${Number(page.id)}" class="inlineBusinessForm"><input name="title" maxlength="100" placeholder="Serviciu nou" required /><select name="category"><option value="haircut">Tuns</option><option value="hair_styling">Coafat</option><option value="beauty">Beauty</option><option value="consultation">Consultație</option></select><input name="duration_minutes" type="number" min="10" max="480" value="45" required /><input name="price" type="number" min="0" step="0.01" value="25" required /><button>Adaugă serviciu</button></form></article>`;
}

function catalogCard(page, viewerId) {
  return `<article class="beautyCard"><header><span><small>${h(page.category)} · ${h(page.location || "Worldwide")}</small><h3>${h(page.name)}</h3><p>@${h(page.owner_handle)} · ${h(page.verification_status)}</p></span></header>${page.services.length ? page.services.map((service) => `<section><div><b>${h(service.title)}</b><span>${service.duration_minutes} min · ${money(service.price_cents)} · avans ${money(service.deposit_cents)}</span></div>${page.owner_id === Number(viewerId) ? `<form data-slot-service="${Number(service.id)}" class="slotForm"><input name="staff_name" maxlength="80" placeholder="Specialist" /><input name="starts_at" type="datetime-local" required /><button>Adaugă slot</button></form>` : ""}<div class="slotList">${service.slots.length ? service.slots.map((slot) => `<button type="button" data-book-slot="${Number(slot.id)}" ${page.owner_id === Number(viewerId) ? "disabled" : ""}>${h(dateTime(slot.starts_at))}</button>`).join("") : '<span>Niciun slot liber</span>'}</div></section>`).join("") : '<p class="workEmpty">Niciun serviciu publicat.</p>'}</article>`;
}

async function business(host, deps, epoch) {
  const [owned, catalog] = await Promise.all([deps.api("/api/business/pages?mine=1"), deps.api("/api/business/catalog")]);
  if (epoch !== renderEpoch || !host.isConnected) return;
  if (!valid(owned, deps.state) || !valid(catalog, deps.state) || catalog.settlement !== "LOCAL_DEMO_NO_PAYMENT") { host.innerHTML = '<div class="workError">Catalogul Business nu a putut fi verificat.</div>'; return; }
  host.innerHTML = `<section class="workGrid"><form id="business-create-form" class="workForm"><h3>Creează pagină Business</h3><label>Nume<input name="name" maxlength="100" required /></label><label>Categorie<select name="category"><option value="business">Business</option><option value="hair_salon">Salon</option><option value="beauty">Beauty</option></select></label><label>Locație<input name="location" maxlength="100" /></label><label>Descriere<textarea name="description" maxlength="1000" required></textarea></label><button type="submit">Creează pagina</button><small>Verificarea reală și plățile sunt dezactivate local.</small></form><section class="workList"><header><h3>Paginile mele</h3><span>${owned.pages.length}</span></header>${owned.pages.length ? owned.pages.map(ownedPageCard).join("") : '<p class="workEmpty">Nu ai încă o pagină business.</p>'}</section></section><section class="beautyCatalog"><header><h3>Beauty near & global</h3><span>Rezervare locală · 0 valoare reală</span></header>${catalog.pages.length ? catalog.pages.map((page) => catalogCard(page, deps.state.user.id)).join("") : '<p class="workEmpty">Catalogul este gol.</p>'}</section>`;
  host.querySelector("#business-create-form").addEventListener("submit", async (event) => {
    event.preventDefault(); const data = Object.fromEntries(new FormData(event.currentTarget));
    const result = await deps.api("/api/business/pages", { method: "POST", headers: { "Idempotency-Key": key("business-page") }, body: data });
    deps.toast(result.ok ? "Pagina Business a fost creată" : (result.error || "Crearea a eșuat")); if (result.ok) renderWorkWorkspace(host.closest(".screen").parentElement);
  });
  host.querySelectorAll("[data-service-page]").forEach((form) => form.addEventListener("submit", async (event) => {
    event.preventDefault(); const data = new FormData(form); const price = Math.round(Number(data.get("price")) * 100);
    const result = await deps.api(`/api/business/pages/${form.dataset.servicePage}/services`, { method: "POST", headers: { "Idempotency-Key": key("business-service") }, body: { title: data.get("title"), category: data.get("category"), duration_minutes: Number(data.get("duration_minutes")), price_cents: price, deposit_cents: 0 } });
    deps.toast(result.ok ? "Serviciu adăugat" : (result.error || "Serviciul nu a fost adăugat")); if (result.ok) renderWorkWorkspace(host.closest(".screen").parentElement);
  }));
  host.querySelectorAll("[data-slot-service]").forEach((form) => form.addEventListener("submit", async (event) => {
    event.preventDefault(); const data = new FormData(form); const startsAt = Math.floor(new Date(String(data.get("starts_at"))).getTime() / 1000);
    const result = await deps.api(`/api/business/services/${form.dataset.slotService}/slots`, { method: "POST", headers: { "Idempotency-Key": key("appointment-slot") }, body: { staff_name: data.get("staff_name"), starts_at: startsAt } });
    deps.toast(result.ok ? "Slot disponibil adăugat" : (result.error || "Slotul nu a fost adăugat")); if (result.ok) renderWorkWorkspace(host.closest(".screen").parentElement);
  }));
  host.querySelectorAll("[data-book-slot]").forEach((button) => button.addEventListener("click", async () => {
    const result = await deps.api(`/api/business/slots/${button.dataset.bookSlot}/book`, { method: "POST", headers: { "Idempotency-Key": key("appointment-book") }, body: {} });
    deps.toast(result.ok ? "Programare confirmată local" : (result.error || "Slot indisponibil")); if (result.ok) { section = "appointments"; renderWorkWorkspace(host.closest(".screen").parentElement); }
  }));
}

async function appointments(host, deps, epoch) {
  const result = await deps.api("/api/business/appointments");
  if (epoch !== renderEpoch || !host.isConnected) return;
  if (!valid(result, deps.state) || result.settlement !== "LOCAL_DEMO_NO_PAYMENT") { host.innerHTML = '<div class="workError">Programările nu au putut fi încărcate.</div>'; return; }
  host.innerHTML = `<section class="appointmentBoard"><header><span><small>CALENDAR LOCAL</small><h3>Programări</h3></span><em>0 fonduri reale</em></header>${result.appointments.length ? result.appointments.map((item) => `<article><div><small>${h(item.viewer_role)}</small><h3>${h(item.service_title)}</h3><p>${h(item.business_name)} · ${h(dateTime(item.starts_at))}</p><span>${h(item.staff_name || "Specialist nesetat")} · avans ${money(item.quoted_deposit_cents)}</span></div><strong>${h(item.status)}</strong>${item.status === "confirmed_local_no_payment" ? `<footer><button type="button" data-appointment-action="cancel" data-appointment-id="${Number(item.id)}">Anulează</button>${item.viewer_role === "owner" ? `<button type="button" data-appointment-action="complete" data-appointment-id="${Number(item.id)}">Finalizează</button>` : ""}</footer>` : ""}</article>`).join("") : '<p class="workEmpty">Nicio programare.</p>'}</section>`;
  host.querySelectorAll("[data-appointment-action]").forEach((button) => button.addEventListener("click", async () => {
    const result = await deps.api(`/api/business/appointments/${button.dataset.appointmentId}`, { method: "PATCH", headers: { "Idempotency-Key": key("appointment-transition") }, body: { action: button.dataset.appointmentAction } });
    deps.toast(result.ok ? "Programarea a fost actualizată" : (result.error || "Acțiunea a eșuat")); if (result.ok) renderWorkWorkspace(host.closest(".screen").parentElement);
  }));
}

export async function renderWorkWorkspace(vp, deps = null, initialSection = null) {
  if (deps) renderWorkWorkspace.dependencies = deps;
  const activeDeps = renderWorkWorkspace.dependencies;
  if (!activeDeps || !vp) return;
  if (initialSection) section = initialSection;
  const epoch = ++renderEpoch;
  shell(vp, section === "jobs" ? "Work Jobs" : "Nexus Work");
  const host = vp.querySelector("#work-content");
  if (section === "jobs") return jobs(host, activeDeps, epoch);
  if (section === "business") return business(host, activeDeps, epoch);
  if (section === "appointments") return appointments(host, activeDeps, epoch);
  return overview(host, activeDeps, epoch);
}
