const API_BASE_URL = "https://sb6isgj8ue.execute-api.eu-north-1.amazonaws.coms";

/* =====================================================================
   CamBus Express - app.js
   Logique complète : cadre commun, effets visuels, API REST, mode démo
   ===================================================================== */

/* ---------- Configuration & utilitaires ---------- */
// Mode démo automatique tant que l'URL de l'API n'est pas renseignée
const MODE_DEMO = !API_BASE_URL || API_BASE_URL === "REMPLACER_PAR_URL_API_GATEWAY";
const CLE_DEMO = "cambus_demo_reservations";
const PRIX = { Classique: 5000, VIP: 10000 };
const TRAJETS = [
  { nom: "Douala - Yaoundé", duree: "~3h30" },
  { nom: "Yaoundé - Bafoussam", duree: "~4h30" },
  { nom: "Douala - Bafoussam", duree: "~4h00" },
  { nom: "Douala - Kribi", duree: "~2h30" }
];
const NS = "http://www.w3.org/2000/svg";
const $ = (s, r = document) => r.querySelector(s);
const attendre = ms => new Promise(r => setTimeout(r, ms));
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fcfa = n => Number(n).toLocaleString("fr-FR") + " FCFA";
const ico = n => `<i data-lucide="${n}"></i>`;
const icons = () => { if (window.lucide) window.lucide.createIcons(); };
const aujourdhui = () => new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
const dateFR = s => { const [y, m, d] = String(s).split("-").map(Number); return new Date(y, m - 1, d).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }); };
const genId = () => "BUS-" + Array.from({ length: 8 }, () => "0123456789ABCDEF"[Math.random() * 16 | 0]).join("");

/* ---------- Couche données : API réelle ou simulation localStorage ---------- */
function graines() {
  const L = [
    ["BUS-A1B2C3D4", "Jean Dupont", "690123456", "Douala - Yaoundé", "2026-11-25", "VIP", 2],
    ["BUS-8F4A2B1C", "Aïcha Mbarga", "677889900", "Yaoundé - Bafoussam", "2026-11-27", "Classique", 1],
    ["BUS-3C7E9D10", "Paul Essomba", "655443322", "Douala - Bafoussam", "2026-12-02", "Classique", 4],
    ["BUS-5D2F8A67", "Carine Ngo Bassa", "699001122", "Douala - Kribi", "2026-11-29", "VIP", 3],
    ["BUS-9E1B4C23", "Samuel Tchoupo", "670554433", "Douala - Yaoundé", "2026-12-05", "Classique", 2]
  ];
  return L.map((r, i) => ({ reservationId: r[0], nomClient: r[1], telephone: r[2], trajet: r[3], dateDepart: r[4], classe: r[5], places: r[6], montantTotal: PRIX[r[5]] * r[6], createdAt: new Date(Date.now() - (i + 1) * 864e5).toISOString() }));
}
function demoLire() {
  try { const d = JSON.parse(localStorage.getItem(CLE_DEMO)); if (Array.isArray(d)) return d; } catch (e) { /* ignoré */ }
  const g = graines(); demoEcrire(g); return g;
}
function demoEcrire(d) { try { localStorage.setItem(CLE_DEMO, JSON.stringify(d)); } catch (e) { /* ignoré */ } }

// GET : liste (filtre serveur par trajet, comme l'index TrajetIndex de DynamoDB)
async function apiLister(filtre = "TOUS") {
  if (MODE_DEMO) {
    await attendre(700);
    let d = demoLire();
    if (filtre !== "TOUS") d = d.filter(r => r.trajet === filtre);
    return d.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  }
  const url = `${API_BASE_URL}/reservations` + (filtre !== "TOUS" ? `?trajet=${encodeURIComponent(filtre)}` : "");
  const r = await fetch(url);
  if (!r.ok) throw new Error("Erreur serveur " + r.status);
  return (await r.json()).reservations || [];
}
// POST : création d'une réservation
async function apiCreer(p) {
  if (MODE_DEMO) {
    await attendre(1200);
    const res = { reservationId: genId(), ...p, montantTotal: PRIX[p.classe] * p.places, createdAt: new Date().toISOString() };
    const d = demoLire(); d.push(res); demoEcrire(d);
    return { message: "Réservation confirmée avec succès !", reservation: res };
  }
  const r = await fetch(`${API_BASE_URL}/reservations`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(p) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.message || j.error || "Erreur serveur " + r.status);
  return j;
}

/* ---------- Effets visuels : bulles, éclairs, compteurs, toasts ---------- */
// Petites bulles qui jaillissent au clic
function bulles(x, y, n = 14) {
  for (let i = 0; i < n; i++) {
    const b = document.createElement("i"), s = 6 + Math.random() * 18, a = Math.random() * Math.PI * 2, d = 30 + Math.random() * 80;
    b.className = "bubble";
    b.style.cssText = `left:${x - s / 2}px;top:${y - s / 2}px;width:${s}px;height:${s}px;--dx:${Math.cos(a) * d}px;--dy:${Math.sin(a) * d - 40}px;animation-duration:${.7 + Math.random() * .7}s`;
    document.body.appendChild(b);
    setTimeout(() => b.remove(), 1500);
  }
}
// Éclair plein écran : zigzags générés aléatoirement vers le point (x, y)
function eclair(x, y) {
  const W = innerWidth, H = innerHeight, svg = document.createElementNS(NS, "svg");
  svg.setAttribute("class", "bolt-layer"); svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  const bolt = (x0, y0, x1, y1, w, delay) => {
    let p = `M${x0} ${y0}`; const n = 9;
    for (let i = 1; i <= n; i++) {
      const t = i / n, j = i === n ? 0 : 60 * (1 - t * .5);
      p += ` L${x0 + (x1 - x0) * t + (Math.random() - .5) * j * 2} ${y0 + (y1 - y0) * t + (Math.random() - .5) * j}`;
    }
    const el = document.createElementNS(NS, "path");
    el.setAttribute("d", p); el.setAttribute("pathLength", 1);
    el.style.strokeWidth = w; el.style.animationDelay = delay + "s";
    svg.appendChild(el);
  };
  for (let i = 0; i < 4; i++) bolt(x + (Math.random() - .5) * W * .6, -10, x, y, i ? 1.5 : 3.5, i * .06);
  for (let i = 0; i < 3; i++) bolt(x, y, x + (Math.random() - .5) * 420, y + (Math.random() - .5) * 320, 1.6, .22 + i * .05);
  const fl = document.createElement("div");
  fl.className = "flash"; fl.style.setProperty("--fx", x + "px"); fl.style.setProperty("--fy", y + "px");
  document.body.append(svg, fl);
  document.body.classList.add("shake");
  setTimeout(() => { svg.remove(); fl.remove(); document.body.classList.remove("shake"); }, 1100);
}
// Compteur animé (ease-out exponentiel)
function compter(el, to, dur = 1600, fmt = n => n.toLocaleString("fr-FR")) {
  if (!el) return;
  const from = +el.dataset.v || 0, t0 = performance.now();
  el.dataset.v = to;
  const f = t => {
    const k = Math.min((t - t0) / dur, 1), e = k === 1 ? 1 : 1 - Math.pow(2, -10 * k);
    el.textContent = fmt(Math.round(from + (to - from) * e));
    if (k < 1) requestAnimationFrame(f);
  };
  requestAnimationFrame(f);
}
// Notification toast avec barre de progression
function toast(msg, type = "ok") {
  const box = $("#toasts"); if (!box) return;
  const t = document.createElement("div");
  t.className = "toast " + type;
  t.innerHTML = `${ico(type === "ok" ? "circle-check" : "circle-alert")}<span>${esc(msg)}</span><i class="bar"></i>`;
  box.appendChild(t); icons();
  setTimeout(() => { t.classList.add("out"); setTimeout(() => t.remove(), 400); }, 4200);
}

/* ---------- Cadre commun : header, footer, fond, interactions globales ---------- */
function construireCadre() {
  const page = document.body.dataset.page;
  const lien = (h, p, t) => `<a href="${h}" class="${p === page ? "active" : ""}">${t}</a>`;
  const hd = $("#siteHeader");
  if (hd) hd.innerHTML = `<header class="nav" id="nav"><div class="wrap nav-in">
    <a class="logo" href="index.html"><span class="logo-mark">${ico("bus")}</span><span>CamBus<b>Express</b></span></a>
    <nav class="links">${lien("index.html", "index", "Accueil")}${lien("reserver.html", "reserver", "Réserver un billet")}${lien("reservations.html", "reservations", "Mes Réservations")}</nav>
    <button class="burger" id="burger" aria-label="Ouvrir le menu"><span></span><span></span><span></span></button></div></header>`;
  const ft = $("#siteFooter");
  if (ft) ft.innerHTML = `<footer class="foot"><div class="wrap foot-in">
    <div><a class="logo" href="index.html"><span class="logo-mark">${ico("bus")}</span><span>CamBus<b>Express</b></span></a>
    <p style="margin-top:.8rem">Réservation de billets de bus interurbains au Cameroun. Projet serverless AWS (S3, API Gateway, Lambda, DynamoDB).</p>
    <span class="status ${MODE_DEMO ? "demo" : "live"}" id="apiStatus">${ico(MODE_DEMO ? "cloud-off" : "cloud")} ${MODE_DEMO ? "Mode Démo Locale (API non connectée)" : "Connecté au Cloud AWS"}</span></div>
    <div><h4>Liens rapides</h4><a href="index.html">Accueil</a><a href="reserver.html">Réserver un billet</a><a href="reservations.html">Mes Réservations</a></div>
    <div><h4>Trajets</h4>${TRAJETS.map(t => `<a href="reserver.html?trajet=${encodeURIComponent(t.nom)}">${esc(t.nom)}</a>`).join("")}</div></div>
    <div class="copy">CamBus Express - Projet académique cloud computing</div></footer>`;
  document.body.insertAdjacentHTML("afterbegin", '<div class="bg"><i class="orb o1"></i><i class="orb o2"></i><i class="orb o3"></i></div><div class="cursor-glow" id="glow"></div>');
  document.body.insertAdjacentHTML("beforeend", '<div class="toasts" id="toasts"></div>');
  const nav = $("#nav"), burger = $("#burger");
  if (burger && nav) burger.addEventListener("click", () => nav.classList.toggle("open"));
  if (nav) window.addEventListener("scroll", () => nav.classList.toggle("scrolled", scrollY > 20), { passive: true });
}
function initEffets() {
  // Bulles sur chaque clic de bouton / carte cliquable
  document.addEventListener("click", e => {
    if (e.target.tagName === "INPUT" || !e.target.closest("button,.btn,.cc,.tilt")) return;
    let x = e.clientX, y = e.clientY;
    if (!x && !y) { const r = e.target.getBoundingClientRect(); x = r.left + r.width / 2; y = r.top + r.height / 2; }
    bulles(x, y);
  });
  // Halo qui suit le curseur + inclinaison 3D des cartes
  document.addEventListener("pointermove", e => {
    const g = $("#glow"); if (g) { g.style.left = e.clientX + "px"; g.style.top = e.clientY + "px"; }
    const t = e.target.closest && e.target.closest(".tilt"); if (!t) return;
    const r = t.getBoundingClientRect(), px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
    t.style.setProperty("--rx", ((.5 - py) * 8).toFixed(2) + "deg"); t.style.setProperty("--ry", ((px - .5) * 8).toFixed(2) + "deg");
    t.style.setProperty("--mx", (px * 100) + "%"); t.style.setProperty("--my", (py * 100) + "%");
  });
  document.addEventListener("pointerout", e => {
    const t = e.target.closest && e.target.closest(".tilt");
    if (t && !t.contains(e.relatedTarget)) { t.style.setProperty("--rx", "0deg"); t.style.setProperty("--ry", "0deg"); }
  });
  // Apparition au scroll
  const io = new IntersectionObserver(es => es.forEach(x => { if (x.isIntersecting) { x.target.classList.add("in"); io.unobserve(x.target); } }), { threshold: .15 });
  document.querySelectorAll(".rv").forEach(el => io.observe(el));
}

/* =====================================================================
   PAGE 1 : index.html (trajets, KPI, graphique Chart.js)
   ===================================================================== */
let graphique = null, donneesDash = [];
function initIndex() {
  const grid = $("#routesGrid");
  if (grid) {
    grid.innerHTML = TRAJETS.map((t, i) => {
      const href = "reserver.html?trajet=" + encodeURIComponent(t.nom);
      return `<article class="card tilt route in-up" style="--i:${i}" data-href="${href}">
        <div class="r-top">${ico("route")}<span class="chip">${ico("clock")} ${t.duree}</span></div>
        <h3>${esc(t.nom)}</h3>
        <div class="prices"><div><small>Classique</small><b>5 000 FCFA</b></div><div class="vip"><small>VIP</small><b>10 000 FCFA</b></div></div>
        <a class="btn btn-p" href="${href}">Réserver ce trajet ${ico("arrow-right")}</a></article>`;
    }).join("");
    // Navigation légèrement différée pour laisser voir les bulles
    grid.addEventListener("click", e => {
      const c = e.target.closest("[data-href]"); if (!c) return;
      e.preventDefault(); setTimeout(() => { location.href = c.dataset.href; }, 320);
    });
  }
  document.querySelectorAll(".seg button").forEach(b => b.addEventListener("click", () => {
    document.querySelectorAll(".seg button").forEach(x => x.classList.toggle("on", x === b));
    dessiner(b.dataset.m);
  }));
  chargerDash();
}
async function chargerDash() {
  try { donneesDash = await apiLister("TOUS"); }
  catch (e) { donneesDash = []; toast("Chargement impossible : " + e.message, "err"); }
  const sk = $("#dashSkel"), body = $("#dashBody");
  if (sk) sk.hidden = true;
  if (body) body.hidden = false;
  compter($("#kpiReservations"), donneesDash.length);
  compter($("#kpiPassagers"), donneesDash.reduce((s, r) => s + (+r.places || 0), 0));
  compter($("#kpiRevenu"), donneesDash.reduce((s, r) => s + (+r.montantTotal || 0), 0), 2000);
  dessiner("count");
}
function dessiner(mode) {
  const cv = $("#trajetsChart"); if (!cv || typeof Chart === "undefined") return;
  const noms = TRAJETS.map(t => t.nom);
  const vals = noms.map(n => donneesDash.filter(r => r.trajet === n).reduce((s, r) => s + (mode === "rev" ? +r.montantTotal || 0 : 1), 0));
  if (graphique) graphique.destroy();
  graphique = new Chart(cv, {
    type: "doughnut",
    data: { labels: noms, datasets: [{ data: vals, backgroundColor: ["#10B981", "#3B82F6", "#F59E0B", "#A78BFA"], borderColor: "#0d1424", borderWidth: 4, borderRadius: 8, hoverOffset: 16 }] },
    options: {
      maintainAspectRatio: false, cutout: "68%", animation: { duration: 1400, easing: "easeOutQuart" },
      plugins: {
        legend: { position: "bottom", labels: { color: "#94A3B8", usePointStyle: true, padding: 18 } },
        tooltip: { callbacks: { label: c => " " + c.label + " : " + (mode === "rev" ? fcfa(c.parsed) : c.parsed + " réservation(s)") } }
      }
    }
  });
}

/* =====================================================================
   PAGE 2 : reserver.html (formulaire, calculateur, e-billet)
   ===================================================================== */
const normTel = v => { let d = String(v).replace(/\D/g, ""); if (d.length === 12 && d.startsWith("237")) d = d.slice(3); return d; };
const classeChoisie = () => { const r = $("input[name=classe]:checked"); return r ? r.value : "Classique"; };

function calculer() {
  const n = +($("#places") || {}).value || 1, c = classeChoisie(), pu = PRIX[c];
  const set = (id, v) => { const e = $(id); if (e) e.textContent = v; };
  set("#recapTrajet", ($("#trajet") || {}).value || "-"); set("#recapClasse", c);
  set("#recapUnit", fcfa(pu)); set("#recapPlaces", n);
  const tot = $("#recapTotal");
  if (tot) { compter(tot, pu * n, 600); tot.classList.remove("pulse"); void tot.offsetWidth; tot.classList.add("pulse"); }
}
function valider() {
  const regles = {
    nomClient: v => v.trim().length >= 3 || "Le nom doit contenir au moins 3 caractères.",
    telephone: v => /^6\d{8}$/.test(normTel(v)) || "Numéro invalide (format attendu : 6XXXXXXXX).",
    trajet: v => !!v || "Veuillez choisir un trajet.",
    dateDepart: v => (!!v && v >= aujourdhui()) || "La date ne peut pas être antérieure à aujourd'hui."
  };
  let ok = true;
  Object.keys(regles).forEach(id => {
    const el = $("#" + id), er = $("#err-" + id); if (!el) return;
    const res = regles[id](el.value);
    if (er) er.textContent = res === true ? "" : res;
    el.classList.remove("bad");
    if (res !== true) { ok = false; void el.offsetWidth; el.classList.add("bad"); }
  });
  return ok;
}
function qrSvg(id) {
  // QR stylisé généré dynamiquement à partir de l'identifiant (graine déterministe)
  let h = 7; for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const rnd = () => (h = (h * 1664525 + 1013904223) >>> 0) / 4294967296, N = 25;
  const fp = (x, y) => `M${x} ${y}h7v7h-7zM${x + 1} ${y + 1}h5v5h-5zM${x + 2} ${y + 2}h3v3h-3z`;
  let d = fp(0, 0) + fp(N - 7, 0) + fp(0, N - 7);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    if ((x < 8 && y < 8) || (x > N - 9 && y < 8) || (x < 8 && y > N - 9)) continue;
    if (rnd() > .52) d += `M${x} ${y}h1v1h-1z`;
  }
  return `<svg viewBox="-1 -1 ${N + 2} ${N + 2}" shape-rendering="crispEdges"><path d="${d}" fill="#0B1220" fill-rule="evenodd"/></svg>`;
}
function billetHTML(r) {
  const [a, b] = String(r.trajet).split(" - ");
  const cell = (i, l, v) => `<div><small>${ico(i)} ${l}</small><b>${esc(v)}</b></div>`;
  return `<div class="t-glow"><div class="ticket" id="eTicket">
    <div class="t-main">
      <div class="t-top"><span class="t-brand">${ico("bus")} CamBus Express</span><span class="tag ${r.classe === "VIP" ? "vip" : "cl"}">${esc(r.classe)}</span></div>
      <small class="lbl">Carte d'embarquement - Billet n°</small>
      <div class="t-id">${esc(r.reservationId)}</div>
      <div class="t-route"><span>${esc(a)}</span>${ico("arrow-right")}<span>${esc(b || "")}</span></div>
      <div class="t-grid">${cell("user", "Passager", r.nomClient)}${cell("phone", "Téléphone", r.telephone)}${cell("calendar-days", "Date de départ", dateFR(r.dateDepart))}${cell("armchair", "Places", r.places)}</div>
    </div>
    <div class="t-stub"><div class="qr">${qrSvg(r.reservationId)}</div>
      <div><small class="lbl">Total payé</small><strong>${fcfa(r.montantTotal)}</strong><p>Présentez ce code à l'embarquement.</p></div></div>
  </div></div>`;
}
function initReserver() {
  const f = $("#formReservation"); if (!f) return;
  const dt = $("#dateDepart"), tr = $("#trajet"), pl = $("#places");
  if (dt) { dt.min = aujourdhui(); dt.value = dt.min; }
  const p = new URLSearchParams(location.search).get("trajet");
  if (p && tr && TRAJETS.some(t => t.nom === p)) tr.value = p;
  const bornes = d => { if (pl) { pl.value = Math.min(10, Math.max(1, (+pl.value || 1) + d)); calculer(); } };
  const m = $("#placesMoins"), pp = $("#placesPlus");
  if (m) m.addEventListener("click", () => bornes(-1));
  if (pp) pp.addEventListener("click", () => bornes(1));
  const cl = $("#classe"); if (cl) cl.addEventListener("change", calculer);
  if (tr) tr.addEventListener("change", calculer);
  calculer();

  f.addEventListener("submit", async e => {
    e.preventDefault();
    if (!valider()) { toast("Veuillez corriger les champs en erreur.", "err"); return; }
    const b = $("#btnSubmit"), r = b.getBoundingClientRect();
    eclair(r.left + r.width / 2, r.top + r.height / 2);   // éclair à la soumission
    b.disabled = true; b.innerHTML = '<span class="spin"></span> Confirmation en cours...';
    const payload = { nomClient: $("#nomClient").value.trim(), telephone: normTel($("#telephone").value), trajet: tr.value, dateDepart: dt.value, classe: classeChoisie(), places: +pl.value };
    try {
      const res = await apiCreer(payload);
      toast(res.message || "Réservation confirmée !");
      afficherBillet(res.reservation, f);
    } catch (err) { toast(err.message || "Échec de la réservation.", "err"); }
    finally { b.disabled = false; b.innerHTML = `${ico("ticket")} Confirmer la réservation`; icons(); }
  });
}
function afficherBillet(r, f) {
  const z = $("#zoneBillet"), recap = $("#recap"); if (!z) return;
  if (recap) recap.hidden = true;
  z.hidden = false;
  z.innerHTML = billetHTML(r) + `<div class="t-actions"><button class="btn btn-p" id="btnPrint">${ico("printer")} Imprimer / Sauvegarder le billet</button><button class="btn btn-g" id="btnNew">${ico("plus")} Nouvelle réservation</button></div>`;
  icons();
  $("#btnPrint").addEventListener("click", () => window.print());
  $("#btnNew").addEventListener("click", () => {
    z.hidden = true; z.innerHTML = ""; if (recap) recap.hidden = false;
    f.reset(); const dt = $("#dateDepart"); if (dt) dt.value = dt.min; calculer();
  });
  const t = $("#eTicket").getBoundingClientRect();
  setTimeout(() => bulles(t.left + t.width / 2, t.top + t.height / 2, 30), 500);
  z.scrollIntoView({ behavior: "smooth", block: "center" });
}

/* =====================================================================
   PAGE 3 : reservations.html (liste, filtre serveur, recherche client)
   ===================================================================== */
let liste = [];
function carteResa(r, i) {
  const vip = r.classe === "VIP";
  return `<article class="card tilt in-up" style="--i:${Math.min(i, 12)}">
    <div class="rc-top"><span class="rc-id">${esc(r.reservationId)}</span><span class="tag ${vip ? "vip" : "cl"}">${esc(r.classe)}</span></div>
    <div class="rc-l">${ico("user")}<b>${esc(r.nomClient)}</b></div>
    <div class="rc-l">${ico("phone")}<span>${esc(r.telephone)}</span></div>
    <div class="rc-l">${ico("route")}<b>${esc(r.trajet)}</b></div>
    <div class="rc-l">${ico("calendar-days")}<span>${esc(dateFR(r.dateDepart))}</span></div>
    <div class="rc-bot"><span class="chip">${ico("armchair")} ${esc(r.places)} place${r.places > 1 ? "s" : ""}</span><strong>${fcfa(r.montantTotal)}</strong></div></article>`;
}
function rendreListe() {
  const zone = $("#zoneResa"), inp = $("#rechercheClient"); if (!zone) return;
  const q = (inp ? inp.value : "").trim().toLowerCase();
  const l = liste.filter(r => !q || [r.nomClient, r.telephone, r.reservationId].some(v => String(v).toLowerCase().includes(q)));
  const c = $("#compteurResultats"); if (c) c.textContent = `${l.length} réservation${l.length > 1 ? "s" : ""} trouvée${l.length > 1 ? "s" : ""}`;
  zone.innerHTML = l.length ? l.map(carteResa).join("") :
    `<div class="empty"><div class="big">${ico("search-x")}</div><h3>Aucune réservation trouvée pour ce critère</h3><p>Essayez un autre trajet ou réservez votre prochain voyage.</p><a class="btn btn-p" href="reserver.html">${ico("ticket")} Réserver un billet</a></div>`;
  icons();
}
async function chargerListe() {
  const zone = $("#zoneResa"), sel = $("#filtreTrajet"), btn = $("#btnRefresh"); if (!zone) return;
  zone.innerHTML = Array.from({ length: 6 }, () => '<div class="sk sk-card"></div>').join("");   // squelettes
  if (btn) btn.classList.add("loading");
  try { liste = await apiLister(sel ? sel.value : "TOUS"); }   // filtre côté serveur (GSI)
  catch (e) { liste = []; toast("Chargement impossible : " + e.message, "err"); }
  if (btn) btn.classList.remove("loading");
  rendreListe();
}
function initReservations() {
  if (!$("#zoneResa")) return;
  const sel = $("#filtreTrajet"), inp = $("#rechercheClient"), btn = $("#btnRefresh");
  if (sel) sel.addEventListener("change", chargerListe);
  if (inp) inp.addEventListener("input", rendreListe);
  if (btn) btn.addEventListener("click", chargerListe);
  chargerListe();
}

/* ---------- Démarrage ---------- */
document.addEventListener("DOMContentLoaded", () => {
  construireCadre();
  initEffets();
  const p = document.body.dataset.page;
  if (p === "index") initIndex();
  if (p === "reserver") initReserver();
  if (p === "reservations") initReservations();
  icons();
});
