/* ======================================================================
   rieb.js - die neue Oberflaeche "Rieb Spesen" (08.10.2026)

   Vorlage: Neues Design/entwurf/quelle.html (Entwurf "Nacht & Blatt",
   Fassung 3, von Mirko am 07.10.2026 abgestimmt). Der Entwurf rechnete mit
   Beispieldaten; hier sitzt dieselbe Optik auf den ECHTEN Funktionen der
   Live-Fassung (index.html):

     rechnen        computeDay / computeMonth / feiertage   (unveraendert)
     speichern      overrides / config / saveOverrides / saveConfig
     Vordruck+PDF   renderFormular / buildPdf / printSpesen / previewPDF /
                    downloadPDF / submitCurrentMonth        (unveraendert)
     Zeiten         das Zeit-Dreh-Rad openTimeWheel()        (neu eingekleidet)

   WARUM EINE EIGENE SCHICHT UND KEIN UMBAU DER ALTEN OBERFLAECHE:
   Der PDF-Ausdruck fotografiert den alten Vordruck (#formular) ab. Er muss
   im Dokument sichtbar bleiben - "gedruckter Spesennachweis bleibt Blatt
   fuer Blatt wie heute" (Mirko, Entscheidung 6). Die neue Oberflaeche liegt
   deshalb DARUEBER (#rieb, fest positioniert), die alte arbeitet darunter
   weiter. Wenn hier "Spesen" offen ist, steht die alte auf Spesen
   (zeigeTabAlt) - genau dann funktioniert der Abzug.

   Mirkos eigene Bereiche (Inventur, Ware, Zeit): Entscheidung 17 - dieselben
   Bausteine, erst ein Bild je Bereich zur Freigabe. Seit 08.10.2026 abends
   laufen alle drei in der neuen Oberflaeche (Zeit, Ware, zuletzt Inventur).

   App und Browser: Unterschiede NUR nach Breite, nie nach Installation.
   ====================================================================== */
(function () {
"use strict";

/* ---------------- Konstanten ---------------- */
const WT = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
const WT_LANG = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
const MON = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
const MON_K = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
const ARTEN = { urlaub: "Urlaub", krank: "Krank", frei: "Frei", sonderurlaub: "Sonderurlaub", elternzeit: "Elternzeit" };
const ROLLEN = {
  "fahrer": ["Fahrer", "Abfahrt WP / Ankunft WP"],
  "monteur-aussen": ["Monteur Außendienst", "Abfahrt WP / Ankunft WP"],
  "monteur-innen": ["Monteur Innendienst", "Anwesenheit in Niederlassung"],
};
const ROLLEN_IC = { "fahrer": "lkw", "monteur-aussen": "werkzeug", "monteur-innen": "haus" };
/* Diese Bereiche zeigt die neue Oberflaeche selbst. "zeit" seit 08.10.2026
   nachmittags, "ware" und "inventur" seit dem Abend (Mirko: hell Fassung A,
   dunkel Fassung B) - sichtbar nur, wenn tabErlaubt(...) (Mirko). */
const EIGENE = ["spesen", "urlaub", "jahr", "mehr", "anleitung", "zeit", "ware", "inventur", "stoerungen"];

const I = {
  zurueck: '<path d="M15 18l-6-6 6-6"/>', vor: '<path d="M9 6l6 6-6 6"/>',
  drucker: '<path d="M7 9V4h10v5"/><path d="M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2"/><path d="M7 14h10v6H7z"/>',
  auge: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  laden: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>', hoch: '<path d="M12 20V9M7 14l5-5 5 5M5 4h14"/>',
  uhr: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  warnung: '<path d="M12 4 2.8 19.5h18.4z"/><path d="M12 10v4.5M12 17v.01"/>',
  datei: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
  kalender: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  punkte: '<circle cx="5.5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="18.5" cy="12" r="1.3"/>',
  handy: '<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>',
  start: '<circle cx="12" cy="12" r="9"/><path d="M10.2 8.6v6.8l5.6-3.4z"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.8v.01"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>',
  haken: '<path d="M5 12.5l4.5 4.5L19 7.5"/>', warn: '<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17v.01"/>',   // 09.10.2026: Einstellungen
  archiv: '<rect x="3" y="4" width="18" height="4.5" rx="1.5"/><path d="M5 8.5V19a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 19V8.5M10 12.5h4"/>',
  rede: '<path d="M20.5 12a8.5 8.5 0 0 1-12.3 7.6L3.5 20.5l1-4.4A8.5 8.5 0 1 1 20.5 12z"/>',
  qr: '<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><path d="M14 14h2v2h-2zM18 18h2v2h-2zM14 18h2M18 14h2"/>',
  welt: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  verlauf: '<path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1"/><path d="M3.5 4.5v4.5H8M12 8v4l3 2"/>',
  muell: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  lkw: '<path d="M3 6h11v10H3zM14 9h4l3 3v4h-7"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/>',
  werkzeug: '<path d="M14.5 6.5a4 4 0 0 0-5.3 5.3L4 17l3 3 5.2-5.2a4 4 0 0 0 5.3-5.3l-2.5 2.5-2.5-.5-.5-2.5z"/>',
  haus: '<path d="M4 11l8-6.5 8 6.5M6 9.5V20h12V9.5"/><path d="M10 20v-5h4v5"/>',
  schloss: '<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>',
  mail: '<rect x="3" y="5.5" width="18" height="13" rx="2.5"/><path d="M3.5 7l8.5 6 8.5-6"/>',
  regler: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  stift: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
  kiste: '<path d="M3.5 8L12 4l8.5 4v8L12 20l-8.5-4z"/><path d="M3.5 8L12 12l8.5-4M12 12v8"/>',
  farbe: '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor"/>',
  zaehl: '<path d="M6 5v14M10 5v14M14 5v14M18 5v14M4 15.5l16-7"/>',
  /* 09.10.2026: Geraete abgleichen (Entwurf abgleich-entwurf.html, freigegeben) */
  wolke: '<path d="M7 18.5h10a4 4 0 0 0 .6-7.95A5.5 5.5 0 0 0 7 9.5a4.5 4.5 0 0 0 0 9z"/><path d="M10 13.5l2-2 2 2M12 11.5v5"/>',
  raus: '<path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4"/><path d="M15 8l4 4-4 4M19 12H9"/>',
  /* 11.10.2026: Mitteilungen */
  glocke: '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
};
const ic = (n) => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${I[n] || ""}</svg>`;
/* Fuer Fenster der alten Fassung im neuen Aussehen (PDF-Vorschau, 10.10.2026) */
window.riebIc = ic;
/* Das Zeichen "R + Schwung-S" (Mirko 08.10.2026: App-Symbol Fassung 3, "rs
   soll dort auch hin" - Startseite und Einstieg). Gleicher Aufbau wie die
   App-Symbole (Neues Design/symbole-bauen.js), hier ohne Kachel: Raster
   180, Ausschnitt um die Tinte (x 34-147, y 58-123). */
const RS_BOX = "30 54 121 73";
const S_PFAD = "M47 15 C 35 8, 16 12, 18 24 C 20 35, 46 29, 46 41 C 46 53, 29 57, 17 50";
/* <use> braucht x/y/Breite/Hoehe des Ausschnitts - ohne sie legt der Browser
   das Zeichen bei 0/0 an und der Ausschnitt (ab 30/54) schneidet es ab
   (gesehen 08.10.2026: oben links nur ein Rest vom R). */
const zeichen = (extra = "") => { const [x, y, b, h] = RS_BOX.split(" ");
  return `<svg class="zeichen rs" viewBox="${RS_BOX}" aria-hidden="true" ${extra}><use href="#riebRS" x="${x}" y="${y}" width="${b}" height="${h}"/></svg>`; };
const esc = (s) => (typeof escapeHtml === "function" ? escapeHtml(String(s == null ? "" : s)) : String(s == null ? "" : s));
const zwei = (n) => String(n).padStart(2, "0");
const euro = (v) => (Number(v) || 0).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const minuten = (t) => { if (!t) return null; const [h, m] = t.split(":").map(Number); return h * 60 + m; };
const isoVon = (d) => fmtISO(d);
const heuteIso = () => fmtISO(new Date());

/* ---------------- Design: Hell oder Dunkel ----------------
   Mirko 08.10.2026: "für alle gilt das mit dem design wechsel hell oder
   dunkel, das wählen sie aus bevor sie irgendwas anderes auswählen".
     Hell    dunkler Kopf, weisse Blaetter       (Entwurfs-Fassung A)
     Dunkel  alles dunkel wie die Startseite     (Entwurfs-Fassung B)
   Gewaehlt wird ganz am Anfang: als erster Schritt der Ersteinrichtung -
   und wer das Werkzeug schon benutzt, einmal beim naechsten Oeffnen.
   Spaeter umschaltbar unter "Mehr". Gilt je Geraet (wie alle Daten hier),
   fuer Handy und PC gleich - die Breite bestimmt nur die Anordnung. */
const DESIGN_KEY = "rieb_design";
function designGewaehlt() { const d = localStorage.getItem(DESIGN_KEY); return d === "hell" || d === "dunkel" ? d : null; }
function designAnwenden(d) {
  const dunkel = d === "dunkel";
  const r = document.getElementById("rieb"); if (r) r.classList.toggle("dunkel", dunkel);
  /* Die Fenster der alten Fassung (Zeit-Dreh-Rad) haengen nicht in #rieb */
  document.documentElement.classList.toggle("rieb-dunkel", dunkel);
}
function designSetzen(d) { localStorage.setItem(DESIGN_KEY, d); designAnwenden(d); }

/* ---------------- Zustand ---------------- */
let aktuell = null;          // "start", ein EIGENE-Bereich, oder null (alte Oberflaeche)
let gezeigt = null;          // zuletzt angezeigte Werte - fuer das Zaehlwerk
let schnappschuss = { s: 0, j: 0 };
let zeigeTabAltLaeuft = false;

/* ---------------- Daten aus der Live-Fassung ---------------- */
function innen() { return typeof istInnendienst === "function" && istInnendienst(); }
function startLabel() { return innen() ? "Anwesenheit NL Beginn" : "Abfahrt WP"; }
function endLabel() { return innen() ? "Anwesenheit NL Ende" : "Ankunft WP"; }
function standard() {
  if (innen()) return { ab: config.nlVon || "", an: config.nlBis || "" };
  if (config.mitarbeitertyp !== "fahrer") return { ab: config.arbeitsbeginnDefault || "", an: config.arbeitsendeDefault || "" };
  return { ab: config.abfahrtDefault || "", an: config.ankunftDefault || "" };
}
function felderFuer() {
  if (innen()) return { s: "nlVon", e: "nlBis" };
  return config.mitarbeitertyp !== "fahrer" ? { s: "arbeitsbeginn", e: "arbeitsende" } : { s: "abfahrt", e: "ankunft" };
}
function gewaehlt() {
  const m = parseInt(document.getElementById("monthPicker").value, 10) || config.startMonat;
  return { j: config.jahr, m };
}
function jetztMin() { const d = new Date(); return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60; }
function stundenText(h) { return h == null ? "" : (typeof formatHoursDisplay === "function" ? formatHoursDisplay(h) : String(h)) + " Std"; }
function nettoAus(ab, an) {
  const a = minuten(ab), b = minuten(an);
  if (a == null || b == null) return null;
  let n = b - a; if (n < 0) n += 1440;
  return Math.max(0, n - 30);
}
function satzFuer(nettoMin) {
  if (nettoMin == null) return 0;
  return nettoMin > 480 && nettoMin <= 600 ? pauschaleSatz8() : 0;
}

/* Ein Tag, so wie ihn die neue Oberflaeche braucht - gerechnet IMMER von
   computeDay(), also genau wie auf dem Vordruck. */
function tagInfo(d, map) {
  const iso = isoVon(d), h = heuteIso();
  const v = iso < h ? -1 : iso > h ? 1 : 0;
  const fei = map[iso] || null;
  const e = computeDay(d, map);
  const wt = d.getDay();
  if (!e) return { art: "ruhe", iso, d, v, fei, we: true };
  if (e.status === "feiertag") return { art: "ruhe", iso, d, v, fei: fei || e.notiz, we: false };
  if (e.status !== "normal") return { art: "status", status: e.status, iso, d, v };
  const f = felderFuer();
  const ab = innen() ? e.nlVon : e.abfahrt, an = innen() ? e.nlBis : e.ankunft;
  const ov = overrides[iso] || {};
  const eigen = !!(ov[f.s] || ov[f.e]);
  const voraus = !!ov.voraus;
  const std = standard();
  if (!ab || !an) {
    if (v > 0 && std.ab && std.an) return { art: "kommt", iso, d, v, ab: std.ab, an: std.an };
    return { art: "leer", iso, d, v, ab, an, wochenende: wt === 0 || wt === 6 };
  }
  const w = { art: eigen && !voraus ? "eigen" : "standard", iso, d, v, ab, an, orte: e.orte, hours: e.hours,
              satz: e.pauschale || 0, voraus, zeitAuto: e.zeitAuto, lang: e.warnLongHours };
  if (v === 0) {
    /* Der laufende Tag: NUR ANZEIGE (Entscheidung 16). Gerechnet wird er ab
       Tagesbeginn - die Summe enthaelt ihn schon. */
    const jm = jetztMin(), a = minuten(ab), b = minuten(an);
    w.heute = jm < a ? "vor" : jm < b ? "laeuft" : "fertig";
    w.p = jm < a ? 0 : jm < b ? (jm - a) / (b - a) : 1;
  }
  return w;
}

function monatInfo(j, m) {
  const map = feiertage(j, config.bundesland);
  const n = new Date(j, m, 0).getDate();
  const tage = [];
  for (let t = 1; t <= n; t++) tage.push(tagInfo(new Date(j, m - 1, t), map));
  const arbeit = tage.filter((t) => { const wd = t.d.getDay(); return wd !== 0 && wd !== 6 && !map[t.iso]; });
  const cm = computeMonth(j, m);
  const h = heuteIso();
  return { j, m, map, tage, summe: cm.total, spesentage: cm.workdays, arbeitstage: arbeit.length,
           arbeit, tagNr: arbeit.findIndex((t) => t.iso === h) + 1 };
}

function jahrInfos(j) {
  const r = [];
  for (let m = 1; m <= 12; m++) r.push(monatInfo(j, m));
  return r;
}

function kw(d) {
  const x = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const t = x.getUTCDay() || 7; x.setUTCDate(x.getUTCDate() + 4 - t);
  const j1 = new Date(Date.UTC(x.getUTCFullYear(), 0, 1));
  return Math.ceil(((x - j1) / 864e5 + 1) / 7);
}

/* ---------------- Bausteine ---------------- */
const ZIFFERN = "0123456789".split("").map((x) => `<span>${x}</span>`).join("");
function ziffern(text, von) {
  const nd = [...text].filter((c) => /\d/.test(c)).length;
  const alt = von == null ? null : [...von].filter((c) => /\d/.test(c));
  let i = 0;
  return [...text].map((c) => {
    if (!/\d/.test(c)) return `<span class="fz">${c === " " ? "&nbsp;" : c}</span>`;
    const vr = nd - 1 - i; i++;
    const s = alt ? (alt[alt.length - 1 - vr] ?? "0") : "0";
    return `<span class="rz" data-ziel="${c}" style="--z:${s}"><span class="rz-platz">${c}</span><span class="rz-s">${ZIFFERN}</span></span>`;
  }).join("");
}
function zahlEuro(v, von) {
  const [g, k] = euro(v).split(","), a = von == null ? [g, k] : euro(von).split(",");
  return `<span class="z-ganz">${ziffern(g, a[0])}</span><span class="z-rest"><span class="fz">,</span>${ziffern(k, a[1])}<span class="fz">&nbsp;€</span></span>`;
}
function zahlEinheit(v, einheit, von) {
  return `<span class="z-ganz">${ziffern(String(v), String(von == null ? v : von))}</span><span class="z-rest">&nbsp;${einheit}</span>`;
}
function rollenLos(wurzel) {
  if (!wurzel) return;
  const rz = [...wurzel.querySelectorAll(".rz")].filter((r) => r.style.getPropertyValue("--z").trim() !== r.dataset.ziel);
  if (!rz.length) return;
  requestAnimationFrame(() => requestAnimationFrame(() => rz.forEach((r, i) => {
    r.style.setProperty("--d", (i * 60) + "ms"); r.style.setProperty("--z", r.dataset.ziel);
  })));
}
function ring(wert, max, g, s) {
  const r = (g - s) / 2, u = 2 * Math.PI * r, anteil = max > 0 ? Math.max(0, Math.min(1, wert / max)) : 0, off = u * (1 - anteil);
  return `<svg class="ring" width="${g}" height="${g}" viewBox="0 0 ${g} ${g}" aria-hidden="true">
    <circle cx="${g / 2}" cy="${g / 2}" r="${r}" fill="none" stroke="rgba(255,255,255,.1)" stroke-width="${s}"/>
    <circle class="ring-wert" cx="${g / 2}" cy="${g / 2}" r="${r}" fill="none" stroke="url(#riebRing)" stroke-width="${s}" stroke-linecap="round"
      stroke-dasharray="${u.toFixed(2)}" stroke-dashoffset="${off.toFixed(2)}" transform="rotate(-90 ${g / 2} ${g / 2})" style="--u:${u.toFixed(2)}"/></svg>`;
}
function segmente(info, erscheint) {
  return `<div class="segmente${erscheint ? " erscheint" : ""}" style="--n:${Math.max(1, info.arbeit.length)}" aria-hidden="true">${info.arbeit.map((t, i) => {
    const w = info.tage.find((x) => x.iso === t.iso) || t;
    let c = "leer", p = "";
    if (w.art === "status") c = w.v <= 0 ? "abw" : "leer";
    else if (w.heute === "laeuft" || w.heute === "vor") { c = "laeuft seg-heute"; p = `;--p:${(w.p || 0).toFixed(3)}`; }
    else if ((w.art === "standard" || w.art === "eigen") && (w.v <= 0 || w.voraus)) c = w.satz ? (w.voraus ? "voll voraus" : "voll") : "kurz";
    if (w.heute === "fertig") c += " heute seg-heute";
    return `<i class="seg ${c}" style="--i:${i}${p}"></i>`;
  }).join("")}</div>`;
}

/* ---------------- Grundgeruest ---------------- */
function geruestBauen() {
  if (document.getElementById("rieb")) return;
  const r = document.createElement("div");
  r.id = "rieb";
  r.innerHTML = `
  <svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
    <linearGradient id="riebS" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#C9F0FF"/><stop offset=".55" stop-color="#5CCBFA"/><stop offset="1" stop-color="#0EA5E9"/></linearGradient>
    <linearGradient id="riebRing" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#BBF7D0"/><stop offset="1" stop-color="#22C55E"/></linearGradient>
    <symbol id="riebRS" viewBox="${RS_BOX}"><text x="26" y="123" font-family="Geist" font-weight="660" font-size="92" fill="#F2F4F7">R</text><g transform="translate(80 48) scale(1.3)"><path d="${S_PFAD}" fill="none" stroke="url(#riebS)" stroke-width="9.5" stroke-linecap="round"/></g></symbol>
  </defs></svg>
  <div id="korn" aria-hidden="true"></div>
  <section id="s-start" class="screen" aria-label="Start"></section>
  ${EIGENE.map((b) => `<section id="s-${b}" class="screen bereich" aria-label="${b}"></section>`).join("")}
  <div id="ebene" class="ebene" hidden>
    <div class="ebene-dunkel" data-zu></div>
    <div class="bogen" role="dialog" aria-modal="true"><div class="griff"></div><div id="bogenInhalt"></div></div>
  </div>
  <div id="toast" role="status"></div>
  <div id="einrichtung" class="einrichtung" hidden>
    <div class="er-kopf"><button class="rund" id="erZurueck" aria-label="Zurück">${ic("zurueck")}</button><div class="er-schritte" id="erSchritte"></div><span style="width:42px"></span></div>
    <div class="er-inhalt" id="erInhalt"></div>
    <div class="er-fuss"><button class="haupt-knopf hell" id="erWeiter">Weiter</button><button class="er-spaeter" id="erSpaeter" hidden>Später eintragen</button></div>
  </div>`;
  document.body.appendChild(r);
  designAnwenden(designGewaehlt() || "hell");
  document.getElementById("erWeiter").addEventListener("click", () => erWeiter(false));
  document.getElementById("erSpaeter").addEventListener("click", () => erWeiter(true));
  document.getElementById("erZurueck").addEventListener("click", () => { erLesen(); if (erSchritt > 0) { erSchritt--; erZeigen("zurueck"); } });
  document.getElementById("einrichtung").addEventListener("keydown", (ev) => { if (ev.key === "Enter" && ev.target.tagName === "INPUT" && ev.target.type !== "date") erWeiter(false); });
  document.getElementById("einrichtung").addEventListener("click", (ev) => {
    const t = ev.target.closest("button"); if (!t) return;
    if (t.dataset.erolle) { ER.rolle = t.dataset.erolle; document.querySelectorAll("#einrichtung [data-erolle]").forEach((b) => b.classList.toggle("an", b === t)); }
    if (t.dataset.edesign) { ER.design = t.dataset.edesign; document.querySelectorAll("#einrichtung [data-edesign]").forEach((b) => b.classList.toggle("an", b === t)); }
    if (t.dataset.eherkunft) { ER.herkunft = t.dataset.eherkunft; erZeigen(); }
    if (t.dataset.evorjahr) { erLesen(); ER.vorjahr = t.dataset.evorjahr; erZeigen(); }
    if (t.dataset.eurlaub) { erLesen(); ER.hatteUrlaub = t.dataset.eurlaub === "ja"; if (ER.hatteUrlaub && !ER.urlaub.length) ER.urlaub.push({ von: "", bis: "" }); erZeigen(); }
    if (t.hasAttribute("data-ezeitraum")) { erLesen(); ER.urlaub.push({ von: "", bis: "" }); erZeigen(); }
    /* Mitteilungen (11.10.2026): "Aktivieren" fragt SOFORT das Geraet - die
       Erlaubnis-Frage muss direkt aus dem Tipp kommen (iPhone). Eingeschaltet
       wird beim Tipp auf "Los geht's", wenn die Einrichtung gespeichert ist. */
    if (t.dataset.emitteilung) {
      ER.mitteilung = t.dataset.emitteilung; erZeigen();
      if (ER.mitteilung === "ja") mtErlaubnis().then((e) => { if (e !== "granted") { ER.mitteilung = "nein"; erZeigen(); toast("Ohne Ihre Erlaubnis keine Mitteilungen – später unter „Mehr“ möglich"); } });
    }
  });
  r.querySelectorAll(".bereich").forEach((s) => s.addEventListener("scroll", () => kopfScroll(s), { passive: true }));
  r.addEventListener("click", klick);
  /* Eingaben in "Neue Ware zaehlen" (Zeilen und Lieferschein) */
  r.addEventListener("input", (ev) => {
    const el = ev.target;
    if (el.dataset && el.dataset.wkae !== undefined) return wareEingabe(el);
    if (el.id === "iSprache") return invSpracheEingabe(el);                 /* Fahrzeug-Inventur: Zählen per Sprache */
    if (el.id === "wSprache") return wareSpracheEingabe(el);                /* Neue Ware zählen: Zählen per Sprache */
    if (el.dataset && el.dataset.ii !== undefined) return invEingabe(el);   /* Fahrzeug-Inventur: Zeilen */
    if (el.dataset && el.dataset.vbfuss) return vbFussEingabe(el);          /* Fahrzeug-Inventur: Fuss des Blattes */
    if (el.id === "wLieferschein") { kaeState.lieferschein = el.value; kaeSichern(); wareAuffrischen(); }  });
  r.addEventListener("pointermove", (ev) => {
    const k = ev.target.closest && ev.target.closest(".kachel"); if (!k) return;
    const b = k.getBoundingClientRect(); k.style.setProperty("--mx", (ev.clientX - b.left) + "px"); k.style.setProperty("--my", (ev.clientY - b.top) + "px");
  }, { passive: true });
  document.addEventListener("keydown", (ev) => { if (ev.key === "Escape") schliesseEbene(); });
  /* iPhone (14.10.2026): Nach dem Schließen der Tastatur bleibt die Seite manchmal hochgeschoben.
     Die neuen Bildschirme scrollen in sich selbst, nie das Fenster - also zurück auf 0 (Vorhang
     und Grund siehe rieb.css „iPhone mit offener Tastatur“). */
  document.addEventListener("focusout", () => {
    if (!document.body.classList.contains("rieb-aktiv")) return;
    setTimeout(() => { const a = document.activeElement; if ((!a || a === document.body) && (window.scrollY || window.scrollX)) window.scrollTo(0, 0); }, 60);
  });
}

/* ---------------- Startseite ---------------- */
function heuteKarte() {
  const h = new Date(), map = feiertage(h.getFullYear(), config.bundesland);
  const w = tagInfo(h, map);
  let kl = "", kopf = "", band = "", fuss = "";
  if (w.art === "ruhe" || w.art === "status") {
    kl = "frei"; kopf = w.art === "status" ? ARTEN[w.status] : (w.fei ? w.fei : "Frei");
    fuss = `<span>${w.art === "status" ? "Kein Spesentag" : (w.fei ? "Feiertag" : "Wochenende")}</span>`;
  } else if (w.art === "leer") {
    kl = "frei"; kopf = "Noch keine Zeiten";
    fuss = `<span>Einmal „Zeiten für alle Tage“ eintragen – dann läuft jeder Tag mit</span><span class="aendern">Antippen</span>`;
  } else {
    kl = w.heute;
    kopf = w.heute === "fertig" ? "Erledigt" : w.heute === "laeuft" ? "Läuft" : "Beginnt " + w.ab;
    band = `<div class="h-band"><span>${w.ab}</span><div class="h-bahn"><div class="h-fuell"></div><div class="h-jetzt"></div></div><span>${w.an}</span></div>`;
    fuss = w.heute === "fertig"
      ? `<span>${stundenText(w.hours)} · <b>${w.satz ? "+" + euro(w.satz) + " €" : "keine Pauschale"}</b></span><span class="aendern">Ändern ›</span>`
      : `<span>${w.art === "eigen" ? "Ihre Zeiten für heute" : "Automatisch mit Ihren Standardzeiten"}</span><span class="aendern">Ändern ›</span>`;
  }
  return `<button class="kachel k-heute ${kl}" id="kHeute" data-tag="${w.iso}" style="--p:${(w.p || 0).toFixed(4)}">
    <span class="k-grund"></span>
    <span class="h-kopf"><span class="live-punkt"></span><span>Heute · ${esc(kopf)}</span><span class="rechts">${WT[h.getDay()]} ${h.getDate()}. ${MON_K[h.getMonth()]}</span></span>
    ${band}<span class="h-fuss">${fuss}</span></button>`;
}

/* ---------------- Start/Stopp-Karte (12.10.2026) ----------------
   Mirko: eine eigene Karte unter Gruss und Spruch, damit die Arbeitszeit
   ohne Umweg ueber "Zeit" gestempelt wird - NUR fuer ihn. Bewusst istMirko()
   und nicht zeigtZeit()/tabErlaubt("zeit"): das schliesst die Zeit-Kollegen
   (ZEIT_EXTRA_NAMEN) mit ein.
     nicht gestartet  "Arbeitstag starten" - Tipp stempelt sofort
     laeuft           "Feierabend" + "Laeuft seit 06:12 · 2:31 Std." - Tipp
                      fragt vorher nach (Bogen "Feierabend stempeln?")
   Gespeichert und gerechnet wird NUR ueber AZ / azStempeln() der Live-Fassung
   (dieselbe Uhr wie unter "Zeit") - keine zweite Uhr, keine neuen Daten. */
function stempelZeile() {
  if (!AZ.lauf) return "";
  const min = Math.max(0, Math.floor((Date.now() - new Date(AZ.lauf).getTime()) / 60000));
  return "Läuft seit " + azUhrzeit(AZ.lauf) + " · " + azHhmm(min) + " Std.";
}
function stempelKarte() {
  if (!istMirko()) return "";
  const l = !!AZ.lauf;
  return `<button class="kachel k-stempel${l ? " laeuft" : ""}" id="kStempel" data-aktion="stempel-karte">
      <span class="k-grund"></span>
      <span class="k-ic">${ic(l ? "uhr" : "start")}</span>
      <span class="k-text"><span class="k-titel">${l ? "Feierabend" : "Arbeitstag starten"}</span>${l ? `<span class="k-unter"><span class="live-punkt"></span><span id="kStempelZeile">${esc(stempelZeile())}</span></span>` : ""}</span>
      <span class="k-pfeil">${ic("vor")}</span>
    </button>`;
}
/* Jede Sekunde (takt): nur den Text der Zeile ersetzen, nichts neu zeichnen */
function stempelTakt() {
  const z = stempelZeile();
  for (const id of ["kStempelZeile", "kStempelFrageZeile"]) {
    const el = document.getElementById(id);
    if (el && z && el.textContent !== z) el.textContent = z;
  }
}
/* Tipp auf die Karte. Entschieden wird nach dem ECHTEN Stand (AZ.lauf), nicht
   nach dem, was die Karte gerade zeigt - die Zeit kann inzwischen woanders
   gestempelt worden sein. */
function stempelKarteTipp() {
  if (!istMirko()) return;
  if (AZ.lauf) return oeffneStempelFrage();
  azStempeln();
  stempelNeuZeichnen();
  if (AZ.lauf) toast("Arbeitsbeginn " + azUhrzeit(AZ.lauf));
}
function oeffneStempelFrage() {
  oeffneEbene(`${bogenKopf(`<span id="kStempelFrageZeile">${esc(stempelZeile())}</span>`, "Feierabend stempeln?")}
    <div class="ja-nein">
      <button class="haupt-knopf" data-aktion="stempel-ja">Ja, Feierabend</button>
      <button class="haupt-knopf nein" data-zu>Nein</button>
    </div>`);
}
function stempelJa() {
  schliesseEbene();
  if (!istMirko()) return;
  /* Lief inzwischen nichts mehr (woanders beendet): azStempeln() wuerde
     jetzt einen NEUEN Tag starten - das darf "Ja, Feierabend" nie tun. */
  if (!AZ.lauf) { stempelNeuZeichnen(); return; }
  const vorher = AZ.tage.length;
  azStempeln();
  stempelNeuZeichnen();
  /* Unter einer Minute verwirft azStempeln() den Lauf (mit eigener Meldung) -
     dann wurde nichts gespeichert und es gibt auch keinen Erfolgshinweis. */
  if (!AZ.lauf && AZ.tage.length > vorher) toast("Feierabend · gespeichert");
}
function stempelNeuZeichnen() {
  const hatFokus = document.activeElement && document.activeElement.id === "kStempel";
  renderStart({});
  if (hatFokus) { const k = document.getElementById("kStempel"); if (k) k.focus(); }
}

function renderStart(opt = {}) {
  const h = new Date(), J = h.getFullYear(), M = h.getMonth() + 1;
  const info = monatInfo(J, M);
  const anspruch = urlaubGilt(J), gesamt = anspruch.anspruch + anspruch.uebertrag;   // mit automatischem Uebertrag (09.10.2026)
  const rest = urlaubRestFuer(J);
  const infos = jahrInfos(J), js = infos.reduce((s, x) => s + x.summe, 0);
  const von = opt.ausNull ? { s: 0, r: 0, j: 0 } : (opt.rollen && gezeigt) ? gezeigt : { s: info.summe, r: rest, j: js };
  gezeigt = { s: info.summe, r: rest, j: js };
  const maxM = Math.max(1, ...infos.map((x) => x.summe));
  const funken = infos.map((x, i) => { const hoehe = i + 1 > M ? 12 : Math.max(10, x.summe / maxM * 100);
    return `<i class="${i + 1 === M ? "jetzt" : i + 1 > M ? "spaeter" : ""}" style="height:${hoehe}%;--i:${i}"></i>`; }).join("");
  const naechster = MON[M % 12];
  const unter = info.tagNr
    ? `Arbeitstag ${info.tagNr} von ${info.arbeitstage} · Abgabe bis 3. Werktag im ${naechster}`
    : `${info.spesentage} Spesentage · Abgabe bis 3. Werktag im ${naechster}`;
  const vorname = (config.name || "").trim().split(/\s+/)[0] || "";
  const e = opt.auftritt;
  /* Mirkos eigene Bereiche */
  /* [Ziel, Symbol, Titel, Weg]: "alt" = alte Oberflaeche, "neu" = rieb */
  const sonder = [];
  if (tabErlaubt("inventur")) sonder.push(["inventur", "lkw", "Fahrzeug-Inventur", "neu"]);
  if (tabErlaubt("ware")) sonder.push(["ware", "kiste", "Neue Ware zählen", "neu"]);
  if (tabErlaubt("zeit")) sonder.push(["zeit", "uhr", "Zeit", "neu"]);
  if (tabErlaubt("stoerungen")) sonder.push(["stoerungen", "warnung", "Störungsliste", "neu"]);
  document.getElementById("s-start").innerHTML = `
  <div class="start-innen">
    <header class="start-kopf">
      <div class="marke">${zeichen('id="kopfZeichen"')}<span class="wortmarke" id="kopfWort">Rieb Spesen</span></div>
    </header>
    <div class="gruss-zeile">
      <h1 class="gruss"><span class="leise" id="riebGruss">${tagesGruss()},</span>${vorname ? "<br>" + esc(vorname) : ""}</h1>
      <div class="uhr" aria-label="Uhrzeit"><div class="uhr-zeit"><span id="uhrH">--</span><span class="dp">:</span><span id="uhrM">--</span><span class="uhr-s" id="uhrS">--</span></div>
        <div class="uhr-datum">${WT[h.getDay()]} ${h.getDate()}. ${MON_K[h.getMonth()]} · KW ${kw(h)}</div></div>
    </div>
    <p class="gruss-spruch" id="riebSpruch" data-tag="${heuteIso()}">${esc(tagesSpruchMit(h).text)}</p>
    ${stempelKarte()}
    <div class="bento">
      <button class="kachel k-spesen" data-ziel="spesen" data-heute="1">
        <span class="k-grund"></span>
        <span class="k-kopf"><span class="k-ic">${ic("datei")}</span><span class="k-titel">Spesen</span><span class="k-meta">${MON[M - 1]} ${J}</span></span>
        <span class="k-mitte">
          <span class="zahl" aria-label="${euro(info.summe)} Euro">${zahlEuro(info.summe, von.s)}</span>
          <span class="k-unter">${unter}</span>
        </span>
        ${segmente(info, e)}
      </button>
      ${heuteKarte()}
      <button class="kachel k-urlaub" data-ziel="urlaub">
        <span class="k-grund"></span>
        <span class="k-oben"><span class="k-titel">Urlaub</span>${ring(rest, gesamt, 58, 7)}</span>
        <span><span class="zahl" aria-label="${rest} Tage">${zahlEinheit(rest, "Tage", von.r)}</span><span class="k-unter" style="display:block;margin-top:6px">übrig von ${gesamt}</span></span>
      </button>
      <button class="kachel k-jahr" data-ziel="jahr">
        <span class="k-grund"></span>
        <span class="k-titel">Jahresübersicht</span>
        <span class="funken${e ? " erscheint" : ""}" aria-hidden="true">${funken}</span>
        <span><span class="zahl" aria-label="${euro(js)} Euro">${zahlEuro(js, von.j)}</span><span class="k-unter" style="display:block;margin-top:6px">Spesen ${J} bis heute</span></span>
      </button>
      ${sonder.length ? `<div class="mini-reihe sonder${sonder.length === 4 ? " vier" : ""}">${sonder.map(([z, i, t, weg]) =>
        `<button class="kachel k-mini" ${weg === "neu" ? "data-ziel" : "data-alt"}="${z}"><span class="k-grund"></span><span class="k-ic">${ic(i)}</span><span class="k-titel">${t}</span></button>`).join("")}</div>` : ""}
      <div class="mini-reihe">
        <button class="kachel k-mini" data-ziel="anleitung"><span class="k-grund"></span><span class="k-ic">${ic("start")}</span><span class="k-titel">Anleitung</span></button>
        <button class="kachel k-mini" data-ziel="mehr"><span class="k-grund"></span><span class="k-ic">${ic("punkte")}</span><span class="k-titel">Mehr</span></button>
        <button class="kachel k-mini k-app" data-bogen="app"><span class="k-grund"></span><span class="k-ic">${ic("handy")}</span><span class="k-titel">Als App</span></button>
      </div>
    </div>
    <p class="start-fuss">${startFuss()}</p>
  </div>`;
  if (!e) document.querySelectorAll("#s-start .ring-wert").forEach((x) => { x.style.animation = "none"; });
  uhrStellen();
}

/* ---------------- Bereichskopf ---------------- */
/* Die Leiste (PC). Mirkos Bereiche in der Reihenfolge des Entwurfs. Ein
   Eintrag "alt:<bereich>" fuehrte in die alte Oberflaeche (data-alt) - seit
   08.10.2026 abends hat keiner mehr einen. */
function navListe() {
  const n = [["start", "Start"], ["spesen", "Spesen"]];
  if (tabErlaubt("inventur")) n.push(["inventur", "Inventur"]);
  if (tabErlaubt("ware")) n.push(["ware", "Ware"]);
  if (tabErlaubt("zeit")) n.push(["zeit", "Zeit"]);
  if (tabErlaubt("stoerungen")) n.push(["stoerungen", "Störungen"]);
  return n.concat([["urlaub", "Urlaub"], ["jahr", "Jahresübersicht"], ["mehr", "Mehr"], ["anleitung", "Anleitung"]]);
}
function kopf(bereich, titel, { zahl = "", label = "", unter = "", rechts = "", nachZahl = "", unten = "", mini = "", miniRechts = "", kompakt = false } = {}) {
  return `<div class="mini-kopf"><div class="mk-innen"><button class="rund klein" data-zurueck aria-label="Zurück zur Startseite">${ic("zurueck")}</button>
      <div class="mk-text"><b>${titel}</b>${mini ? `<span>${mini}</span>` : ""}</div>${miniRechts}</div></div>
    <header class="b-kopf${kompakt ? " kompakt" : ""}"><span class="b-grund"></span><div class="b-innen">
    <div class="b-leiste">
      <button class="rund" data-zurueck aria-label="Zurück zur Startseite">${ic("zurueck")}</button>
      <nav class="b-nav">${navListe().map(([z, t]) => z.indexOf("alt:") === 0
        ? `<button data-alt="${z.slice(4)}">${t}</button>`
        : `<button data-nav="${z}" class="${z === bereich ? "an" : ""}">${t}</button>`).join("")}</nav>
      <span style="width:42px"></span>
    </div>
    <div class="b-titelzeile"><h2 class="b-titel">${titel}</h2>${rechts}</div>
    ${zahl ? `<div class="b-zahlzeile"><div><span class="zahl b-zahl" aria-label="${label}">${zahl}</span><div class="b-unter">${unter}</div></div>${nachZahl}</div>`
           : `<div class="b-zahlzeile"><div class="b-unter" style="margin-top:6px">${unter}</div></div>`}
    ${unten}
  </div></header>`;
}
function kopfScroll(sek) {
  const k = sek.querySelector(".b-kopf"); if (!k || !k.offsetHeight) return;
  const st = sek.scrollTop, p = Math.min(1, st / 220);
  const z = sek.querySelector(".b-zahlzeile");
  if (z) { z.style.transform = p ? `translateY(${p * 22}px) scale(${1 - p * 0.1})` : ""; z.style.opacity = p ? String(1 - p * 0.85) : ""; }
  sek.classList.toggle("eng", st > k.offsetHeight - 76);
}

/* ---------------- Spesen ---------------- */
function zeileTag(t) {
  const nr = zwei(t.d.getDate()), wt = WT[t.d.getDay()];
  const datum = `<span class="t-datum"><span class="t-wt">${wt}</span><span class="t-nr">${nr}</span></span>`;
  /* Wochenende und Feiertag: schmale Zeile - antippbar, damit sich auch ein
     Samstag als Arbeitstag eintragen laesst (in der alten Fassung der Knopf
     "+ Samstag" im Vordruck). */
  if (t.art === "ruhe") return `<button class="ruhe" data-tag="${t.iso}"><b>${wt} ${nr}</b>${t.fei ? `<span class="chip feiertag">${esc(t.fei)}</span>` : "Wochenende"}</button>`;
  if (t.art === "status") {
    const c = `<span class="chip ${t.status}">${ARTEN[t.status] || t.status}</span>`;
    return `<button class="tag${t.v === 0 ? " heute" : ""}" data-tag="${t.iso}">${datum}<span class="t-zeit"><span class="t-ab">${c}</span><span class="t-pfeil"></span><span class="t-an"></span></span><span class="t-orte"></span><span class="t-std"></span><span class="t-betrag null">–</span><span class="t-status">${c}</span></button>`;
  }
  if (t.art === "leer") return `<button class="tag kommt" data-tag="${t.iso}">${datum}<span class="t-zeit"><span class="t-ab">${ic("plus")} Zeiten eintragen</span><span class="t-pfeil"></span><span class="t-an"></span></span><span class="t-orte"></span><span class="t-std"></span><span class="t-betrag"></span><span class="t-status"></span></button>`;
  if (t.art === "kommt") return `<button class="tag kommt" data-tag="${t.iso}">${datum}<span class="t-zeit"><span class="t-ab">${t.ab}</span><span class="t-pfeil">→</span><span class="t-an">${t.an}</span></span><span class="t-orte"></span><span class="t-std"></span><span class="t-betrag">läuft mit</span><span class="t-status"></span></button>`;
  const heute = t.heute ? ` heute ${t.heute}` : "";
  const marke = t.voraus ? `<span class="t-marke">vorausgefüllt</span>` : t.art === "eigen" ? `<span class="t-marke">eigene Zeiten</span>` : "";
  const status = t.heute ? `<span class="chip heute">${t.heute === "fertig" ? "Heute" : "läuft"}</span>` : (t.lang ? `<span class="chip krank">über 10 Std</span>` : "");
  return `<button class="tag${heute}${t.lang ? " zulang" : ""}" data-tag="${t.iso}">${datum}<span class="t-zeit"><span class="t-ab">${t.ab}</span><span class="t-pfeil">→</span><span class="t-an">${t.an}</span></span><span class="t-orte">${esc(t.orte || "")}${marke}</span><span class="t-std">${stundenText(t.hours)}</span><span class="t-betrag${t.satz ? "" : " null"}">${euro(t.satz)} €</span><span class="t-status">${status}</span>${t.heute === "laeuft" || t.heute === "vor" ? `<span class="t-lauf" style="--p:${(t.p || 0).toFixed(4)}"></span>` : ""}</button>`;
}

/* ---------------- Einstellungen im Spesen-Bereich ----------------
   Entwurf 2, freigegeben 09.10.2026 (Mirko: "ich denke entwurf 2 past").
   Mirko: "einstellung steuert ja spesen, deshalb gehört es zu spesen dazu
   und nicht alleine stehend" und am 27.09.: "gleich von anfang an da …
   direkt nach den stammdaten". Dazu (34/35): "das man checkt da muss ich
   alles einstellen" und "zurücksetzen und korrigierungen einzelner
   funktionen". Entwurf: Neues Design/einstellungen-entwurf-2.html */
function einstellungenStand() {
  const std = standard();
  const s = {
    zeiten: !!(std.ab && std.an),
    daten: !!((config.name || "").trim() && (config.niederlassung || "").trim() && config.bundesland),
    arbeitstag: true,                                   // hat immer Vorgaben
    pauschalen: Number(config.pauschale8) > 0 && Number(config.pauschale24) > 0,
  };
  /* Monteur Innendienst: seine "Zeiten fuer alle Tage" SIND die NL-Zeiten
     (szFelder in index.html) - eine eigene NL-Karte waere doppelt. */
  if (!innen()) s.nl = true;
  const werte = Object.values(s);
  s.fertig = werte.filter(Boolean).length; s.gesamt = werte.length;
  return s;
}
function eStatus(ok) {
  return ok ? `<span class="e-status ok">${ic("haken")}eingerichtet</span>` : `<span class="e-status fehlt">${ic("warn")}fehlt noch</span>`;
}
/* Seit 09.10.2026 abends ein GESCHLOSSENER BLOCK wie die Gruppen unter "Mehr"
   (Entscheidung 43). Mirko: "rechts die ganzen einstell dinge als geschlossene
   tabelle bzw abgegrenzte 'eigene' funktion optisch besser darstellen?" - zum
   Entwurf (Neues Design/spesen-tabelle-entwurf.html): "das jeweils rechte bild
   sieht immer besser aus". Vorher vier Karten mit allen Werten (~1.300 px rechts
   am PC). Jetzt je Teil EINE Zeile mit kurzem Wert, Haken / "fehlt noch" und
   Pfeil; ein Tipp oeffnet denselben Bogen wie bisher (data-bogen / data-teil
   unveraendert). Die vollstaendigen Werte stehen im Bogen. */
function einstellungenBlock(s, d) {
  const anAus = (x) => (x ? "an" : "aus");
  const eur = (x) => euro(Number(x) || 0) + " €";
  const kurz = (...t) => t.filter((x) => x && String(x).trim()).join(" · ");
  const marke = (ok) => (ok ? `<span class="e-ok" aria-label="eingerichtet">${ic("haken")}</span>` : `<span class="e-fehlt">fehlt noch</span>`);
  const zeile = (attr, icon, titel, wert, ok) => `<button class="zeile${ok === false ? " fehlt" : ""}" ${attr}><span class="z-ic">${ic(icon)}</span><span class="z-text">${titel}<small>${esc(wert)}</small></span><span class="rechts">${marke(ok)}${ic("vor")}</span></button>`;
  const nlTag = (NL_TAGE.find(([v]) => v === String(config.nlTag)) || [null, "–"])[1];
  const datenWert = kurz((config.name || "").trim() || "Name fehlt", d.rolle, d.land, tabErlaubt("inventur") && config.tour ? "Tour " + config.tour : "");
  const arbeitWert = kurz(config.zeitenVariieren ? "Jeden Tag anders" : "Jeden Tag gleich", "Samstag " + anAus(config.samstagAktiv), innen() ? "" : config.orteDefault);
  const nlWert = config.nlAktiv ? `${nlTag} · ${config.nlVon || "–"}–${config.nlBis || "–"}` : "Fester Wochentag: aus";
  const pauschWert = kurz(eur(config.pauschale8), eur(config.pauschale24), "Gehalt " + eur(config.bezahltDefault));
  /* Eingetragene Abwesenheiten: die Live-Rechnung computeAbsenceRanges(),
     neueste zuerst. Gezaehlt wie beim Urlaub: Mo-Fr ohne Feiertage. */
  const dm = (iso) => iso.slice(8, 10) + "." + iso.slice(5, 7) + ".";
  const ferien = {};
  const zaehle = (von, bis) => { let n = 0; eachDateInRange(von, bis, (iso) => { const j = +iso.slice(0, 4); ferien[j] = ferien[j] || feiertage(j, config.bundesland); if (urlaubZaehltTag(iso, ferien[j])) n++; }); return n; };
  const bereiche = (typeof computeAbsenceRanges === "function" ? computeAbsenceRanges() : []).slice().reverse();
  const abw = bereiche.length ? bereiche.map((r) => {
    const art = STATUS_LABELS[r.status] || r.status, n = zaehle(r.von, r.bis);
    const wann = r.von === r.bis ? dm(r.von) + r.von.slice(0, 4) : dm(r.von) + "–" + dm(r.bis) + r.bis.slice(0, 4);
    return `<div class="e-zeitraum"><span class="e-art ${r.status}">${art}</span><span class="wann">${wann} · ${n} ${n === 1 ? "Tag" : "Tage"}</span><button class="e-x" data-aktion="abw-weg" data-von="${r.von}" data-bis="${r.bis}" data-abwart="${esc(art)}" aria-label="${esc(art)} ${wann} herausnehmen">${ic("x")}</button></div>`;
  }).join("") : "";
  return `<div class="e-block">
    <div class="gruppe e-einst"><div class="gruppe-titel e-gtitel"><span>Einstellungen für Ihren Spesennachweis</span><span class="e-zahl${s.fertig < s.gesamt ? " offen" : ""}">${s.fertig} von ${s.gesamt} eingerichtet</span></div><div class="liste">
      ${zeile('data-bogen="stamm"', "datei", "Ihre Daten", datenWert, s.daten)}
      ${zeile('data-bogen="einstellungen" data-teil="arbeitstag"', "uhr", "Arbeitstag", arbeitWert, s.arbeitstag)}
      ${"nl" in s ? zeile('data-bogen="einstellungen" data-teil="nl"', "haus", "Anwesenheit in der Niederlassung", nlWert, s.nl) : ""}
      ${zeile('data-bogen="einstellungen" data-teil="pauschalen"', "regler", "Pauschalen & Gehalt", pauschWert, s.pauschalen)}
    </div></div>
    <div class="gruppe e-korr"><div class="gruppe-titel">Korrigieren & zurücksetzen</div><div class="liste">
      <div class="zeile e-abw"><span class="z-ic">${ic("kalender")}</span><span class="z-text">Eingetragene Abwesenheiten<small>${bereiche.length
        ? "Ein Tipp auf ✕ nimmt den ganzen Zeitraum heraus – in einem abgeschlossenen Monat zuerst „Wieder öffnen“"
        : "Keine Abwesenheiten eingetragen."}</small></span></div>
      ${bereiche.length ? `<div class="e-abw-liste">${abw}</div>` : ""}
      <button class="zeile gefahr" data-aktion="spesen-zuruecksetzen"><span class="z-ic">${ic("muell")}</span><span class="z-text">Spesen-Einträge zurücksetzen<small>Eigene Zeiten, Orte und Notizen – abgeschlossene Monate bleiben. Vorher wird eine Sicherung gespeichert.</small></span><span class="rechts">${ic("vor")}</span></button>
    </div></div>
  </div>`;
}

function renderSpesen(opt = {}) {
  const { j, m } = gewaehlt();
  const info = monatInfo(j, m);
  const jetzt = new Date(), istLaufend = j === jetzt.getFullYear() && m === jetzt.getMonth() + 1;
  const wahl = `<div class="monat-wahl"><button data-monat="-1" aria-label="Voriger Monat">${ic("zurueck")}</button><span>${MON[m - 1]} ${j}</span><button data-monat="1" aria-label="Nächster Monat">${ic("vor")}</button></div>`;
  let wochen = [], w = null;
  info.tage.forEach((t) => { if (!w || t.d.getDay() === 1) { w = { tage: [] }; wochen.push(w); } w.tage.push(t); });
  const offen = istLaufend ? vorausTage() : [];
  const gefuellt = istLaufend ? vorausGefuellte().filter((iso) => iso.startsWith(j + "-" + zwei(m))).sort() : [];
  const bannerK = gefuellt[0] || offen[0] || null;
  const tm = (k) => k.slice(8, 10) + "." + k.slice(5, 7) + ".";
  /* Abgeschlossener Monat = gesperrt (Entscheidung 22): dann weder
     „Rest des Monats mitfüllen“ noch „rückgängig“ anbieten - beides
     schrieb bis 09.10.2026 in den gesperrten Monat (Teil C, sperre-app-pruefen). */
  const monatZu = !!localStorage.getItem(monthSubmittedKey(j, m));
  const banner = monatZu ? "" : gefuellt.length
    ? `<div class="voraus gefuellt"><span>${gefuellt.length} Tage vorausgefüllt</span><button data-voraus="zurueck">rückgängig</button></div>`
    : offen.length ? `<div class="voraus"><span>Ab ${tm(offen[0])} noch nicht erfasst</span><button data-voraus="fuellen">Rest des Monats mitfüllen</button></div>` : "";
  const wochenHTML = wochen.map((wo) => {
    const a = wo.tage[0].d, e = wo.tage[wo.tage.length - 1].d;
    const arb = wo.tage.filter((t) => { const wd = t.d.getDay(); return wd !== 0 && wd !== 6 && !info.map[t.iso]; });
    const summe = wo.tage.reduce((s, t) => s + ((t.art === "standard" || t.art === "eigen") ? (t.satz || 0) : 0), 0);
    const fertig = arb.filter((t) => t.v <= 0 || t.voraus).length;
    const anteil = arb.length ? fertig / arb.length : 0;
    return `<div class="woche"><div class="woche-kopf"><span>KW ${kw(a)} · ${a.getDate()}.–${e.getDate()}. ${MON_K[a.getMonth()]}</span>${arb.length ? `<span class="w-balken"><i style="width:${anteil * 100}%"></i></span>` : ""}<span class="w-summe">${summe ? euro(summe) + " €" : "–"}</span></div>${wo.tage.map((t) => (t.iso === bannerK ? banner : "") + zeileTag(t)).join("")}</div>`;
  }).join("");
  const std = standard(), n = nettoAus(std.ab, std.an);
  const gesperrtAm = localStorage.getItem(monthSubmittedKey(j, m));
  const mirko = zeigtDigitaleAbgabe();
  const unter = istLaufend && info.tagNr
    ? `Arbeitstag ${info.tagNr} von ${info.arbeitstage} · ${gefuellt.length ? "Rest vorausgefüllt" : "läuft automatisch mit"}`
    : `${info.spesentage} Spesentage · ${info.arbeitstage} Arbeitstage`;
  const sek = document.getElementById("s-spesen");
  const scroll = sek.scrollTop;
  /* Die fuenf Griffe: Drucken zuerst (die Abgabe ist der Ausdruck), dazu
     "Abschliessen" - steht nicht im Entwurf, gehoert aber dazu (Mirko
     08.10.2026: "Spesen monat abschließen damit er gespeichert wird"). */
  const schnell = [
    ["drucken", "drucker", "Drucken", "erst"],
    ["ansehen", "auge", "PDF ansehen", ""],
    ["speichern", "laden", "PDF speichern", ""],
    ["abschliessen", "schloss", "Abschließen", ""],
    ["abwesenheit", "kalender", "Abwesenheit", ""],
  ];
  /* "Per E-Mail" (bis 08.10.2026 nur Mirko) ist raus - Mirko: "funktion
     via email senden kann ganz raus das wird nicht geduldet". */
  const name = (config.name || "").trim() || "Name eintragen";
  const ort = [config.strasse, config.ort].filter(Boolean).join(" · ") || "Adresse eintragen";
  const land = (typeof BUNDESLAENDER === "object" && BUNDESLAENDER[config.bundesland]) || config.bundesland || "";
  const rolle = (ROLLEN[config.mitarbeitertyp] || ROLLEN.fahrer)[0];
  const einst = einstellungenStand();   // Haken je Teil, "x von y eingerichtet" (09.10.2026)
  sek.innerHTML = kopf("spesen", "Spesen", {
    zahl: zahlEuro(info.summe, opt.von ?? info.summe), label: euro(info.summe) + " Euro", rechts: wahl, unter,
    unten: segmente(info, opt.auftritt !== false),
    mini: `${euro(info.summe)} € · ${MON[m - 1]} ${j}`,
    miniRechts: `<button class="rund klein" data-aktion="drucken" aria-label="Drucken">${ic("drucker")}</button>` }) + `
  <div class="blatt"><div class="blatt-innen">
    <div class="seite">
      <div class="schnell schnell-${schnell.length}">
        ${schnell.map(([a, i, t, k]) => `<button class="${k}" data-aktion="${a}"><span class="knopf">${ic(i)}</span>${t}</button>`).join("")}
      </div>
      <div class="karte karte-zeiten${einst.zeiten ? "" : " fehlt"}">
        <div class="e-kopf"><span class="e-titel"><span class="ueberschrift">Zeiten für alle Tage</span>${eStatus(einst.zeiten)}</span><button class="knopf-klein" data-bogen="zeiten">${einst.zeiten ? "Ändern" : "Eintragen"}</button></div>
        ${std.ab && std.an ? `<div class="zeit-gross"><b>${std.ab}<span class="pf">→</span>${std.an}</b><span>${stundenText(n / 60)} · ${euro(satzFuer(n))} €</span></div>
        <p>Gilt automatisch für jeden Werktag – bis heute. Abweichende Tage ändern Sie direkt in der Liste.</p>`
        : `<p>Noch keine Zeiten – einmal eintragen, dann läuft jeder Werktag automatisch mit.</p>`}
      </div>
      ${einstellungenBlock(einst, { name, ort, land, rolle })}
      ${mirko ? `<div class="karte karte-unterschrift">
        <div class="k-titelzeile"><span class="ueberschrift">Unterschrift (Foto)</span>
          <span style="display:flex;gap:6px"><button class="knopf-klein" data-aktion="sig-einfuegen">${localStorage.getItem("spesen_signature") ? "Ersetzen" : "Einfügen"}</button>${localStorage.getItem("spesen_signature") ? `<button class="knopf-klein" data-aktion="sig-weg" aria-label="Unterschrift entfernen">${ic("x")}</button>` : ""}</span></div>
        ${localStorage.getItem("spesen_signature") ? `<img class="sig-vorschau" alt="Ihre Unterschrift" src="${localStorage.getItem("spesen_signature")}">` : `<p>Ohne Foto wird der Ausdruck von Hand unterschrieben.</p>`}
      </div>` : ""}
      <div class="links">
        <button data-bogen="archiv">${ic("archiv")}Abgeschlossene Spesen</button>
        <button data-aktion="csv">${ic("datei")}CSV für die Steuer</button>
      </div>
      <p class="blatt-fuss">Stunden bereits abzüglich 30 Minuten Pause.<br>Abgabe spätestens am 3. Werktag des Folgemonats – ausgedruckt und unterschrieben.</p>
    </div>
    <div class="haupt ${opt.richtung ? "rein-" + opt.richtung : ""}">
      ${gesperrtAm ? `<div class="gesperrt">${ic("schloss")}<span><b>Abgeschlossen</b> am ${formatTimestampDE(gesperrtAm)}${mirko ? "" : " – die PDF liegt im Ordner „Abgeschlossene Spesen“"}.</span><button data-aktion="oeffnen">Wieder öffnen</button></div>` : ""}
      ${istLaufend ? "" : `<button class="zu-heute" data-aktion="zu-heute">${ic("kalender")}Sie sind nicht im laufenden Monat · zu ${MON[jetzt.getMonth()]} ${jetzt.getFullYear()}</button>`}
      <div class="hinweis">${ic("info")}<span>Pauschale ab <b>mehr als 8 Std</b> Arbeitszeit · <b>bis genau 10 Std</b> in Ordnung, darüber wird der Tag nicht genehmigt.</span></div>
      <div class="tabellenkopf" style="margin-top:18px"><span>Tag</span><span>${innen() ? "Beginn" : "Abfahrt"}</span><span></span><span>${innen() ? "Ende" : "Ankunft"}</span><span>${innen() ? "" : "besuchte Orte"}</span><span class="r">Stunden</span><span class="r">Pauschale</span><span class="r">Status</span></div>
      ${wochenHTML}
    </div>
  </div></div>`;
  if (opt.halteScroll) sek.scrollTop = scroll;
  kopfScroll(sek);
  if (opt.von != null) rollenLos(sek.querySelector(".b-kopf"));
}

/* ---------------- Urlaub ---------------- */
let urlaubJahr = null;
function renderUrlaub() {
  const J = urlaubJahr || config.jahr;
  const gilt = urlaubGilt(J), gesamt = gilt.anspruch + gilt.uebertrag;   // mit automatischem Uebertrag (09.10.2026)
  const zaehler = urlaubZaehlerFuer(J), rest = urlaubRestFuer(J);
  const map = feiertage(J, config.bundesland), h = heuteIso();
  const monate = [...Array(12).keys()].map((mi) => {
    const n = new Date(J, mi + 1, 0).getDate(), erster = (new Date(J, mi, 1).getDay() + 6) % 7;
    const zellen = Array(erster).fill("<span></span>");
    for (let t = 1; t <= n; t++) {
      const d = new Date(J, mi, t), iso = isoVon(d), st = (overrides[iso] || {}).status;
      let c = "d"; if (d.getDay() === 0 || d.getDay() === 6) c += " we"; if (map[iso]) c += " fei";
      if (st && ARTEN[st]) c += " " + st; if (iso === h) c += " heute";
      zellen.push(`<button class="${c}" data-utag="${iso}" title="${esc(map[iso] || (st ? ARTEN[st] : ""))}">${t}</button>`);
    }
    return `<div class="mmonat"><h4>${MON[mi]}</h4><div class="mgitter">${["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((x) => `<span class="k">${x}</span>`).join("")}${zellen.join("")}</div></div>`;
  }).join("");
  const sek = document.getElementById("s-urlaub");
  sek.innerHTML = kopf("urlaub", "Urlaub", {
    zahl: zahlEinheit(rest, "Tage"), label: rest + " Tage", unter: `übrig von ${gesamt} · ${zaehler.urlaub} genommen`,
    nachZahl: ring(rest, gesamt, 92, 9), mini: `${rest} Tage übrig`,
    rechts: `<div class="monat-wahl"><button data-ujahr="-1" aria-label="Voriges Jahr">${ic("zurueck")}</button><span>${J}</span><button data-ujahr="1" aria-label="Nächstes Jahr">${ic("vor")}</button></div>` }) + `
  <div class="blatt"><div class="blatt-innen">
    <div class="seite">
      <div class="karte anspruch"><div><small>Urlaubsanspruch ${J}</small><span class="gross">${String(gilt.anspruch).replace(".", ",")} Tage</span><small style="margin-top:2px">Übertrag aus ${J - 1}: ${gilt.auto && J === config.jahr ? "noch nicht bestätigt" : String(gilt.uebertrag).replace(".", ",")}</small></div><button class="knopf-klein" data-bogen="anspruch">Ändern</button></div>
      ${gilt.auto && J === config.jahr ? `<div class="hinweis karte rest-offen" style="margin-top:12px">${ic("info")}<span><b>Resturlaub aus ${gilt.auto.jahr}:</b> ${zk(gilt.auto.rest)} Tage laut Ihren Einträgen – bitte bestätigen. Bis dahin zählt er nicht mit.</span><button class="knopf-klein" data-aktion="rest-pruefen">Prüfen</button></div>` : ""}
      <div class="karte" style="margin-top:12px">
        <h3>Abwesenheit eintragen</h3>
        ${abwesenheitFelder("u")}
      </div>
      <div class="schnell zwei" style="margin-top:12px">
        <button class="erst" data-aktion="urlaub-drucken"><span class="knopf">${ic("drucker")}</span>Drucken</button>
      </div>
      <div class="hinweis karte" style="margin-top:12px">${ic("info")}<span><b>Im Urlaub krank geworden?</b> Tragen Sie die Tage einfach noch einmal als Krank ein – sie stehen Ihnen dann wieder zur Verfügung.</span></div>
      <!-- 09.10.2026, Mirko "ja": Urlaub zuruecksetzen im Bereich Urlaub (wie Spesen-Eintraege im Spesen-Bereich).
           Handy: ans Ende, nach dem Kalender (e-block, order 2) - selten gebraucht, gehoert nicht nach oben. -->
      <div class="e-block"><div class="karte" style="margin-top:18px">
        <div class="e-kopf"><span class="e-titel"><span class="ueberschrift">Urlaub &amp; Abwesenheiten zurücksetzen</span></span><button class="knopf-klein" data-aktion="urlaub-zuruecksetzen">Zurücksetzen</button></div>
        <p class="e-unterzeile" style="margin:8px 0 0">Alle Urlaubs-, Krank- und Frei-Tage und der Urlaubsanspruch – danach gelten wieder 30 Tage. Abgeschlossene Monate bleiben unverändert. Vorher wird automatisch eine Sicherung gespeichert.</p>
      </div></div>
    </div>
    <div class="haupt">
      <div class="legende">${Object.entries(ARTEN).map(([k, v]) => `<span class="chip ${k}">${v}</span>`).join("")}<span class="chip feiertag">Feiertag</span></div>
      <div class="kalender auftauchen">${monate}</div>
      <p class="klein-text">Einen Tag antippen, um ihn zu ändern.</p>
    </div>
  </div></div>`;
  sek.querySelectorAll(".kalender>*").forEach((e, i) => e.style.setProperty("--i", i));
  kopfScroll(sek);
}
function abwesenheitFelder(p) {
  return `<div class="felder"><label class="feld"><span>Von</span><input type="date" id="${p}AbwVon"></label><label class="feld"><span>Bis</span><input type="date" id="${p}AbwBis"></label></div>
    <div class="arten" data-gruppe="${p}">${Object.entries(ARTEN).map(([k, v], i) => `<button class="art ${i === 0 ? "an" : ""}" data-art="${k}">${v}</button>`).join("")}</div>
    <button class="haupt-knopf" data-aktion="abwesenheit-eintragen" data-p="${p}">Eintragen</button>
    <p class="klein-text">Für einen einzelnen Tag reicht das Von-Feld. Wochenenden und Feiertage werden beim Zählen übersprungen.</p>`;
}

/* ---------------- Jahresuebersicht ---------------- */
function renderJahr(opt = {}) {
  const J = config.jahr, h = new Date();
  const infos = jahrInfos(J);
  const bis = J < h.getFullYear() ? 12 : J > h.getFullYear() ? 0 : h.getMonth() + 1;
  const summe = infos.reduce((s, x) => s + x.summe, 0), tage = infos.reduce((s, x) => s + x.spesentage, 0);
  const max = Math.max(1, ...infos.map((x) => x.summe));
  const zaehle = (x, st) => x.tage.filter((t) => t.art === "status" && t.status === st).length;
  const balken = infos.map((x, i) => `<div class="b"><div class="wert">${i < bis || x.summe ? Math.round(x.summe) : ""}</div><div class="saeule ${i + 1 === bis && J === h.getFullYear() ? "jetzt" : (i >= bis && !x.summe) ? "spaeter" : ""}" style="height:${(i >= bis && !x.summe) ? 0 : Math.max(6, x.summe / max * 100)}%;--i:${i}"></div></div>`).join("");
  const zeilen = infos.map((x, i) => {
    if (i >= bis && !x.summe) return `<div class="tz leer"><span class="m">${MON[i]}</span><span class="r">–</span><span class="r">–</span><span class="r">–</span></div>`;
    const ab = zaehle(x, "urlaub") + zaehle(x, "krank");
    return `<div class="tz"><span class="m">${MON[i]}${i + 1 === bis && J === h.getFullYear() ? ' <span class="chip heute" style="margin-left:6px">läuft</span>' : ""}</span><span class="r">${x.spesentage}</span><span class="r">${ab || "–"}</span><span class="r betr">${euro(x.summe)} €</span></div>`;
  }).join("");
  const sek = document.getElementById("s-jahr"), scroll = sek.scrollTop;
  sek.innerHTML = kopf("jahr", "Jahresübersicht", {
    zahl: zahlEuro(summe, opt.von ?? summe), label: euro(summe) + " Euro", unter: `${tage} Spesentage · ${J}`, mini: `${euro(summe)} € · ${J}`,
    rechts: `<div class="monat-wahl"><button data-jjahr="-1" aria-label="Voriges Jahr">${ic("zurueck")}</button><span>${J}</span><button data-jjahr="1" aria-label="Nächstes Jahr">${ic("vor")}</button></div>` }) + `
  <div class="blatt"><div class="blatt-innen">
    <div class="seite">
      <div class="schnell zwei">
        <button class="erst" data-aktion="jahr-drucken"><span class="knopf">${ic("drucker")}</span>Drucken</button>
      </div>
      <div class="hinweis karte">${ic("info")}<span>Die Übersicht rechnet alle Monate des Jahres zusammen – praktisch für die <b>Steuererklärung</b>.</span></div>
    </div>
    <div class="haupt">
      <div class="karte"><div class="balken">${balken}</div><div class="balken-text">${MON_K.map((x) => `<span>${x}</span>`).join("")}</div></div>
      <div class="karte tabelle"><div class="tz kopf"><span>Monat</span><span class="r">Tage</span><span class="r">Abw.</span><span class="r">Betrag</span></div>${zeilen}
        <div class="tz summe"><span>Summe</span><span class="r">${tage}</span><span class="r"></span><span class="r">${euro(summe)} €</span></div></div>
    </div>
  </div></div>`;
  if (opt.halteScroll) sek.scrollTop = scroll;
  kopfScroll(sek);
  if (opt.von != null) rollenLos(sek.querySelector(".b-kopf"));
}

/* ---------------- Mehr ---------------- */
function renderMehr() {
  const z = (aktion, icon, text, klein, rechts = "", extra = "") => `<button class="zeile ${extra}" data-aktion="${aktion}"><span class="z-ic">${ic(icon)}</span><span class="z-text">${text}${klein ? `<small>${klein}</small>` : ""}</span><span class="rechts">${rechts}${ic("vor")}</span></button>`;
  const sprache = (config.lang === "en") ? "English" : "Deutsch";
  document.getElementById("s-mehr").innerHTML = kopf("mehr", "Mehr", { unter: "Sicherung, Werkzeuge und Hilfe", kompakt: true }) + `
  <div class="blatt"><div class="blatt-innen einspaltig"><div class="haupt auftauchen">
    ${abgleichGruppe(z)}
    ${amZiel() ? "" : umzugGruppe(z)}
    <div class="gruppe"><div class="gruppe-titel">Darstellung</div><div class="liste">
      <div class="zeile design-zeile"><span class="z-ic">${ic("farbe")}</span><span class="z-text">Design<small>Gilt für dieses Gerät</small></span>
        <span class="design-wahl" role="group" aria-label="Design">${[["hell", "Hell"], ["dunkel", "Dunkel"]].map(([d, t]) => `<button data-design="${d}" class="${(designGewaehlt() || "hell") === d ? "an" : ""}" aria-pressed="${(designGewaehlt() || "hell") === d}">${t}</button>`).join("")}</span></div>
    </div></div>
    <div class="gruppe"><div class="gruppe-titel">Mitteilungen</div><div class="liste">${mtZeile(z)}</div></div>
    <div class="gruppe"><div class="gruppe-titel">Datensicherung</div><div class="liste">
      ${z("backup", "laden", "Backup als Datei speichern", "Alle Monate, Urlaub und Einstellungen" + (sicherungZuletzt() ? " · zuletzt am " + esc(sicherungZuletzt()) : ""))}
      ${z("wiederherstellen", "hoch", "Backup wiederherstellen", "")}
    </div></div>
    <div class="gruppe"><div class="gruppe-titel">Werkzeuge</div><div class="liste">
      ${z("feedback", "rede", "Feedback", "Verbesserungsvorschlag oder Fehler melden")}
      ${z("qr", "qr", "QR-Code", "Zum Weitergeben an Kollegen")}
      ${z("sprache", "welt", "Sprache", "Vordruck und Ausdruck", sprache)}
      ${z("verlauf", "verlauf", "Änderungshistorie", "")}
    </div></div>
    <div class="gruppe"><div class="liste">${z("zuruecksetzen", "muell", "Zurücksetzen", "Löscht Daten auf diesem Gerät – vorher wird eine Sicherung gespeichert", "", "gefahr")}</div></div>
    <p class="blatt-fuss">Rieb Spesen v${typeof APP_VERSION !== "undefined" ? "" : ""}${esc(document.getElementById("footerVersion") ? document.getElementById("footerVersion").textContent.replace(/^v/, "") : "")} · ${syncAn() ? "Angemeldet: Ihre Einträge werden über Ihr Konto zwischen Ihren Geräten abgeglichen." : "Ohne Anmeldung bleibt alles nur auf diesem Gerät."}<br>Entwickelt von Mirko Rieb · Kostenlos während der Erprobungsphase</p>
  </div></div></div>`;
  document.querySelectorAll("#s-mehr .auftauchen>*").forEach((e, i) => e.style.setProperty("--i", i));
}

/* ---------------- Geraete abgleichen (09.10.2026, Entscheidung 42) ----------------
   Dieselbe Abgleich-Technik, die Mirko seit 01.10.2026 benutzt
   (sync/firebase-sync.js, Firebase-Projekt wie bisher) - jetzt freiwillig fuer
   alle, jeder legt sein Konto selbst an. Mirko: "ne brauche kein okey mehr ist
   mein eigenes tool jetzt". Entwurf Neues Design/abgleich-entwurf.html, Mirko:
   "ja passt". Diese Oberflaeche spricht NUR mit window.riebSync; ohne
   Anmeldung laedt firebase-sync.js nichts von Google. */
const DATENSCHUTZ_FASSUNG = "2026-10-09";
/* Serverstandort der Firestore-Datenbank: BLEIBT LEER - der Satz nennt keinen
   Ort. Mirko 10.10.2026: "ne wir geben kein serverstandort preis". Nicht
   wieder nachfragen. */
const SERVERSTANDORT = "";
const syncZ = () => (window.riebSync ? window.riebSync.zustand() : null);
const syncAn = () => { const s = syncZ(); return !!(s && s.angemeldet); };
function seitWann(ts) {
  if (!ts) return "";
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return "gerade eben";
  const m = Math.round(s / 60); if (m < 60) return "vor " + m + " Min.";
  const h = Math.round(m / 60); if (h < 24) return "vor " + h + " Std.";
  return "am " + new Date(ts).toLocaleDateString("de-DE");
}
function datenschutzText() {
  return `<b>Datenschutz.</b> Gespeichert werden Ihre Einstellungen, Tage, Urlaub und abgeschlossenen PDFs – damit sie auf Ihren Geräten gleich sind. Sie liegen bei Google Firebase im Projekt von Mirko Rieb${SERVERSTANDORT ? " (Serverstandort: " + esc(SERVERSTANDORT) + ")" : ""}. Andere Nutzer sehen sie nicht. Löschen jederzeit unter „Mehr“ → „Konto löschen“.`;
}
/* Gruppe ganz oben unter "Mehr". z = Zeilen-Baustein aus renderMehr */
function abgleichGruppe(z) {
  const s = syncZ();
  if (!s) return "";   // Abgleich nicht verfuegbar (keine Firebase-Konfiguration oder ?sync=aus)
  if (!s.angemeldet) {
    return `<div class="gruppe"><div class="gruppe-titel">Geräte abgleichen</div><div class="liste">
      ${z("abgleich-anmelden", "wolke", "Anmelden", s.laedt ? "Verbindung wird hergestellt …" : "PC, Handy, App und Browser auf demselben Stand · freiwillig")}
    </div></div>`;
  }
  const stand = s.letzterAbgleich ? "abgeglichen, " + seitWann(s.letzterAbgleich) : "verbunden";
  return `<div class="gruppe"><div class="gruppe-titel">Geräte abgleichen</div><div class="liste">
    <div class="zeile abgleich-stand"><span class="z-ic">${ic("wolke")}</span><span class="z-text">Angemeldet<small>${esc(s.email)} · <i class="abgleich-punkt"></i>${stand}</small></span><span class="rechts"></span></div>
    ${z("abgleich-abmelden", "raus", "Abmelden", "Auf diesem Gerät bleibt alles – es wird nur nicht mehr abgeglichen")}
    ${z("abgleich-loeschen", "muell", "Konto löschen", "Löscht Ihr Konto und Ihre Daten in der Cloud – auf diesem Gerät bleibt alles", "", "gefahr")}
  </div></div>`;
}
let abgleichModus = "anmelden";
function oeffneAbgleich(modus) {
  if (modus) abgleichModus = modus;
  const neu = abgleichModus === "neu";
  const email = (document.getElementById("aMail") || {}).value || "";
  oeffneEbene(`${bogenKopf("Freiwillig · kostenlos", "Geräte abgleichen")}
    <p class="e-unterzeile" style="margin:12px 2px 0;font-size:14.5px;color:var(--tinte2)">Mit einem Konto steht auf PC, Handy, App und Browser überall derselbe Stand. Ohne Konto bleibt alles wie bisher nur auf diesem Gerät.</p>
    <div class="os-wahl" style="margin-top:14px"><button data-aktion="abgleich-modus" data-amodus="anmelden" class="${neu ? "" : "an"}">Anmelden</button><button data-aktion="abgleich-modus" data-amodus="neu" class="${neu ? "an" : ""}">Neues Konto</button></div>
    <label class="feld" style="margin-top:12px"><span>E-Mail</span><input id="aMail" type="email" inputmode="email" autocomplete="email" autocapitalize="off" spellcheck="false" value="${esc(email)}"></label>
    <label class="feld" style="margin-top:10px"><span>Passwort${neu ? " (mindestens 6 Zeichen)" : ""}</span><input id="aPass" type="password" autocomplete="${neu ? "new-password" : "current-password"}"></label>
    ${neu ? `<div class="hinweis karte" style="margin-top:12px">${ic("info")}<span>${datenschutzText()}</span></div>
    <label class="schalter" style="margin-top:10px"><span><b>Hinweis gelesen – einverstanden</b></span><input type="checkbox" id="aEinv"></label>` : ""}
    <p class="abgleich-meldung" id="aMeldung" role="alert" hidden></p>
    <button class="haupt-knopf" style="margin-top:14px" data-aktion="abgleich-los">${neu ? "Konto anlegen" : "Anmelden"}</button>
    ${neu ? "" : `<button class="text-knopf" data-aktion="abgleich-vergessen">Passwort vergessen?</button>`}`);
  /* Enter im Passwortfeld = Anmelden / Konto anlegen */
  const p = document.getElementById("aPass");
  if (p) p.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); abgleichLos(); } });
}
function abgleichMeldung(text, gut) {
  const m = document.getElementById("aMeldung"); if (!m) return;
  m.hidden = !text; m.textContent = text || ""; m.classList.toggle("gut", !!gut);
}
let abgleichLaeuft = false;
async function abgleichLos() {
  if (abgleichLaeuft || !window.riebSync) return;
  const neu = abgleichModus === "neu";
  const email = (document.getElementById("aMail") || {}).value || "";
  const pw = (document.getElementById("aPass") || {}).value || "";
  if (neu && !(document.getElementById("aEinv") || {}).checked) { abgleichMeldung("Bitte den Datenschutzhinweis bestätigen."); return; }
  const knopf = document.querySelector('#ebene [data-aktion="abgleich-los"]');
  abgleichLaeuft = true; if (knopf) { knopf.disabled = true; knopf.textContent = neu ? "Konto wird angelegt …" : "Anmelden …"; }
  abgleichMeldung("");
  const r = neu ? await window.riebSync.registrieren(email, pw, DATENSCHUTZ_FASSUNG) : await window.riebSync.anmelden(email, pw);
  abgleichLaeuft = false;
  if (!r.ok) {
    if (knopf) { knopf.disabled = false; knopf.textContent = neu ? "Konto anlegen" : "Anmelden"; }
    abgleichMeldung(r.meldung);
    return;
  }
  schliesseEbene();
  toast(neu ? "Konto angelegt – Ihre Geräte gleichen sich jetzt ab" : "Angemeldet – Ihre Geräte gleichen sich jetzt ab");
  if (aktuell === "mehr") renderMehr();
  erAnmeldenFertig();
}
/* Erster Start: "Mit Konto anmelden" (Mirkos Idee 09.10.2026 "Schon ein Konto?
   Anmelden", im Entwurf 10.10. freigegeben). Das Fenster laege sonst UNTER der
   Einrichtung (Ebene 1000 < 1090 - wie das Zeit-Dreh-Rad am 27.09.) - darum
   #rieb.ebene-oben, solange es offen ist. */
function erAnmelden() {
  /* Der Knopf steht immer da: window.riebSync entsteht erst nach dem Nachladen
     der Firebase-Einstellungen - also oft NACH dem ersten Bild der Einrichtung
     (abgleich-pruefen 5b, 10.10.2026). Erst beim Tippen pruefen. */
  if (!window.riebSync) { alert("Anmelden ist auf diesem Gerät gerade nicht möglich.\n\nRichten Sie Rieb Spesen bitte ohne Konto ein – anmelden können Sie sich später unter „Mehr“ → „Geräte abgleichen“."); return; }
  document.getElementById("rieb").classList.add("ebene-oben");
  oeffneAbgleich("anmelden");
}
/* Nach dem Anmelden mitten in der Einrichtung: warten, bis die Eintraege aus
   dem Konto da sind (Einstellung mit Namen), das gewaehlte Design merken (es
   gilt je Geraet und kommt nicht aus dem Konto) und neu laden - dann ist die
   Einrichtung vorbei. Ohne Eintraege im Konto: Einrichtung geht weiter. */
function erAnmeldenFertig() {
  const ein = document.getElementById("einrichtung");
  if (!ein || ein.hidden) return;
  const start = Date.now();
  const warte = setInterval(() => {
    let name = "";
    try { name = ((JSON.parse(localStorage.getItem("spesen_config") || "null") || {}).name || "").trim(); } catch (e) { name = ""; }
    if (name) {
      clearInterval(warte);
      if (!designGewaehlt()) localStorage.setItem(DESIGN_KEY, ER.design === "dunkel" ? "dunkel" : "hell");
      sessionStorage.setItem("rieb_konto_ok", "1");
      location.reload();
    } else if (Date.now() - start > 20000) {
      clearInterval(warte);
      toast("In diesem Konto sind noch keine Einträge – bitte richten Sie Rieb Spesen ein.");
    }
  }, 500);
}
async function abgleichVergessen() {
  if (!window.riebSync) return;
  const email = (document.getElementById("aMail") || {}).value || "";
  const r = await window.riebSync.passwortVergessen(email);
  abgleichMeldung(r.ok ? "Falls es zu dieser E-Mail ein Konto gibt, ist eine Mail zum Zurücksetzen des Passworts unterwegs." : r.meldung, r.ok);
}
async function abgleichAbmelden() {
  if (!window.riebSync) return;
  if (!confirm("Abmelden?\n\nAuf diesem Gerät bleibt alles. Es wird nur nicht mehr mit Ihren anderen Geräten abgeglichen.")) return;
  const r = await window.riebSync.abmelden();
  if (!r.ok) toast(r.meldung);
}
function oeffneKontoLoeschen() {
  const s = syncZ();
  oeffneEbene(`${bogenKopf(esc(s && s.email || ""), "Konto löschen")}
    <p class="e-unterzeile" style="margin:12px 2px 0;font-size:14.5px;color:var(--tinte2)">Gelöscht werden Ihr Konto und <b>alle Ihre Daten in der Cloud</b>. Auf diesem Gerät bleibt alles, wie es ist. Auf Ihren anderen Geräten bleibt der bisherige Stand ebenfalls stehen, wird aber nicht mehr abgeglichen.</p>
    <label class="feld" style="margin-top:14px"><span>Zur Sicherheit: Ihr Passwort</span><input id="aPass" type="password" autocomplete="current-password"></label>
    <p class="abgleich-meldung" id="aMeldung" role="alert" hidden></p>
    <button class="haupt-knopf gefahr" style="margin-top:14px" data-aktion="abgleich-loeschen-ok">Konto endgültig löschen</button>`);
}
async function abgleichLoeschenOk() {
  if (abgleichLaeuft || !window.riebSync) return;
  const pw = (document.getElementById("aPass") || {}).value || "";
  if (!pw) { abgleichMeldung("Bitte Ihr Passwort eingeben."); return; }
  const knopf = document.querySelector('#ebene [data-aktion="abgleich-loeschen-ok"]');
  abgleichLaeuft = true; if (knopf) { knopf.disabled = true; knopf.textContent = "Wird gelöscht …"; }
  const r = await window.riebSync.kontoLoeschen(pw);
  abgleichLaeuft = false;
  if (!r.ok) { if (knopf) { knopf.disabled = false; knopf.textContent = "Konto endgültig löschen"; } abgleichMeldung(r.meldung); }
}
/* "Zuruecksetzen" unter Mehr: Wer angemeldet ist, wird vorher abgemeldet -
   das Zuruecksetzen gilt dann nur fuer DIESES Geraet (wie der Text sagt), das
   Konto und die anderen Geraete bleiben. Ohne das gingen die Loeschungen als
   Loeschungen in die Cloud, die anderen Geraete uebernehmen Loeschungen aber
   bewusst nicht - die Geraete liefen auseinander (gefunden 09.10.2026). */
async function zuruecksetzenMitAbgleich() {
  if (syncAn()) {
    if (!confirm("Sie sind angemeldet.\n\nZurücksetzen gilt nur für dieses Gerät – dafür werden Sie hier abgemeldet. Ihr Konto und Ihre anderen Geräte bleiben unverändert.\n\nWeiter?")) return;
    const r = await window.riebSync.abmelden({ neuLaden: false });
    if (!r.ok) { toast(r.meldung); return; }
    if (aktuell === "mehr") renderMehr();
  }
  return openRuecksetzenModal();
}
/* Abgleich meldet sich (fertig geladen, angemeldet, abgeglichen) -> Anzeige auffrischen */
function abgleichAnzeigen() {
  if (aktuell === "mehr" && !document.querySelector("#ebene:not([hidden])")) renderMehr();
  const f = document.querySelector("#s-start .start-fuss");
  if (f) f.textContent = startFuss();
}
function startFuss() {
  const s = syncZ();
  if (s && s.angemeldet) return s.letzterAbgleich ? "Abgeglichen · " + seitWann(s.letzterAbgleich) : "Angemeldet · Abgleich läuft";
  return istMirko() ? "Rieb Spesen" : "Läuft komplett auf Ihrem Gerät · keine Anmeldung";
}
function abgleichVerbinden() {
  if (!window.riebSync || abgleichVerbinden.fertig) return;
  abgleichVerbinden.fertig = true;
  window.riebSync.beiAenderung(abgleichAnzeigen);
  abgleichAnzeigen();
}
window.addEventListener("rieb-sync-bereit", abgleichVerbinden);
/* Fuer firebase-sync.js: in welchem Bereich wird nach einem Abgleich neu geladen */
window.riebBereich = () => aktuell;

/* ---------------- Anleitung ---------------- */
/* Anleitungsvideo (Entscheidung 41, Mirko 09.10.2026): am PC das PC-Video, am
   Handy das Handy-Video - umgeschaltet NUR nach Breite (1100 px wie rieb.css
   und Anleitung.html), App = Browser; und passend zu Hell / Dunkel ("Video
   folgt dem Design"). Vier Dateien in video/, aufgenommen 10.10.2026. Das
   alte Anleitung-Video.mp4 (Firmen-Laden, 03.10.) wird nicht mehr gezeigt. */
const ANLEITUNG_PC = "(min-width: 1100px)";
function anleitungVideo() {
  const pc = matchMedia(ANLEITUNG_PC).matches;
  return { pc, src: `video/Anleitung-Video-${pc ? "PC" : "Handy"}-${designGewaehlt() === "dunkel" ? "dunkel" : "hell"}.mp4` };
}
function renderAnleitung() {
  const v = anleitungVideo();
  document.getElementById("s-anleitung").innerHTML = kopf("anleitung", "Anleitung", { unter: "So funktioniert das Werkzeug", kompakt: true }) + `
  <div class="blatt"><div class="blatt-innen einspaltig"><div class="haupt auftauchen">
    <div class="video${v.pc ? "" : " hoch"}"><video controls preload="metadata" playsinline src="${v.src}"></video>
      <div class="video-text"><b>Anleitungsvideo</b><span>Rieb Spesen Schritt für Schritt · knapp 9 Minuten</span></div></div>
    <iframe class="anleitung-rahmen" src="Anleitung.html" title="Schriftliche Anleitung"></iframe>
  </div></div></div>`;
}
/* Breite wechselt (Fenster gezogen, Tablet gedreht): passende Fassung - aber
   nie mitten im Abspielen */
matchMedia(ANLEITUNG_PC).addEventListener("change", () => {
  const el = document.querySelector("#s-anleitung .video video");
  if (!el || !el.paused) return;
  const v = anleitungVideo();
  if (el.getAttribute("src") === v.src) return;
  el.setAttribute("src", v.src);
  el.closest(".video").classList.toggle("hoch", !v.pc);
});

/* ---------------- Zeit (Stechuhr) ----------------
   Nur wer tabErlaubt("zeit") hat (zeigtZeit(): Mirko). Entwurf:
   Neues Design/mirko-entwurf.html?b=zeit - hell Fassung A, dunkel Fassung B,
   von Mirko am 08.10.2026 so bestellt.

   Gerechnet, gespeichert und gedruckt wird NUR ueber die Live-Fassung:
     stempeln         azStempeln()
     Tag eintragen    azNachtragenSpeichern() - liest azNachDatum/azNachVon/
                      azNachBis/azNachPause; der Bogen hier traegt dieselben Ids
     Monat fuellen    azMonatFuellen() - Ids azFuellMonat/azFuellVon/...
     Vorschau         azNachVorschau() / azFuellVorschau() schreiben in
                      #azNachVorschau / #azFuellVorschau (stehen im Bogen)
     Vorgaben         azSaveCfg() - ueber die Felder #azSoll/#azGesetzlichePause
     Drucken/Ordner   zeitMonatDrucken() / zeitJahrDrucken() / zeitOrdnerAblegen()
   Die alte Ansicht (#arbeitszeitPanel) bleibt darunter und wird mit azRender()
   auf demselben Stand gehalten: Die Ausdrucke lesen von dort (#azMonat,
   #azJahr, #azJahrContent). Die Summen hier sind dieselben Formeln wie in
   azRender()/azRenderJahr() (Netto je Eintrag minus Soll) - zeit-pruefen.js
   vergleicht beide Anzeigen Zahl fuer Zahl. */
const zPlus = (m) => (m >= 0 ? "+" : "") + azHhmm(m);
function zeitMonatKey() { azRender(); const s = document.getElementById("azMonat"); return s ? s.value : ""; }
function zeitSegmente(J, M, soll, erscheint) {
  const map = feiertage(J, config.bundesland) || {}, n = new Date(J, M, 0).getDate(), heute = heuteIso();
  const laufTag = AZ.lauf ? azTagIso(AZ.lauf) : null;
  const segs = [];
  for (let t = 1; t <= n; t++) {
    const d = new Date(J, M - 1, t), wd = d.getDay(), iso = isoVon(d), e = azEintraegeAmTag(iso);
    /* Werktage immer; Wochenende und Feiertag nur, wenn dort gearbeitet wurde */
    if ((wd === 0 || wd === 6 || map[iso]) && !e.length && iso !== laufTag) continue;
    let c = "", p = "";
    if (e.length) c = e.reduce((s, x) => s + azNettoFuer(x), 0) - soll >= 0 ? "plus" : "minus";
    if (iso === laufTag) { c = "laeuft z-lauf"; p = `;--p:${zeitLaufAnteil().toFixed(3)}`; }
    else if (iso === heute) c += " heute";
    segs.push(`<i class="seg ${c}" style="--i:${segs.length}${p}"></i>`);
  }
  return `<div class="segmente${erscheint ? " erscheint" : ""}" style="--n:${Math.max(1, segs.length)}" aria-hidden="true">${segs.join("")}</div>`;
}
/* Anteil des laufenden Tages am Soll (fuer den leuchtenden Balken) */
function zeitLaufAnteil() {
  if (!AZ.lauf) return 0;
  const min = (Date.now() - new Date(AZ.lauf).getTime()) / 60000;
  return Math.max(0, Math.min(1, azNetto(min) / Math.max(1, AZ.cfg.soll * 60)));
}
function zeitUhrText() {
  if (!AZ.lauf) return "00:00:00";
  const s = Math.max(0, Math.floor((Date.now() - new Date(AZ.lauf).getTime()) / 1000));
  return [Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60].map(zwei).join(":");
}
function zeitKalender(J, M, soll) {
  const n = new Date(J, M, 0).getDate(), versatz = (new Date(J, M - 1, 1).getDay() + 6) % 7, heute = heuteIso();
  const map = feiertage(J, config.bundesland) || {}, laufTag = AZ.lauf ? azTagIso(AZ.lauf) : null;
  let z = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((x) => `<span class="k">${x}</span>`).join("") + "<span></span>".repeat(versatz);
  for (let t = 1; t <= n; t++) {
    const iso = `${J}-${zwei(M)}-${zwei(t)}`, wd = new Date(J, M - 1, t).getDay(), e = azEintraegeAmTag(iso);
    const netto = e.reduce((s, x) => s + azNettoFuer(x), 0);
    let c = "d";
    if (wd === 0 || wd === 6) c += " we";
    if (map[iso]) c += " fei";
    if (e.length) c += netto - soll >= 0 ? " plus" : " minus";
    if (iso === heute) c += " heute";
    if (iso === laufTag) c += " laeuft";
    const warn = e.some((x) => !azTagPause(x) && x.min > 360);
    const titel = e.length ? e.map((x) => azUhrzeit(x.start) + "–" + azUhrzeit(x.ende)).join(", ") + " · " + azHhmm(netto) + " Std. · " + zPlus(netto - soll)
                           : (map[iso] ? map[iso] + " – " : "") + "nichts erfasst, antippen zum Eintragen";
    z += `<button class="${c}" data-ztag="${iso}" title="${esc(titel)}"><b>${t}${e.length > 1 ? "✱" : ""}${warn ? "⚠" : ""}</b><small>${e.length ? azHhmm(netto) : ""}</small></button>`;
  }
  return `<div class="zkal">${z}</div>`;
}
let zeitJahrWahl = null;
function zeitJahre() {
  const j = Array.from(new Set(AZ.tage.map((e) => new Date(e.start).getFullYear())));
  const a = new Date().getFullYear(); if (!j.includes(a)) j.push(a);
  return j.sort((x, y) => x - y);
}
function zeitJahrKarte(soll) {
  const jahre = zeitJahre();
  if (!jahre.includes(zeitJahrWahl)) zeitJahrWahl = new Date().getFullYear();
  const J = zeitJahrWahl, alle = AZ.tage;
  /* Die alte Jahresansicht auf dasselbe Jahr stellen - der Jahresdruck liest von dort */
  const sel = document.getElementById("azJahr");
  if (sel) { azRenderJahr(); sel.value = String(J); azRenderJahr(); }
  const monate = [];
  for (let m = 1; m <= 12; m++) {
    const tage = alle.filter((e) => { const d = new Date(e.start); return d.getFullYear() === J && d.getMonth() + 1 === m; });
    const arbeit = tage.reduce((s, e) => s + azNettoFuer(e), 0);
    monate.push({ m, tage: tage.length, arbeit, diff: arbeit - tage.length * soll });
  }
  const gesamtTage = monate.reduce((s, x) => s + x.tage, 0);
  const i = jahre.indexOf(J);
  const wahl = `<div class="monat-wahl klein"><button data-zjahr="-1" aria-label="Voriges Jahr" ${i <= 0 ? "disabled" : ""}>${ic("zurueck")}</button><span>${J}</span><button data-zjahr="1" aria-label="Nächstes Jahr" ${i >= jahre.length - 1 ? "disabled" : ""}>${ic("vor")}</button></div>`;
  if (!gesamtTage) return `<div class="karte z-jahr"><div class="k-titelzeile"><span class="ueberschrift">Überstunden im Jahr</span>${wahl}</div><p class="klein-text">Für ${J} ist noch nichts erfasst.</p></div>`;
  const maxAbs = Math.max(30, ...monate.map((x) => Math.abs(x.diff)));
  const spalten = monate.map((x) => {
    const h = x.tage ? Math.max(4, Math.abs(x.diff) / maxAbs * 100) : 0, wert = x.tage ? zPlus(x.diff) : "";
    return `<div class="zj-spalte"><div class="zj-oben">${x.tage && x.diff >= 0 ? `<span>${wert}</span><i style="height:${h}%"></i>` : ""}</div>
      <div class="zj-unten">${x.tage && x.diff < 0 ? `<i style="height:${h}%"></i><span>${wert}</span>` : ""}</div><small>${MON_K[x.m - 1]}</small></div>`;
  }).join("");
  const gA = monate.reduce((s, x) => s + x.arbeit, 0), gD = monate.reduce((s, x) => s + x.diff, 0);
  const zeilen = monate.map((x) => x.tage
    ? `<div class="tz"><span class="m">${MON[x.m - 1]}</span><span class="r">${x.tage}</span><span class="r">${azHhmm(x.arbeit)}</span><span class="r betr ${x.diff >= 0 ? "z-plus" : "z-minus"}">${zPlus(x.diff)}</span></div>`
    : `<div class="tz leer"><span class="m">${MON[x.m - 1]}</span><span class="r">–</span><span class="r">–</span><span class="r">–</span></div>`).join("");
  return `<div class="karte z-jahr"><div class="k-titelzeile"><span class="ueberschrift">Überstunden im Jahr</span>${wahl}</div>
    <div class="zjahr">${spalten}</div>
    <div class="tabelle"><div class="tz kopf"><span>Monat</span><span class="r">Tage</span><span class="r">Arbeit</span><span class="r">Über/Unter</span></div>${zeilen}
      <div class="tz summe"><span>Gesamt ${J}</span><span class="r">${gesamtTage}</span><span class="r">${azHhmm(gA)}</span><span class="r ${gD >= 0 ? "z-plus" : "z-minus"}">${zPlus(gD)}</span></div></div>
    <p class="klein-text">Gerechnet mit <b>${String(AZ.cfg.soll).replace(".", ",")} Std./Tag</b> Soll, ${esc(azModusText())}. Nur Tage mit erfasster Zeit zählen – nicht gestempelte Tage ergeben kein Minus.</p></div>`;
}
function renderZeit(opt = {}) {
  const sek = document.getElementById("s-zeit"); if (!sek) return;
  const scroll = sek.scrollTop;
  const key = zeitMonatKey(); if (!key) return;
  const [J, M] = key.split("-").map(Number), soll = AZ.cfg.soll * 60;
  const monat = AZ.tage.filter((e) => azMonatsKey(e.start) === key);
  const summeMonat = monat.reduce((s, e) => s + azNettoFuer(e) - soll, 0);
  const summeAlle = AZ.tage.reduce((s, e) => s + azNettoFuer(e) - soll, 0);
  const sel = document.getElementById("azMonat"), idx = sel ? sel.selectedIndex : 0, anz = sel ? sel.options.length : 1;
  /* Die Liste in #azMonat ist absteigend: "voriger Monat" = Eintrag darunter */
  const wahl = `<div class="monat-wahl"><button data-zmonat="-1" aria-label="Voriger Monat" ${idx >= anz - 1 ? "disabled" : ""}>${ic("zurueck")}</button><span>${MON[M - 1]} ${J}</span><button data-zmonat="1" aria-label="Nächster Monat" ${idx <= 0 ? "disabled" : ""}>${ic("vor")}</button></div>`;
  const [g, r] = zPlus(summeMonat).split(":");
  const lauf = AZ.lauf;
  sek.innerHTML = kopf("zeit", "Zeit", {
    zahl: `<span class="z-ganz">${g}</span><span class="z-rest">:${r}&nbsp;Std</span>`, label: zPlus(summeMonat) + " Stunden",
    unter: monat.length ? `Überstunden ${MON[M - 1]} · ${monat.length} ${monat.length === 1 ? "Tag" : "Tage"} · insgesamt ${zPlus(summeAlle)}`
                        : `${MON[M - 1]}: noch nichts erfasst · insgesamt ${zPlus(summeAlle)}`,
    rechts: wahl, unten: zeitSegmente(J, M, soll, opt.auftritt !== false),
    mini: `${zPlus(summeMonat)} Std · ${MON[M - 1]} ${J}`,
    miniRechts: `<button class="rund klein" data-aktion="z-stempeln" aria-label="${lauf ? "Feierabend" : "Arbeitsbeginn"}">${ic("uhr")}</button>` }) + `
  <div class="blatt"><div class="blatt-innen">
    <div class="seite">
      <div class="karte stechuhr${lauf ? " laeuft" : ""}">
        <div class="uhr-gross" id="zUhr">${zeitUhrText()}</div>
        <p id="zStatus">${lauf ? "Läuft seit <b>" + azUhrzeit(lauf) + "</b>" : "Noch nicht gestartet"}</p>
        <button class="haupt-knopf stempel${lauf ? " aus" : ""}" data-aktion="z-stempeln">${lauf ? "Feierabend" : "Arbeitsbeginn"}</button>
        <div class="neben"><button data-ztag="${heuteIso()}" data-zneu="1">Von Hand eintragen</button><button data-zbogen="fuellen">Zeiten für alle Tage</button></div>
      </div>
      <div class="schnell zwei">
        <button class="erst" data-aktion="z-monat-drucken"><span class="knopf">${ic("drucker")}</span>Monat drucken</button>
        <button data-aktion="z-jahr-drucken"><span class="knopf">${ic("drucker")}</span>Jahr drucken</button>
      </div>
      <div class="karte z-vorgaben">
        <div class="k-titelzeile"><span class="ueberschrift">Vorgaben</span><button class="knopf-klein" data-zbogen="vorgaben">Ändern</button></div>
        <div class="z-soll"><b>${String(AZ.cfg.soll).replace(".", ",")} Std</b><span>reine Arbeitszeit · ${azPauseAn() ? "mit Pause" : "ohne Pause"}</span></div>
      </div>
      <div class="links">
        <button data-aktion="z-export">${ic("datei")}Als Text kopieren</button>
        ${zeigtNeuerungen() ? `<button data-aktion="z-ablegen">${ic("laden")}Speichern / Ablegen</button><button data-zbogen="ordner">${ic("archiv")}Ordner</button>` : ""}
      </div>
      <p class="blatt-fuss">Läuft völlig getrennt von der Spesen-Abrechnung – gestempelte Zeiten erscheinen nicht im Spesennachweis. Sie dienen nur dazu, die eigenen Überstunden mitzuzählen.</p>
    </div>
    <div class="haupt">
      <div class="karte">
        <div class="k-titelzeile"><span class="ueberschrift">Monatsübersicht · ${MON[M - 1]} ${J}</span></div>
        ${zeitKalender(J, M, soll)}
        <p class="klein-text">Tag antippen zum Eintragen oder Ändern. Grün = über dem Soll, rot = darunter. ✱ = mehrere Einträge an einem Tag, ⚠ = über 6 Std. ohne Pause (nach § 4 Satz 2 ArbZG unzulässig – es wird nichts abgezogen, der Tag ist nur gekennzeichnet).</p>
        <div class="zeile-klein"><span>Überstunden ${MON[M - 1]} (${monat.length} ${monat.length === 1 ? "Tag" : "Tage"})</span><b class="${monat.length ? (summeMonat >= 0 ? "z-plus" : "z-minus") : ""}" id="zSummeMonat">${monat.length ? zPlus(summeMonat) : "–"}</b></div>
        <div class="zeile-klein leise"><span>Überstunden insgesamt (alle Monate)</span><b id="zSummeAlle">${zPlus(summeAlle)}</b></div>
      </div>
      ${zeitJahrKarte(soll)}
    </div>
  </div></div>`;
  if (opt.halteScroll) sek.scrollTop = scroll;
  kopfScroll(sek);
}
/* Jede Sekunde (takt): Uhr und laufender Balken */
function zeitTakt() {
  const u = document.getElementById("zUhr"); if (u) u.textContent = zeitUhrText();
  document.querySelectorAll("#s-zeit .z-lauf").forEach((s) => s.style.setProperty("--p", zeitLaufAnteil().toFixed(3)));
}
function zeitStempeln() {
  azStempeln();                    // prueft, speichert, azRender()
  renderZeit({ halteScroll: true, auftritt: false });
  toast(AZ.lauf ? "Arbeitsbeginn " + azUhrzeit(AZ.lauf) : "Feierabend · gespeichert");
}
function zeitMonatWechseln(schritt) {
  azMonatWechseln(schritt);        // stellt #azMonat um und rendert die alte Ansicht
  renderZeit({});
}

/* Bogen: einen Tag eintragen oder aendern. start: Start-Zeitstempel des
   Eintrags; undefined = der erste Eintrag des Tages; null = neuer Eintrag
   (wie azTagModal/azNachtragenModal der Live-Fassung). */
function oeffneZeitTag(tag, start) {
  const c = AZ.cfg, eintraege = azEintraegeAmTag(tag);
  if (start === undefined) start = eintraege.length ? eintraege[0].start : null;
  azBearbeiteStart = start || null;
  const bearbeitet = azBearbeiteStart ? eintraege.find((e) => e.start === azBearbeiteStart) : null;
  if (azBearbeiteStart && !bearbeitet) azBearbeiteStart = null;
  const von = bearbeitet ? azUhrzeit(bearbeitet.start) : (c.letzteVon || "06:00");
  const bis = bearbeitet ? azUhrzeit(bearbeitet.ende) : (c.letzteBis || "15:30");
  const pause = bearbeitet ? azTagPause(bearbeitet) : azPauseAn();
  const zeigeListe = eintraege.length > 1 || (eintraege.length === 1 && !bearbeitet);
  const d = new Date(tag + "T12:00:00");
  oeffneEbene(`
    ${bogenKopf(WT_LANG[d.getDay()] + (tag === heuteIso() ? " · heute" : ""), bearbeitet ? "Arbeitszeit ändern" : "Arbeitszeit eintragen")}
    <p class="klein-text" style="margin-top:6px">${bearbeitet ? "Die Zeiten dieses Eintrags werden überschrieben – es entsteht kein zweiter Eintrag." : "Für vergessenes Stempeln, zum Berichtigen oder zum Nachpflegen mehrerer Tage."}</p>
    ${zeigeListe ? `<div class="liste z-eintraege">${eintraege.map((e) => `<div class="zeile${e.start === azBearbeiteStart ? " an" : ""}">
        <span class="z-text">${azUhrzeit(e.start)}–${azUhrzeit(e.ende)}<small>${azHhmm(azNettoFuer(e))} Std.${azAbzugFuer(e) ? " · −" + azAbzugFuer(e) + " Min. Pause" : ""}</small></span>
        <span class="archiv-knoepfe"><button class="knopf-klein" data-zeintrag="${e.start}" data-ztagiso="${tag}">Ändern</button><button class="knopf-klein" data-zloeschen="${e.start}" data-ztagiso="${tag}" aria-label="Löschen">${ic("muell")}</button></span></div>`).join("")}</div>` : ""}
    <label class="feld" style="margin-top:14px"><span>Datum</span><input id="azNachDatum" type="date" value="${tag}"></label>
    <div class="zeiten">${zeitfeld("zNachVon", "Arbeitsbeginn", von, "azNachVon")}${zeitfeld("zNachBis", "Feierabend", bis, "azNachBis")}</div>
    <input type="hidden" id="azNachVon" value="${von}"><input type="hidden" id="azNachBis" value="${bis}">
    <label class="schalter" style="margin-top:10px"><span><b>An diesem Tag Pause gemacht</b><small>30 Min. ab 6 Std., 45 Min. ab 9 Std. (§ 4 ArbZG)</small></span><input type="checkbox" id="azNachPause" ${pause ? "checked" : ""}></label>
    <div class="status-text z-alt" id="azNachVorschau"></div>
    ${bearbeitet
      ? `<button class="haupt-knopf" data-aktion="z-tag-speichern">Speichern</button>
         <button class="text-knopf" data-zeintrag="" data-ztagiso="${tag}">+ Weiterer Eintrag</button>
         <button class="text-knopf gefahr" data-zloeschen="${bearbeitet.start}" data-ztagiso="${tag}">Eintrag löschen</button>`
      : `<button class="haupt-knopf" data-aktion="z-tag-speichern">Eintragen</button>
         <button class="text-knopf" data-aktion="z-tag-weiter">Eintragen &amp; nächster Tag</button>`}`);
  ["azNachDatum", "azNachVon", "azNachBis"].forEach((id) => document.getElementById(id).addEventListener("input", azNachVorschau));
  document.getElementById("azNachPause").addEventListener("change", azNachVorschau);
  azNachVorschau();
}
/* Speichern ueber azNachtragenSpeichern(false). Ob gespeichert wurde, sagt
   die Funktion nicht - sie bricht bei fehlenden Zeiten oder "Abbrechen" in
   einer Rueckfrage still ab. Erkennungszeichen: Nur nach dem Speichern ruft
   sie azSchliesseModal() auf, und das leert #modalRoot. Darum liegt dort
   vorher eine Marke. */
function zeitTagSpeichern(weiter) {
  const tag = (document.getElementById("azNachDatum") || {}).value || "";
  const root = document.getElementById("modalRoot");
  if (root && !root.innerHTML.trim()) root.innerHTML = '<span hidden data-zeitmarke></span>';
  azNachtragenSpeichern(false);
  const marke = root && root.querySelector("[data-zeitmarke]");
  if (marke) { marke.remove(); return; }           // nicht gespeichert - der Bogen bleibt offen
  renderZeit({ halteScroll: true, auftritt: false });
  if (weiter && tag) { const d = new Date(tag + "T12:00:00"); d.setDate(d.getDate() + 1); oeffneZeitTag(isoVon(d), null); toast("Gespeichert · nächster Tag"); return; }
  schliesseEbene(); toast("Gespeichert");
}
function zeitLoeschen(start, tag) {
  const vorher = AZ.tage.length;
  azLoescheTag(start);             // fragt nach, loescht, azRender()
  if (AZ.tage.length === vorher) return;
  renderZeit({ halteScroll: true, auftritt: false });
  if (azEintraegeAmTag(tag).length) oeffneZeitTag(tag); else schliesseEbene();
  toast("Eintrag gelöscht");
}

/* Bogen: ganzen Monat fuellen - azMonatFuellen() der Live-Fassung */
function oeffneZeitFuellen() {
  const c = AZ.cfg, sel = document.getElementById("azMonat"); zeitMonatKey();
  const monate = [...sel.options].map((o) => `<option value="${o.value}"${o.value === sel.value ? " selected" : ""}>${esc(o.textContent)}</option>`).join("");
  const von = c.letzteVon || "06:00", bis = c.letzteBis || "15:30";
  oeffneEbene(`
    ${bogenKopf("Ganzer Monat auf einmal", "Zeiten für alle Tage")}
    <p class="klein-text" style="margin-top:6px">Füllt einen ganzen Monat mit denselben Zeiten – für alle, die fast jeden Tag gleich anfangen und aufhören. Danach im Kalender nur noch die Ausnahmen antippen.</p>
    <label class="feld" style="margin-top:14px"><span>Monat</span><select id="azFuellMonat">${monate}</select></label>
    <div class="zeiten">${zeitfeld("zFuellVon", "Arbeitsbeginn", von, "azFuellVon")}${zeitfeld("zFuellBis", "Feierabend", bis, "azFuellBis")}</div>
    <input type="hidden" id="azFuellVon" value="${von}"><input type="hidden" id="azFuellBis" value="${bis}">
    <label class="schalter" style="margin-top:10px"><span><b>An diesen Tagen Pause gemacht</b><small>30 Min. ab 6 Std., 45 Min. ab 9 Std. (§ 4 ArbZG)</small></span><input type="checkbox" id="azFuellPause" ${azPauseAn() ? "checked" : ""}></label>
    <div class="status-text z-alt" id="azFuellVorschau"></div>
    <button class="haupt-knopf" id="azFuellKnopf" data-aktion="z-fuellen">Eintragen</button>`);
  ["azFuellMonat", "azFuellVon", "azFuellBis"].forEach((id) => document.getElementById(id).addEventListener("input", azFuellVorschau));
  document.getElementById("azFuellMonat").addEventListener("change", azFuellVorschau);
  document.getElementById("azFuellPause").addEventListener("change", azFuellVorschau);
  azFuellVorschau();
}
function zeitFuellen() {
  const vorher = AZ.tage.length;
  azMonatFuellen();                // fragt nach, fuellt, stellt #azMonat auf den Monat, azRender()
  if (AZ.tage.length === vorher) return;
  schliesseEbene(); renderZeit({}); toast(`${AZ.tage.length - vorher} Tage eingetragen`);
}

/* Bogen: Vorgaben. Wirkt sofort wie in der Live-Fassung (dort speichert
   jede Eingabe) - ueber deren Felder und azSaveCfg(). */
function oeffneZeitVorgaben() {
  azRender(); azPausenErklaerung();
  const alt = document.getElementById("azPausenErklaerung");
  oeffneEbene(`
    ${bogenKopf("Gilt für die Überstunden-Rechnung", "Vorgaben")}
    <label class="feld" style="margin-top:14px"><span>Regulärer Arbeitstag (Std.) – reine Arbeitszeit, ohne Pause</span><input id="zSoll" type="number" step="0.25" min="0" value="${AZ.cfg.soll}"></label>
    <p class="klein-text">Üblich: <b>8 Std.</b> Arbeit. Mit den 30 Minuten Pause sind das 8:30 Anwesenheit – <b>hier gehören die 8 hinein, nicht die 8,5.</b></p>
    <label class="schalter" style="margin-top:12px"><span><b>Mache ich üblicherweise Pause?</b><small>Nur die Vorgabe für neue Tage – pro Tag umstellbar</small></span><input type="checkbox" id="zPause" ${azPauseAn() ? "checked" : ""}></label>
    <div class="status-text z-alt" id="zErklaerung">${alt ? alt.innerHTML : ""}</div>
    <button class="haupt-knopf" data-zu>Fertig</button>`);
  const anwenden = () => {
    const s = document.getElementById("azSoll"), p = document.getElementById("azGesetzlichePause");
    if (s) s.value = document.getElementById("zSoll").value;
    if (p) p.checked = document.getElementById("zPause").checked;
    azSaveCfg();                   // speichert und rendert die alte Ansicht
    const a = document.getElementById("azPausenErklaerung"); if (a) document.getElementById("zErklaerung").innerHTML = a.innerHTML;
    renderZeit({ halteScroll: true, auftritt: false });
  };
  document.getElementById("zSoll").addEventListener("input", anwenden);
  document.getElementById("zPause").addEventListener("change", anwenden);
}

/* Bogen: Ordner (abgelegte Monats- und Jahres-PDFs, wie in der Live-Fassung) */
async function oeffneZeitOrdner() {
  const keys = (await pdfDbSchluessel()).map(String).filter((k) => /^zeit(jahr)?-/.test(k)).sort().reverse();
  oeffneEbene(`${bogenKopf("Abgelegte Monate und Jahre", "Arbeitszeit-Ordner")}
    <div class="liste" style="margin-top:16px">${keys.length ? keys.map((k) => `<div class="zeile archiv-zeile"><span class="z-ic">${ic("archiv")}</span>
      <span class="z-text">${esc(ORDNER.zeit.titelFn(k))}</span>
      <span class="archiv-knoepfe"><button class="knopf-klein" data-pdf="${k}" data-titel="${esc(ORDNER.zeit.titelFn(k))}">PDF</button></span></div>`).join("")
      : `<div class="zeile"><span class="z-text">Noch nichts abgelegt<small>„Speichern / Ablegen“ legt den gewählten Monat und das Jahr hier ab.</small></span></div>`}</div>`);
}

/* ---------------- Neue Ware zaehlen ----------------
   Nur wer tabErlaubt("ware") hat (Mirko). Entwurf: mirko-entwurf.html?b=ware
   (hell A, dunkel B), von Mirko am 08.10.2026 bestellt.
   Daten und Rechnung der Live-Fassung: kaeState (Speicher "kfz-kaefig-v1"),
   kaeSichern, kaeZeilenSumme, kaeGesamt, kaeSichtbar, kaeHatInhalt; das
   Urteil gegen den Lieferschein schreibt kaeRechne() in die alte Ansicht
   (#kaeUrteil, #kaeDiff) - von dort wird es uebernommen, nicht nachgebaut.
   Zaehlwerk: __kaeZaehler + kaeZaehlerPlus/Minus/Uebernehmen der Live-
   Fassung; die Anzeige hat dieselbe Id (#kaeZaehlZahl).
   ⚠ Der Knopf an jeder Zeile oeffnet das ZAEHLWERK (je Stange einmal
   tippen) - im Entwurfsbild stand faelschlich "liest die Stueckzahl vom
   Etikett". Das gibt es nicht (im Code nachgesehen: kaeZaehlerAuf(),
   08.10.2026; Mirko darauf hingewiesen). */
const stk = (n) => (Number(n) || 0).toLocaleString("de-DE");
function wareUrteil() {
  kaeRechne();
  const u = document.getElementById("kaeUrteil"), d = document.getElementById("kaeDiff");
  return { klasse: u ? u.className.replace("kae-urteil", "").trim() : "offen", text: u ? u.textContent.trim() : "", diff: d ? d.value : "" };
}
function wareRing() {
  const ls = invZahl(kaeState.lieferschein || ""), g = kaeGesamt();
  if (!String(kaeState.lieferschein || "").trim()) return "";
  const diff = ls - g, g2 = 92, s = 9, r = (g2 - s) / 2, u = 2 * Math.PI * r, anteil = ls > 0 ? Math.max(0, Math.min(1, g / ls)) : 1;
  const [zahl, wort, klasse] = diff === 0 ? ["✓", "passt", "passt"] : diff > 0 ? [stk(diff), diff === 1 ? "fehlt" : "fehlen", "fehlt"] : [stk(-diff), "zu viel", "fehlt"];
  return `<div class="ring-box" style="width:${g2}px;height:${g2}px"><svg class="ring" width="${g2}" height="${g2}" viewBox="0 0 ${g2} ${g2}" aria-hidden="true">
    <circle cx="${g2 / 2}" cy="${g2 / 2}" r="${r}" fill="none" stroke="rgba(255,255,255,.1)" stroke-width="${s}"/>
    <circle class="ring-wert" cx="${g2 / 2}" cy="${g2 / 2}" r="${r}" fill="none" stroke="${diff === 0 ? "url(#riebRing)" : "url(#riebS)"}" stroke-width="${s}" stroke-linecap="round"
      stroke-dasharray="${u.toFixed(2)}" stroke-dashoffset="${(u * (1 - anteil)).toFixed(2)}" transform="rotate(-90 ${g2 / 2} ${g2 / 2})" style="--u:${u.toFixed(2)}"/></svg>
    <div class="ring-mitte ${klasse}"><b>${zahl}</b><small>${wort}</small></div></div>`;
}
function wareZahlzeile() {
  const g = kaeGesamt(), n = kaeZeilenMitInhalt(), ls = String(kaeState.lieferschein || "").trim();
  return `<div><span class="zahl b-zahl" aria-label="${stk(g)} Stangen"><span class="z-ganz">${stk(g)}</span><span class="z-rest">&nbsp;Stangen</span></span>
    <div class="b-unter">gezählt · ${ls ? "laut Lieferschein " + stk(invZahl(ls)) : n + (n === 1 ? " Zeile" : " Zeilen")}</div></div>${wareRing()}`;
}
function wareZeile(i) {
  const z = kaeZeile(i), gr = String(z.gr || KAE_STANDARD), s = kaeZeilenSumme(i);
  return `<div class="w-reihe${kaeHatInhalt(i) ? " voll" : ""}"><span class="nr">${i + 1}</span>
    <input class="eingabe" data-wkae="${i}" data-wkaef="kar" inputmode="numeric" placeholder="Kartons" aria-label="Kartons, Zeile ${i + 1}" value="${esc(z.kar || "")}">
    <select class="eingabe" data-wkae="${i}" data-wkaef="gr" aria-label="Stangen je Karton, Zeile ${i + 1}">${KAE_GROESSEN.map((x) => `<option value="${x}"${String(x) === gr ? " selected" : ""}>${x}er</option>`).join("")}</select>
    <input class="eingabe" data-wkae="${i}" data-wkaef="anz" inputmode="numeric" placeholder="Stangen" aria-label="Lose Stangen, Zeile ${i + 1}" value="${esc(z.anz || "")}">
    <button class="w-zaehl" data-wzaehl="${i}" aria-label="Zählwerk, Zeile ${i + 1}">${ic("zaehl")}</button>
    <span class="w-zs">${s ? "= " + stk(s) + " Stangen" : ""}</span></div>`;
}
function renderWare(opt = {}) {
  const sek = document.getElementById("s-ware"); if (!sek) return;
  const scroll = sek.scrollTop, u = wareUrteil(), n = kaeSichtbar();
  sek.innerHTML = kopf("ware", "Neue Ware zählen", { zahl: "-", unter: "", mini: `${stk(kaeGesamt())} Stangen gezählt` }) + `
  <div class="blatt"><div class="blatt-innen">
    <div class="seite">
      <div class="karte w-abgleich">
        <div class="k-titelzeile"><span class="ueberschrift">Abgleich mit dem Lieferschein</span></div>
        <div class="felder">
          <label class="feld"><span>Laut Lieferschein</span><input id="wLieferschein" inputmode="numeric" placeholder="Stangen" value="${esc(kaeState.lieferschein || "")}"></label>
          <div class="feld"><span>Differenz</span><b id="wDiff">${esc(u.diff || "–")}</b></div>
        </div>
        <p class="w-urteil ${u.klasse}" id="wUrteil"><span class="punkt"></span><span>${esc(u.text)}</span></p>
      </div>
      <div class="links">
        <button data-aktion="w-fuehrung">${ic("start")}Schritt für Schritt</button>
        <button data-aktion="w-neu">${ic("muell")}Neue Zählung</button>
      </div>
      <p class="blatt-fuss">Gezählt wird in Stangen: volle Kartons mal Stangen je Karton, dazu die losen Stangen. Bleibt nur auf diesem Gerät.</p>
    </div>
    <div class="haupt">
      ${wareSprachKarte()}
      <div class="karte">
        <div class="w-kopf"><span></span><span>Kartons</span><span>je Karton</span><span>lose Stangen</span><span></span></div>
        <div id="wZeilen">${Array.from({ length: n }, (_, i) => wareZeile(i)).join("")}</div>
        <p class="klein-text">Neue Zeilen kommen von selbst dazu. Der Knopf rechts öffnet das Zählwerk: je Stange einmal tippen – man schaut die Ware an, nicht das Display.</p>
      </div>
    </div>
  </div></div>`;
  sek.querySelector(".b-zahlzeile").innerHTML = wareZahlzeile();
  if (opt.halteScroll) sek.scrollTop = scroll;
  kopfScroll(sek);
}
/* Kopf, Differenz und Urteil auffrischen, ohne die Felder neu zu zeichnen -
   sonst verloere das Feld, in dem gerade getippt wird, die Schreibmarke. */
function wareAuffrischen() {
  const sek = document.getElementById("s-ware"); if (!sek) return;
  const z = sek.querySelector(".b-zahlzeile"); if (z) z.innerHTML = wareZahlzeile();
  const u = wareUrteil();
  const d = document.getElementById("wDiff"); if (d) d.textContent = u.diff || "–";
  const p = document.getElementById("wUrteil"); if (p) { p.className = "w-urteil " + u.klasse; p.lastElementChild.textContent = u.text; }
  const mk = sek.querySelector(".mk-text span"); if (mk) mk.textContent = `${stk(kaeGesamt())} Stangen gezählt`;
}
/* Eingabe in einer Zeile - derselbe Weg wie beiEingabe() der Live-Fassung */
function wareEingabe(el) {
  const i = el.dataset.wkae;
  kaeState.zeilen[i] = kaeState.zeilen[i] || {};
  kaeState.zeilen[i][el.dataset.wkaef] = el.value;
  kaeSichern();
  const reihe = el.closest(".w-reihe"), s = kaeZeilenSumme(i);
  reihe.classList.toggle("voll", kaeHatInhalt(i));
  reihe.querySelector(".w-zs").textContent = s ? "= " + stk(s) + " Stangen" : "";
  wareAuffrischen();
  /* Nachwachsen: neue Zeile, Schreibmarke bleibt im selben Feld */
  if (document.querySelectorAll("#s-ware .w-reihe").length !== kaeSichtbar()) {
    const pos = el.selectionStart, f = el.dataset.wkaef;
    renderWare({ halteScroll: true });
    const neu = document.querySelector(`#s-ware [data-wkae="${i}"][data-wkaef="${f}"]`);
    if (neu) { neu.focus({ preventScroll: true }); try { neu.setSelectionRange(pos, pos); } catch (x) { /* select */ } }
  }
}
/* ---- Zählen per Sprache (14.10.2026, sprachtest/mengen.js ware()) - freiwillig, über den Zeilen ----
   "3 Kartons à 20", "12 Stangen", "Lieferschein 240": je Ansage eine neue Zeile (Regal für Regal bleibt
   sichtbar, wie beim Tippen). Erst "Übernehmen" schreibt. Eine Zahl ohne "Kartons"/"Stangen" wird nie gezählt. */
let wareSprache = { text: "", ergebnis: null };
function wareSprachePlan() {
  const r = window.SpracheMengen.ware(wareSprache.text, KAE_GROESSEN, KAE_STANDARD), belegt = new Set();
  const frei = () => { for (let i = 0; i < 500; i++) if (!kaeHatInhalt(i) && !belegt.has(i)) { belegt.add(i); return i; } return -1; };
  return { plan: r.posten.map((p) => Object.assign({}, p, { zeile: frei(), stangen: p.art === "karton" ? p.kartons * p.groesse : p.anzahl })), unklar: r.unklar, lieferschein: r.lieferschein };
}
function wareSprachVorschau() {
  if (!wareSprache.text.trim()) {
    const e = wareSprache.ergebnis;
    return e ? `<p class="klein-text i-sp-ok">Übernommen: ${e.zeilen} ${e.zeilen === 1 ? "Zeile" : "Zeilen"}${e.lieferschein ? " und der Lieferschein" : ""} – bitte unten prüfen.</p>` : "";
  }
  const { plan, unklar, lieferschein } = wareSprachePlan();
  const hinweise = unklar.map((u) => `Nicht verstanden: „${u}“ – bitte z. B. „3 Kartons à 20“ oder „12 Stangen“ sagen`);
  plan.filter((p) => p.standard).forEach((p) => hinweise.push(`„${p.text}“: Kartongröße nicht gesagt – ${KAE_STANDARD}er angenommen (wie beim Tippen), bitte prüfen`));
  const summe = plan.reduce((s, p) => s + p.stangen, 0);
  const zeilen = plan.map((p) => `<div class="i-sp-zeile"><span><b>${p.art === "karton" ? `${p.kartons} ${p.kartons === 1 ? "Karton" : "Kartons"} à ${p.groesse}` : `${stk(p.anzahl)} lose Stangen`}</b><small>neue Zeile ${p.zeile + 1}</small></span><span class="r">${stk(p.stangen)} Stangen</span></div>`);
  if (lieferschein != null) zeilen.push(`<div class="i-sp-zeile"><span><b>Laut Lieferschein</b><small>${String(kaeState.lieferschein || "").trim() ? "ersetzt " + stk(invZahl(kaeState.lieferschein)) : "noch leer"}</small></span><span class="r">${stk(lieferschein)} Stangen</span></div>`);
  const danach = kaeGesamt() + summe, ls = lieferschein != null ? lieferschein : (String(kaeState.lieferschein || "").trim() ? invZahl(kaeState.lieferschein) : null);
  const abgleich = ls == null ? "" : danach === ls ? " · passt zum Lieferschein" : ls > danach ? ` · ${stk(ls - danach)} fehlen zum Lieferschein` : ` · ${stk(danach - ls)} mehr als laut Lieferschein`;
  return (zeilen.length ? `<div class="i-sp-liste">${zeilen.join("")}${plan.length ? `<div class="i-sp-zeile i-sp-summe"><span>Zusammen<small>danach gezählt: ${stk(danach)} Stangen${abgleich}</small></span><span class="r">${stk(summe)} Stangen</span></div>` : ""}</div>` : "")
    + hinweise.map((h) => `<div class="hinweis">${ic("info")}<span>${esc(h)}</span></div>`).join("")
    + `<div class="i-sp-knoepfe"><button class="haupt-knopf" data-aktion="w-sprache-uebernehmen"${plan.length || lieferschein != null ? "" : " disabled"}>Übernehmen</button><button class="knopf-klein" data-aktion="w-sprache-leeren">Leeren</button></div>`;
}
function wareSprachKarte() {
  if (!window.SpracheMengen) return "";
  return `<div class="karte i-sprechen w-sprechen"><span class="ueberschrift">Zählen per Sprache (freiwillig)</span>
    <textarea id="wSprache" rows="2" autocomplete="off" placeholder="Antippen, Mikrofon der Tastatur: „3 Kartons à 20, 12 Stangen …“">${esc(wareSprache.text)}</textarea>
    <p class="klein-text">Je Ansage eine Zeile. „Lieferschein 240“ trägt die Zahl vom Lieferschein ein.</p>
    <div id="wSpracheVorschau">${wareSprachVorschau()}</div></div>`;
}
/* Tippen/Diktieren: nur die Vorschau neu - die Seite NICHT neu zeichnen, sonst endet das Diktat */
function wareSpracheEingabe(el) {
  wareSprache.text = el.value; wareSprache.ergebnis = null;
  const v = document.getElementById("wSpracheVorschau"); if (v) v.innerHTML = wareSprachVorschau();
}
function wareSpracheUebernehmen() {
  if (!wareSprache.text.trim()) return;
  const { plan, lieferschein } = wareSprachePlan();
  plan.forEach((p) => { if (p.zeile >= 0) kaeState.zeilen[p.zeile] = p.art === "karton" ? { kar: String(p.kartons), gr: String(p.groesse) } : { anz: String(p.anzahl) }; });
  if (lieferschein != null) kaeState.lieferschein = String(lieferschein);
  kaeSichern();
  wareSprache = { text: "", ergebnis: { zeilen: plan.length, lieferschein: lieferschein != null } };
  renderWare({ halteScroll: true });
  const sek = document.getElementById("s-ware"), k = sek && sek.querySelector(".w-sprechen");
  if (k) { sek.scrollTop = Math.max(0, sek.scrollTop + k.getBoundingClientRect().top - sek.getBoundingClientRect().top - 76); kopfScroll(sek); }
  toast("Übernommen");
}
/* Zaehlwerk als Bogen */
function oeffneZaehlwerk(i) {
  __kaeZaehler = { zeile: i, stand: invZahl(kaeZeile(i).anz) };
  oeffneEbene(`${bogenKopf("Zeile " + (Number(i) + 1) + " · lose Stangen", "Zählwerk")}
    <button class="w-flaeche" data-aktion="w-plus" aria-label="Eine Stange dazu"><span class="w-zahl" id="kaeZaehlZahl">${__kaeZaehler.stand}</span><span>Tippen = eine Stange</span></button>
    <div class="w-leiste"><button class="knopf-klein" data-aktion="w-plus10">+10</button><button class="knopf-klein" data-aktion="w-minus">− Zurück</button></div>
    <button class="haupt-knopf" data-aktion="w-uebernehmen">Übernehmen</button>
    <p class="klein-text" style="text-align:center">Schließen ohne Übernehmen ändert nichts.</p>`);
}

/* ---------------- Fahrzeug-Inventur ----------------
   Nur wer tabErlaubt("inventur") hat (Mirko). Entwurf:
   Neues Design/mirko-entwurf.html?b=inventur - hell Fassung A, dunkel
   Fassung B, von Mirko am 08.10.2026 so bestellt. Gebaut 08.10.2026 abends.

   Gerechnet, gespeichert, gedruckt und abgelegt wird NUR ueber die Live-
   Fassung (index.html):
     Daten          invState (Speicher "kfz-bestandsaufnahme-v2"), invSchreibe
                    (speichert und pflegt den KVP-Vorrat mit), invRechne
     Rechnung       invZeilenSumme / invGruppenSumme / invIstbestand
     Zeilenfolge    INV_FOLGE + invSichtbareZeilen - EINE durchlaufende Liste
                    (Mirko 04.09.2026: "keine Warengruppen mehr"). Die Karten
                    je Warengruppe sind nur die Abschnitte dieser Liste: ist
                    eine Blattspalte voll, geht es in der naechsten Karte
                    weiter ("die Zeilen laufen durch wie heute", Entwurf).
                    Die Nummern laufen deshalb auch durch, wie in der Live-
                    Fassung ("Zeile 45 von 102").
     Kopfdaten      kopfDialog / kopfFahrer / kopfTour / kopfDatum / kopfFixbestand
     PDF            invZeigeErgebnis (ansehen) / invSpeichern / invDrucken
     Abschliessen   invAbschliessen (verlangt die Unterschrift oder den
                    Haken "von Hand", legt eine Kopie in den Ordner)
     Neu            invNeueInventur
   ⛔ Kein "An NL senden" - E-Mail ganz raus (Entscheidung 26).
   ⛔ Sollbestand und Differenz bleiben leer (Entscheidung 19).

   ZWEI BLAETTER, EINE WAHRHEIT (Mirko 08.10.2026, Entwurf
   inventur-blatt-entwurf.html freigegeben: "sieht gut aus, das pdf soll
   aber immer das original pdf sein das mit den gelben spalten"):
     Ansicht "Blatt" hier   das Blatt im NEUEN Design - dieselben Spalten,
                            Zeilen und Felder an derselben Stelle wie der
                            Vordruck, zum Eintragen (vbBlatt)
     #invBlatt (alt)        der ORIGINAL-Vordruck mit den gelben Spalten. Er
                            bleibt unveraendert in der alten Oberflaeche
                            stehen und wird wie bisher fuer PDF und Druck
                            abfotografiert (invBlattCanvas). Er wird hier NIE
                            umgestaltet oder verschoben.
   Jede Eingabe hier schreibt in invState UND in das passende Feld des
   Original-Vordrucks - derselbe Weg wie beiEingabe() der Live-Fassung.
   Name, Tour, Datum und Fixbestand oeffnen das Kopfdaten-Fenster: die
   Kopfdaten werden nur an EINER Stelle gepflegt (Mirko 05.09.2026). */
const GFARBE = { cig: "g1", zig: "g2", tab: "g3", rba: "g4", hue: "g5", son: "g6", lief: "g7" };
let invAnsicht = "erfassen";        // "erfassen" | "blatt"
function invErfasst() {
  return INV_GRUPPEN.reduce((s, g) => { let c = 0; for (let i = 0; i < invKapazitaet(g); i++) if (invHatInhalt(g, i)) c++; return s + c; }, 0);
}
function invUnter() {
  const n = invErfasst(), tour = kopfTour();
  return `Istbestand · ${n} ${n === 1 ? "Zeile" : "Zeilen"} erfasst${tour ? " · Tour " + esc(tour) : ""} · ${esc(kopfDatum())}`;
}
function invZahlzeile() {
  const ist = invIstbestand();
  return `<div><span class="zahl b-zahl" aria-label="${euro(ist)} Euro Istbestand">${zahlEuro(ist, ist)}</span><div class="b-unter">${invUnter()}</div></div>`;
}
function invAnteil(erscheint) {
  const teile = INV_GRUPPEN.map((g) => ({ g, s: invGruppenSumme(g) })).filter((x) => x.s > 0);
  const leer = INV_GRUPPEN.length - teile.length;
  const rest = !teile.length ? "Noch nichts gezählt" : leer ? `${leer} ${leer === 1 ? "Warengruppe" : "Warengruppen"} noch leer` : "";
  return `<div class="anteil${erscheint ? " erscheint" : ""}" id="iAnteil"><div class="anteil-bahn" aria-hidden="true">${teile.map((x) => `<i class="${GFARBE[x.g.id]}" style="flex:${x.s.toFixed(2)}"></i>`).join("")}</div>
    <div class="anteil-legende">${teile.map((x) => `<span><i class="${GFARBE[x.g.id]}"></i>${esc(x.g.kurz)} <b>${invFmt(x.s)} €</b></span>`).join("")}${rest ? `<span class="leer">${rest}</span>` : ""}</div></div>`;
}
function invReihe(nr, f) {
  const g = invGruppe(f.gid), w = invFeld(g.id, f.gi), s = invZeilenSumme(g, f.gi);
  const a = `data-ig="${g.id}" data-ii="${f.gi}"`;
  return `<div class="i-reihe${invHatInhalt(g, f.gi) ? " voll" : ""}"><span class="nr">${nr}</span>
    <input class="eingabe" ${a} data-ifeld="mg" inputmode="numeric" placeholder="Stück" aria-label="Menge, Zeile ${nr}" value="${esc(w.mg || "")}">
    <input class="eingabe" ${a} data-ifeld="kv" inputmode="decimal" placeholder="Preis" aria-label="KVP, Zeile ${nr}" value="${esc(w.kv || "")}">
    <span class="i-su">${s ? invFmt(s) : "–"}</span></div>`;
}
/* Die sichtbaren Zeilen der durchlaufenden Liste, je Warengruppe eine Karte */
function invKarten() {
  const n = invSichtbareZeilen(), karten = [];
  let akt = null;
  for (let i = 0; i < n; i++) {
    const f = INV_FOLGE[i];
    if (!akt || akt.gid !== f.gid) { akt = { gid: f.gid, zeilen: [] }; karten.push(akt); }
    else if (f.erste) akt.zeilen.push(`<div class="i-trenner">weiter in der nächsten Spalte auf dem Blatt</div>`);
    akt.zeilen.push(invReihe(i + 1, f));
  }
  const gk = karten.map((k) => {
    const g = invGruppe(k.gid), s = invGruppenSumme(g);
    return `<div class="karte i-gruppe" data-igruppe="${g.id}"><div class="gruppe-kopf"><b>${esc(g.kurz)}</b><span class="i-gsumme">${s ? invFmt(s) + " €" : "–"}</span></div>
      <div class="i-kopf"><span></span><span>Menge</span><span>KVP</span><span class="r">Summe</span></div>${k.zeilen.join("")}</div>`;
  }).join("");
  const lief = invGruppe("lief"), ls = lief ? invGruppenSumme(lief) : 0;
  const hinweis = n >= INV_FOLGE.length ? `Alle ${INV_FOLGE.length} Zeilen des Blattes sind angelegt.` : `Zeile ${n} von ${INV_FOLGE.length} · neue kommen von selbst dazu`;
  return gk + `<p class="klein-text i-zeilen">${hinweis}. Ist eine Spalte des Blattes voll, geht es in der nächsten Warengruppe weiter.</p>
    <div class="karte i-gruppe i-lief" data-igruppe="lief"><div class="gruppe-kopf"><b>Lieferscheine</b><span class="i-gsumme">${ls ? invFmt(ls) + " €" : "–"}</span></div>
      <p class="klein-text">Werden auf dem Blatt eingetragen (Nr., W-Gr., Summe) – hier steht nur die Summe.</p>
      <button class="knopf-klein" data-iansicht="blatt" style="margin-top:10px">Zum Blatt</button></div>`;
}

/* ---- Zählen per Sprache (14.10.2026, sprachtest/mengen.js) - freiwillig, über den Warengruppen ----
   Mirko: Einheit "Stangen × Stangenpreis", gesprochen "zum beispiel 40 mal 80". Was am meisten Zeit kostet:
   "das sortieren / aufräumen, dass alle preise beieinander liegen". Deshalb rechnet die App gleiche Preise
   zusammen: jeder Stapel wird angesagt, wie er liegt. Erst "Übernehmen" schreibt in die Zeilen - je Preis
   EINE Zeile; gibt es in der Spalte schon eine Zeile mit diesem Preis, wird ihre Menge erhöht (die Vorschau
   sagt das vorher). Danach ist alles wie von Hand getippt und kann geändert werden.
   Gesprochen wird über das Mikrofon der iPhone-Tastatur (Textfeld, kein Zahlenfeld) - getippt geht genauso. */
let invSprache = { text: "", ergebnis: null };
const invSpracheDa = () => !!window.SpracheMengen;
const invPreisText = (p) => (Number.isInteger(p) ? String(p) : p.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const invZeilenNr = (gid, gi) => INV_FOLGE.findIndex((f) => f.gid === gid && f.gi === gi) + 1;
/* Wohin jede Preisgruppe kommt: vorhandene Zeile gleichen Preises in derselben Spalte, sonst die nächste freie */
function invSprachePlan() {
  const r = window.SpracheMengen.lesen(invSprache.text), belegt = new Set();
  const vorrat = invKvpVorratLesen().map(invZahl);
  const plan = window.SpracheMengen.zusammen(r.posten).map((x) => {
    const g = invGruppe(x.gruppe);
    let gi = -1, bisher = 0;
    for (let i = 0; i < invKapazitaet(g); i++) {
      const f = invFeld(g.id, i);
      if (String(f.kv || "").trim() !== "" && invZahl(f.kv) === x.preis) { gi = i; bisher = invZahl(f.mg); break; }
    }
    if (gi < 0) for (let i = 0; i < invKapazitaet(g); i++) if (!invHatInhalt(g, i) && !belegt.has(g.id + "-" + i)) { gi = i; break; }
    if (gi >= 0) belegt.add(g.id + "-" + gi);
    return Object.assign({}, x, { g, gi, bisher, neuerPreis: vorrat.length > 0 && !vorrat.includes(x.preis) });
  });
  return { plan, unklar: r.unklar };
}
function invSprachVorschau() {
  if (!invSprache.text.trim()) {
    const e = invSprache.ergebnis;
    return e ? `<p class="klein-text i-sp-ok">Übernommen: ${e.zeilen} ${e.zeilen === 1 ? "Zeile" : "Zeilen"} – bitte unten prüfen.</p>${e.hinweise.map((h) => `<div class="hinweis">${ic("info")}<span>${esc(h)}</span></div>`).join("")}` : "";
  }
  const { plan, unklar } = invSprachePlan();
  const hinweise = unklar.map((u) => `Nicht verstanden: „${u}“ – bitte als „Menge mal Preis“ sprechen oder unten eintragen`);
  plan.forEach((x) => {
    if (x.gi < 0) hinweise.push(`${x.g.kurz}: keine freie Zeile mehr für ${invFmt(x.preis)} € – bitte auf dem Blatt eintragen`);
    if (x.neuerPreis) hinweise.push(`${invFmt(x.preis)} € gab es bisher nicht – stimmt die Reihenfolge „Menge mal Preis“?`);
  });
  const summe = plan.reduce((s, x) => s + x.menge * x.preis, 0);
  const zeilen = plan.map((x) => {
    const wohin = x.gi < 0 ? "keine freie Zeile" : x.bisher ? `Zeile ${invZeilenNr(x.g.id, x.gi)}: ${invPreisText(x.bisher)} + ${x.menge} = ${invPreisText(x.bisher + x.menge)}` : `neue Zeile ${invZeilenNr(x.g.id, x.gi)}`;
    return `<div class="i-sp-zeile"><span><b>${x.menge} × ${invFmt(x.preis)} €</b><small>${esc(x.g.kurz)} · ${esc(wohin)}${x.anzahl > 1 ? ` · aus ${x.anzahl} Ansagen` : ""}</small></span><span class="r">${invFmt(x.menge * x.preis)} €</span></div>`;
  });
  return (zeilen.length ? `<div class="i-sp-liste">${zeilen.join("")}<div class="i-sp-zeile i-sp-summe"><span>Zusammen</span><span class="r">${invFmt(summe)} €</span></div></div>` : "")
    + hinweise.map((h) => `<div class="hinweis">${ic("info")}<span>${esc(h)}</span></div>`).join("")
    + `<div class="i-sp-knoepfe"><button class="haupt-knopf" data-aktion="i-sprache-uebernehmen"${plan.some((x) => x.gi >= 0) ? "" : " disabled"}>Übernehmen</button><button class="knopf-klein" data-aktion="i-sprache-leeren">Leeren</button></div>`;
}
function invSprachKarte() {
  if (!invSpracheDa()) return "";
  return `<div class="karte i-sprechen"><span class="ueberschrift">Zählen per Sprache (freiwillig)</span>
    <textarea id="iSprache" rows="2" autocomplete="off" placeholder="Antippen, Mikrofon der Tastatur: „40 mal 80, 12 mal 100 …“">${esc(invSprache.text)}</textarea>
    <p class="klein-text">Jeden Stapel ansagen, wie er liegt – gleiche Preise rechnet die App zusammen.</p>
    <div id="iSpracheVorschau">${invSprachVorschau()}</div></div>`;
}
/* Tippen/Diktieren: nur die Vorschau neu - die Seite NICHT neu zeichnen, sonst endet das Diktat */
function invSpracheEingabe(el) {
  invSprache.text = el.value; invSprache.ergebnis = null;
  const v = document.getElementById("iSpracheVorschau"); if (v) v.innerHTML = invSprachVorschau();
}
function invSpracheUebernehmen() {
  if (!invSprache.text.trim()) return;
  const { plan } = invSprachePlan(), hinweise = [];
  const setze = (gid, gi, f, wert) => {
    invSchreibe(gid, gi, f, wert);
    const imBlatt = document.querySelector(`#inventurPanel [data-invg="${gid}"][data-invi="${gi}"][data-invf="${f}"]`);   // Original-Vordruck (Druck/PDF) mitziehen
    if (imBlatt) imBlatt.value = wert;
  };
  let n = 0;
  plan.forEach((x) => {
    if (x.gi < 0) { hinweise.push(`${x.g.kurz}: ${x.menge} × ${invFmt(x.preis)} € nicht übernommen – keine freie Zeile`); return; }
    setze(x.g.id, x.gi, "mg", invPreisText(x.bisher + x.menge));
    if (!x.bisher) setze(x.g.id, x.gi, "kv", invPreisText(x.preis));
    n++;
  });
  invRechne();
  invSprache = { text: "", ergebnis: { zeilen: n, hinweise } };
  renderInventur({ halteScroll: true });
  /* An den Anfang des Sprechfelds: „Übernommen“ oben, die Zeilen direkt darunter */
  const sek = document.getElementById("s-inventur"), k = sek && sek.querySelector(".i-sprechen");
  if (k) { sek.scrollTop = Math.max(0, sek.scrollTop + k.getBoundingClientRect().top - sek.getBoundingClientRect().top - 76); kopfScroll(sek); }
  toast(n ? "Übernommen" : "Nichts übernommen");
}

/* ---- Ansicht "Blatt": der Vordruck im NEUEN Design ----
   Aufbau wie invBaueRaster() der Live-Fassung: 6 Spalten nach sp.pos, je
   g.zeilen Zeilen, zwischen zwei Gruppen einer Spalte eine Leerzeile,
   Lieferscheine mit Zwischenkoepfen und "Geldk."; Kopf wie .inv-kopf, Fuss
   wie .inv-fuss. Angezeigt wird, was im Original-Vordruck steht (dessen
   Felder), damit Bildschirm und Ausdruck dasselbe tragen. */
const vbWert = (id) => { const el = document.getElementById(id); return el ? (el.value != null ? el.value : el.textContent) || "" : ""; };
function vbFeld(gid, gi, f, wert, art, label) {
  return `<input class="vb-e" data-ig="${gid}" data-ii="${gi}" data-ifeld="${f}"${art ? ` inputmode="${art}"` : ""} value="${esc(wert || "")}" aria-label="${label}" autocomplete="off">`;
}
function vbGruppe(g, sp, sIdx) {
  const titel = g.liefer ? ["Nr.", "W-Gr", "Summe"] : ["Menge", "KVP", "Summe"];
  const kopfZ = (k) => `<div class="${k}">${titel.map((x) => `<span>${x}</span>`).join("")}</div>`;
  const neuerBlock = [];
  if (g.unterbloecke) { let pz = 0; g.unterbloecke.forEach((n) => { pz += n; if (pz < g.zeilen) neuerBlock.push(pz); }); }
  let z = "";
  for (let r = 0; r < g.zeilen; r++) {
    const gi = sIdx * g.zeilen + r, w = invFeld(g.id, gi), nr = `${g.kurz}, Zeile ${r + 1}`;
    if (neuerBlock.indexOf(r) !== -1) z += kopfZ("vb-sub");
    if (g.liefer) {
      const marke = g.marke && g.marke[r];
      z += `<div class="vb-z">${marke ? `<span class="vb-fest">${esc(marke)}</span>` : vbFeld(g.id, gi, "nr", w.nr, "", "Nr., " + nr)}${vbFeld(g.id, gi, "wgr", w.wgr, "", "W-Gr, " + nr)}${vbFeld(g.id, gi, "su", w.su, "decimal", "Summe, " + nr)}</div>`;
    } else {
      const s = invZeilenSumme(g, gi);
      z += `<div class="vb-z">${vbFeld(g.id, gi, "mg", w.mg, "numeric", "Menge, " + nr)}${vbFeld(g.id, gi, "kv", w.kv, "decimal", "KVP, " + nr)}<span class="vb-su">${s ? invFmt(s) : ""}</span></div>`;
    }
  }
  if (g.leerzeileAmEnde) z += `<div class="vb-luecke"></div>`;
  const ss = invSpaltenSumme(g, sIdx);
  return `<div class="vb-gtitel${sp.titel ? "" : " leer"}"><i class="${GFARBE[g.id]}"></i>${esc(sp.titel || g.kurz)}</div>${kopfZ("vb-skopf")}${z}
    <div class="vb-summe"><span>Summe</span><b id="vbss-${g.id}-${sIdx}">${ss ? invFmt(ss) : ""}</b></div>`;
}
function vbBlatt() {
  const spalten = [[], [], [], [], [], []];
  INV_GRUPPEN.forEach((g) => g.spalten.forEach((sp, sIdx) => spalten[sp.pos].push({ g, sp, sIdx })));
  const raster = spalten.map((inhalt) => `<div class="vb-spalte${inhalt.some((x) => x.g.liefer) ? " vb-lief" : ""}">${inhalt.map((x, i) =>
    vbGruppe(x.g, x.sp, x.sIdx) + (i < inhalt.length - 1 ? `<div class="vb-luecke"></div>` : "")).join("")}</div>`).join("");
  const sig = localStorage.getItem("inventur_signature");
  const soll = vbWert("invSoll"), diff = vbWert("invDiff");
  const fuss = (id, label) => `<input class="vb-e" data-vbfuss="${id}" value="${esc(vbWert(id))}" aria-label="${label}" autocomplete="off">`;
  return `<div class="vb">
    <div class="vb-kopf">
      <div class="vb-titel"><b>KFZ Bestandsaufnahme</b><div class="vb-tour"><span class="vb-klein">Tour</span><button class="vb-wert" data-aktion="i-kopf" aria-label="Tour ändern">${esc(vbWert("invTour"))}</button></div></div>
      <div></div>
      <div class="vb-zelle"><span class="vb-klein">Name</span><button class="vb-wert" data-aktion="i-kopf" aria-label="Name ändern">${esc(vbWert("invFahrer"))}</button></div>
      <div class="vb-zelle"><span class="vb-klein">Datum</span><button class="vb-wert" data-aktion="i-kopf" aria-label="Datum ändern">${esc(vbWert("invDatum"))}</button></div>
      <div class="vb-zelle"><span class="vb-klein">&nbsp;</span><span class="vb-nl">${esc(vbWert("invNL"))}</span></div>
      <div class="vb-zwi"><span>Zwischeninventur</span></div>
    </div>
    <div class="vb-raster">${raster}</div>
    <div class="vb-fuss">
      <div class="vb-betrag">
        <span></span><span></span><span></span><span></span><span></span><span class="jn">ja</span><span class="jn">nein</span>
        <span></span><span></span><span></span><button class="fix" data-aktion="i-kopf">Fzg.-Fixbestand überprüft <b>${esc(kopfFixbestand())} €</b></button><span class="haken" aria-label="ja">✓</span><span class="kreis"></span>
        <span class="lab">Istbestand</span><span class="eh">Euro</span><span class="wert" id="vbIst">${esc(vbWert("invIstFeld"))}</span><span></span><span></span><span></span><span></span>
        <span class="lab">Sollbestand</span><span class="eh">Euro</span><span class="wert${soll ? "" : " hand"}">${soll ? esc(soll) : "von Hand"}</span><span></span><span></span><span></span><span></span>
        <span class="lab">Differenz</span><span class="eh">Euro +/−</span><span class="wert${diff ? "" : " hand"}">${diff ? esc(diff) : "von Hand"}</span><span class="b">b</span>${fuss("invFrei2", "Freies Feld neben b").replace('class="vb-e"', 'class="vb-e gross"')}<span></span><span></span>
        <span></span><span></span>${fuss("invFrei1", "Freies Feld unter der Differenz").replace('class="vb-e"', 'class="vb-e frei"')}<span></span><span></span><span></span>
      </div>
      <div class="vb-unter">
        <div class="vb-u"><span>Datum</span><button class="vb-uw" data-aktion="i-kopf" aria-label="Datum ändern">${esc(vbWert("invFDatum"))}</button></div>
        <div class="vb-u"><span>Verkaufsfahrer</span><div class="vb-sig">${sig ? `<img alt="Unterschrift" src="${sig}">` : ""}${fuss("invFFahrer", "Verkaufsfahrer")}
          <button class="vb-knopf" data-aktion="i-sig-einfuegen">${sig ? "Ersetzen" : "Foto"}</button>${sig ? `<button class="vb-knopf" data-aktion="i-sig-weg" aria-label="Unterschrift entfernen">${ic("x")}</button>` : ""}</div></div>
        <div class="vb-u"><span>GVL/TB/VR/…</span>${fuss("invFGvl", "GVL/TB/VR")}</div>
        <div class="vb-u"><span>Kontrolle</span>${fuss("invFKontrolle", "Kontrolle")}</div>
      </div>
    </div>
  </div>`;
}
/* Summen im neuen Blatt nachziehen (Zeile, alle Spalten, Istbestand) */
function vbAuffrischen(el) {
  const z = el && el.closest(".vb-z"), su = z && z.querySelector(".vb-su");
  if (su) { const s = invZeilenSumme(invGruppe(el.dataset.ig), Number(el.dataset.ii)); su.textContent = s ? invFmt(s) : ""; }
  INV_GRUPPEN.forEach((g) => g.spalten.forEach((sp, sIdx) => {
    const b = document.getElementById(`vbss-${g.id}-${sIdx}`); if (b) { const s = invSpaltenSumme(g, sIdx); b.textContent = s ? invFmt(s) : ""; }
  }));
  const ist = document.getElementById("vbIst"); if (ist) ist.textContent = vbWert("invIstFeld");
}
/* Fuss-Felder (GVL, Kontrolle, Verkaufsfahrer, die freien Felder) - derselbe
   Weg wie beiEingabe() der Live-Fassung, Zweig INV_FUSS_FELDER: Feld im
   Original-Vordruck setzen, invState.fuss, Stempel-Speicher pflegen, sichern. */
function vbFussEingabe(el) {
  const id = el.dataset.vbfuss, orig = document.getElementById(id);
  if (orig) orig.value = el.value;
  invState.fuss[id] = el.value;
  if (id === "invFKontrolle" || id === "invFFahrer") invStempelPflegen(id);
  invSichern();
}
function renderInventur(opt = {}) {
  const sek = document.getElementById("s-inventur"); if (!sek) return;
  invAufbauen();                    // baut das Blatt der Live-Fassung, falls noch nicht geschehen
  const scroll = sek.scrollTop, blatt = invAnsicht === "blatt";
  const schnell = [["i-drucken", "drucker", "Drucken", "erst"], ["i-ansehen", "auge", "PDF ansehen", ""], ["i-speichern", "laden", "PDF speichern", ""]];
  if (zeigtNeuerungen()) schnell.push(["i-abschliessen", "schloss", "Abschließen", ""]);
  const sig = localStorage.getItem("inventur_signature"), tour = kopfTour();
  const ansicht = `<div class="ansicht" role="group" aria-label="Ansicht">${[["erfassen", "Erfassen"], ["blatt", "Blatt"]].map(([a, t]) =>
    `<button data-iansicht="${a}" class="${invAnsicht === a ? "an" : ""}" aria-pressed="${invAnsicht === a}">${t}</button>`).join("")}</div>`;
  const schnellHTML = `<div class="schnell schnell-${schnell.length}">
        ${schnell.map(([a, i, t, k]) => `<button class="${k}" data-aktion="${a}"><span class="knopf">${ic(i)}</span>${t}</button>`).join("")}
      </div>`;
  const kopfHTML = kopf("inventur", "Fahrzeug-Inventur", {
    zahl: "-", rechts: ansicht, unten: invAnteil(opt.auftritt !== false && !opt.halteScroll),
    mini: `${euro(invIstbestand())} € · Istbestand`,
    miniRechts: `<button class="rund klein" data-aktion="i-drucken" aria-label="Drucken">${ic("drucker")}</button>` });
  /* Blatt: Knoepfe darueber, das Blatt ueber die volle Breite (Entwurf) */
  if (blatt) {
    sek.innerHTML = kopfHTML + `
  <div class="blatt"><div class="blatt-innen vb-innen">
    ${schnellHTML}
    <p class="vb-wisch-text">Zum Lesen seitlich wischen.</p>
    <div class="vb-wisch">${vbBlatt()}</div>
    <p class="vb-druck">${ic("info")}<span>Gedruckt und als PDF kommt weiterhin der <b>Original-Vordruck</b> heraus – mit denselben Werten.</span></p>
    <button class="haupt-knopf i-zurueck" data-iansicht="erfassen">Zurück zum Eingeben</button>
  </div></div>`;
    sek.querySelector(".b-zahlzeile").innerHTML = invZahlzeile();
    if (opt.halteScroll) sek.scrollTop = scroll;
    kopfScroll(sek);
    return;
  }
  sek.innerHTML = kopfHTML + `
  <div class="blatt"><div class="blatt-innen">
    <div class="seite">
      ${schnellHTML}
      <div class="hinweis karte i-hinweis">${ic("info")}<span>Die App rechnet den <b>Istbestand</b>. Sollbestand und Differenz kommen von Hand auf den Ausdruck.</span></div>
      <div class="karte karte-stamm">
        <div class="k-titelzeile"><span class="ueberschrift">Kopfdaten</span><button class="knopf-klein" data-aktion="i-kopf">Ändern</button></div>
        <div class="stamm-name">${esc(kopfFahrer() || "Name eintragen")}</div>
        <div class="stamm-chips"><span>${tour ? "Tour " + esc(tour) : "Tour fehlt"}</span><span>${esc(kopfDatum())}</span><span>Fixbestand ${esc(kopfFixbestand())} €</span></div>
      </div>
      ${zeigtDigitaleAbgabe() ? `<div class="karte karte-unterschrift i-unterschrift">
        <div class="k-titelzeile"><span class="ueberschrift">Unterschrift (Foto)</span>
          <span style="display:flex;gap:6px"><button class="knopf-klein" data-aktion="i-sig-einfuegen">${sig ? "Ersetzen" : "Einfügen"}</button>${sig ? `<button class="knopf-klein" data-aktion="i-sig-weg" aria-label="Unterschrift entfernen">${ic("x")}</button>` : ""}</span></div>
        ${sig ? `<img class="sig-vorschau" alt="Ihre Unterschrift" src="${sig}">` : `<p>Steht beim Verkaufsfahrer auf dem Blatt. Ohne Foto wird der Ausdruck von Hand unterschrieben.</p>`}
      </div>` : ""}
      <div class="links">
        <button data-aktion="i-fuehrung">${ic("start")}Schritt für Schritt</button>
        ${zeigtNeuerungen() ? `<button data-aktion="i-ordner">${ic("archiv")}Ordner</button>` : ""}
        <button data-aktion="i-neu">${ic("muell")}Neue Inventur</button>
      </div>
    </div>
    <div class="haupt">${invSprachKarte()}${invKarten()}</div>
  </div></div>`;
  sek.querySelector(".b-zahlzeile").innerHTML = invZahlzeile();
  if (opt.halteScroll) sek.scrollTop = scroll;
  kopfScroll(sek);
}
/* Kopf, Anteil und Summen auffrischen, ohne die Felder neu zu zeichnen -
   sonst verloere das Feld, in dem gerade getippt wird, die Schreibmarke. */
function invAuffrischen() {
  const sek = document.getElementById("s-inventur"); if (!sek) return;
  const z = sek.querySelector(".b-zahlzeile"); if (z) z.innerHTML = invZahlzeile();
  const a = document.getElementById("iAnteil"); if (a) a.outerHTML = invAnteil(false);
  sek.querySelectorAll(".i-gruppe").forEach((k) => {
    const g = invGruppe(k.dataset.igruppe), s = g ? invGruppenSumme(g) : 0, el = k.querySelector(".i-gsumme");
    if (el) el.textContent = s ? invFmt(s) + " €" : "–";
  });
  const mk = sek.querySelector(".mk-text span"); if (mk) mk.textContent = `${euro(invIstbestand())} € · Istbestand`;
}
/* Eingabe in einer Zeile (Erfassen ODER Blatt) - derselbe Weg wie
   beiEingabe() der Live-Fassung: speichern, das Feld im Original-Vordruck
   mitziehen, invRechne() fuer dessen Summen und den Istbestand. */
function invEingabe(el) {
  const gid = el.dataset.ig, i = Number(el.dataset.ii), f = el.dataset.ifeld, g = invGruppe(gid);
  invSchreibe(gid, i, f, el.value);
  const imBlatt = document.querySelector(`#inventurPanel [data-invg="${gid}"][data-invi="${i}"][data-invf="${f}"]`);
  if (imBlatt) imBlatt.value = el.value;
  invRechne();
  if (!el.closest(".i-reihe")) { vbAuffrischen(el); invAuffrischen(); return; }   // Ansicht "Blatt"
  const reihe = el.closest(".i-reihe"), s = invZeilenSumme(g, i);
  reihe.classList.toggle("voll", invHatInhalt(g, i));
  reihe.querySelector(".i-su").textContent = s ? invFmt(s) : "–";
  invAuffrischen();
  /* Nachwachsen: neue Zeile (oder neue Karte), Schreibmarke bleibt im Feld.
     Die GRUPPE gehoert in den Selektor - data-ii faengt in jeder Gruppe bei 0
     an (Fehler der Live-Fassung vom 23.09.2026, dort behoben). */
  if (document.querySelectorAll("#s-inventur .i-reihe").length !== invSichtbareZeilen()) {
    const pos = el.selectionStart;
    renderInventur({ halteScroll: true });
    const neu = document.querySelector(`#s-inventur [data-ig="${gid}"][data-ii="${i}"][data-ifeld="${f}"]`);
    if (neu) { neu.focus({ preventScroll: true }); try { neu.setSelectionRange(pos, pos); } catch (x) { /* egal */ } }
  }
}
function invAnsichtWechseln(a) {
  if (a === invAnsicht) return;
  invAnsicht = a;
  renderInventur({ halteScroll: true });
  const sek = document.getElementById("s-inventur"); if (sek && a === "erfassen") sek.scrollTop = 0;
}
/* Bogen: Ordner (abgeschlossene Inventuren, wie in der Live-Fassung) */
async function oeffneInvOrdner() {
  const keys = (await pdfDbSchluessel()).map(String).filter((k) => k.indexOf(ORDNER.inv.praefix) === 0).sort().reverse();
  oeffneEbene(`${bogenKopf("Abgeschlossene Inventuren", "Inventur-Ordner")}
    <div class="liste" style="margin-top:16px">${keys.length ? keys.map((k) => `<div class="zeile archiv-zeile"><span class="z-ic">${ic("archiv")}</span>
      <span class="z-text">${esc(ORDNER.inv.titelFn(k))}</span>
      <span class="archiv-knoepfe"><button class="knopf-klein" data-pdf="${k}" data-titel="${esc(ORDNER.inv.titelFn(k))}">PDF</button></span></div>`).join("")
      : `<div class="zeile"><span class="z-text">Noch nichts abgelegt<small>„Abschließen“ legt die Inventur hier als PDF ab – die Zählung bleibt dabei stehen.</small></span></div>`}</div>`);
}

/* ---------------- Navigation ---------------- */
const reduziert = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const vtDa = () => typeof document.startViewTransition === "function";
function namenLoeschen() { document.querySelectorAll("#rieb [data-vtn]").forEach((e) => { e.style.viewTransitionName = ""; e.removeAttribute("data-vtn"); }); }
function benenne(el, name) { if (el) { el.style.viewTransitionName = name; el.setAttribute("data-vtn", ""); } }
function kachelNamen(bereich) {
  const k = document.querySelector(`#rieb .kachel[data-ziel="${bereich}"]`); if (!k) return;
  benenne(k.querySelector(".k-grund"), "flaeche"); benenne(k.querySelector(".k-titel"), "titel"); benenne(k.querySelector(".zahl"), "zahl");
}
function kopfNamen(bereich, nurFlaeche) {
  const s = document.getElementById("s-" + bereich); if (!s) return;
  benenne(s.querySelector(".b-grund"), "flaeche"); benenne(s.querySelector(".blatt"), "blatt");
  if (!nurFlaeche) { benenne(s.querySelector(".b-titel"), "titel"); benenne(s.querySelector(".b-zahl"), "zahl"); }
}
const RENDER = { spesen: () => renderSpesen(), urlaub: renderUrlaub, jahr: () => renderJahr(), mehr: renderMehr, anleitung: renderAnleitung, zeit: () => renderZeit({}), ware: () => renderWare({}),
  /* Inventur: wer sie oeffnet, will zaehlen - immer zuerst "Erfassen" (Mirko
     03.09.2026, wie toggleInventurPanel). */
  inventur: () => {
    invAnsicht = "erfassen";
    renderInventur({});
  },
  /* Störungsliste (11.10.2026): eigene Datei stoerungen/oberflaeche.js. Kopf,
     Boegen und Hinweise kommen von hier - sie sieht aus wie jeder Bereich. */
  stoerungen: () => {
    if (window.Stoerungsliste && tabErlaubt("stoerungen"))
      window.Stoerungsliste.render({ kopf, ic, esc, oeffneEbene, schliesseEbene, toast, bogenKopf, kopfScroll });
  } };

/* Die alte Oberflaeche darunter auf denselben Bereich stellen - ohne dass
   die Weiche in zeigeTab() uns wieder aufruft. */
function zeigeTabAlt(tab) {
  zeigeTabAltLaeuft = true;
  try { zeigeTab(tab); } finally { zeigeTabAltLaeuft = false; }
}

function zeige(ziel) {
  document.querySelectorAll("#rieb .screen").forEach((s) => s.classList.toggle("aktiv", s.id === "s-" + ziel));
  document.body.classList.toggle("rieb-aktiv", !!ziel);
  if (ziel && ziel !== "start") { const s = document.getElementById("s-" + ziel); s.scrollTop = 0; s.classList.remove("eng"); kopfScroll(s); }
}

let vtNr = 0;
function geheZu(ziel, opt = {}) {
  if (ziel === aktuell && !opt.erzwingen) return;
  const von = aktuell;
  if (ziel === "start") {
    renderStart({});
    if (!opt.ohneAlt && typeof zeigeKachelStartseite === "function") { zeigeTabAltLaeuft = true; try { zeigeKachelStartseite(); } finally { zeigeTabAltLaeuft = false; } }
  } else {
    /* Die Störungsliste hat keine alte Oberflaeche darunter (11.10.2026). */
    if (!opt.ohneAlt && ziel !== "stoerungen") zeigeTabAlt(ziel);
    RENDER[ziel]();
  }
  const modus = !von ? "keiner" : von === "start" ? "auf" : ziel === "start" ? "zu" : "quer";
  const tausch = () => {
    namenLoeschen(); zeige(ziel);
    if (modus === "auf") kopfNamen(ziel);
    if (modus === "zu") kachelNamen(von);
    if (modus === "quer") kopfNamen(ziel, true);
    aktuell = ziel;
  };
  if (modus === "keiner" || !vtDa() || reduziert() || opt.ohneVT) { tausch(); namenLoeschen(); return; }
  namenLoeschen();
  if (modus === "auf") kachelNamen(ziel);
  if (modus === "zu") { const s = document.getElementById("s-" + von); if (s) s.classList.remove("eng"); kopfNamen(von); }
  if (modus === "quer") kopfNamen(von, true);
  document.documentElement.dataset.vt = modus;
  const nr = ++vtNr;
  const t = document.startViewTransition(tausch);
  t.finished.finally(() => { if (nr === vtNr) { namenLoeschen(); delete document.documentElement.dataset.vt; } });
}

/* In einen Bereich der ALTEN Oberflaeche (Knoepfe mit data-alt). Seit
   08.10.2026 abends hat kein Bereich mehr einen - bleibt als Weg erhalten. */
function inAlteOberflaeche(tab) {
  schliesseEbene();
  aktuell = null;
  zeige(null);
  zeigeTabAlt(tab);
}

/* ---------------- Gruss und Spruch des Tages (10.10.2026) ----------------
   Mirko: "der gruß guten morgen, guten mittag, ect, kannst du da individueller
   sein? gruß an den mitarbeiter, plus kurzer lustiger spruch oder ein
   motivationsspruch" - "ein spruch pro tag und gerne kreativ sein und neue
   dazu ausdenken, dass nicht immer nur dieselben kommen" - "gruß ebenfalls
   wechseln" - "moin meister kann auch dazu, zu jeder tageszeit". Sprueche aus
   den eigenen Daten: "auch dort ja". Freigegebene Liste:
   "Startseite – Gruß und Sprüche (Entwurf).md" im Vault.
   - Ein Spruch pro Tag, den ganzen Tag gleich. Jeder Mitarbeiter hat je Topf
     eine EIGENE Reihenfolge (gemischt mit seinem Namen als Saat); innerhalb
     eines Topfes kommt ein Spruch erst wieder, wenn alle durch sind.
   - Vorrang: krank > frei/Urlaub > Feiertag > Wochenende > Abgabe (Werktag
     1-3) > morgen Urlaub > letzter Werktag > Montag/Freitag > eigene Zahlen
     (jeder 5. Tag) > Jahreszeit (jeder 4. Tag) > allgemein.
   - Laeuft komplett auf dem Geraet, nichts geht an fremde Dienste.
   - Bewusst draussen: Rauchen/Tabak, die Firma, Alkohol, Politik, Religion. */
const GRUSS = {
  frueh: ["Guten Morgen", "Früh dran heute", "Schon wach"],
  morgen: ["Guten Morgen", "Moin", "Einen schönen guten Morgen", "Morgen", "Hallo und guten Morgen", "Servus"],
  mittag: ["Mahlzeit", "Guten Mittag", "Hallo", "Moin"],
  nachmittag: ["Guten Tag", "Schönen Nachmittag", "Hallo", "Servus"],
  abend: ["Guten Abend", "Schönen Feierabend", "Hallo", "N'Abend"],
  spaet: ["Guten Abend", "Noch fleißig", "Späte Runde"],
};
const GRUSS_IMMER = "Moin Meister";   // zu jeder Tageszeit (Mirko)
const SPRUCH = {
  krank: ["Gute Besserung – die Spesen laufen nicht weg.", "Heute zählt nur eins: gesund werden.", "Erholen Sie sich gut. Der Rest kann warten.",
    "Tee, Decke, Ruhe – das ist heute der Plan.", "Gute Besserung – lassen Sie sich Zeit.", "Heute ist Pause angesagt. Ohne schlechtes Gewissen.",
    "Auskurieren geht vor. Alles andere später.", "Schnell wieder gesund werden – das ist der einzige Auftrag heute."],
  frei: ["Schönen Urlaub – heute zählt nur die Erholung.", "Frei! Was machen Sie eigentlich hier?", "Heute dürfen die Spesen Pause machen. Sie auch.",
    "Genießen Sie den Tag – Sie haben ihn sich verdient.", "Kein Wecker, kein Stress – so soll es sein.", "Freier Tag. Das Werkzeug passt solange auf.",
    "Abschalten erlaubt. Ausdrücklich.", "Heute ist Ihr Tag. Machen Sie was Schönes draus.", "Urlaubsmodus an. Arbeit ist morgen auch noch da.",
    "Erholung ist auch eine Leistung. Viel Erfolg dabei."],
  morgenUrlaub: ["Morgen beginnt Ihr Urlaub – nur noch heute!", "Letzter Tag vor dem Urlaub. Endspurt!", "Noch einmal schlafen, dann ist Urlaub.",
    "Heute alles erledigen, morgen alles vergessen.", "Der Urlaub wartet schon vor der Tür.", "Nur noch ein Tag – dann gehört die Zeit Ihnen."],
  abgabeOffen: ["Heute ist der {werktag}. Werktag – Ihr Nachweis für {monat} wartet.", "{monat} ist vorbei. Zeit zum Drucken und Unterschreiben.",
    "Abgabe bis zum 3. Werktag – heute ist der {werktag}.", "Kurz drucken, unterschreiben, abgeben – dann ist {monat} erledigt.",
    "Der Nachweis für {monat} will raus. Zwei Minuten, versprochen.", "Erinnerung: {monat} abschließen. Ihr Geld freut sich.",
    "{monat} fertig machen, dann hat der Kopf wieder Platz.", "Ihr {monat}-Nachweis ist fast fertig. Nur noch abschließen."],
  abgabeErledigt: ["{monat} ist abgegeben. Sauber!", "Nachweis für {monat} erledigt – vorbildlich.", "{monat}: abgehakt. Weiter geht's.",
    "Pünktlich abgegeben. Daran könnten sich andere ein Beispiel nehmen.", "{monat} erledigt. Jetzt kann der neue Monat kommen.",
    "Abgabe geschafft. Das fühlt sich gut an, oder?"],
  /* Frist verpasst (11.10.2026, Mirko: "1 mal in der woche frist verpasst") -
     ENTWURF, steht zur Freigabe in "Startseite – Gruß und Sprüche (Entwurf).md" */
  fristVerpasst: ["Ihr Nachweis für {monat} ist noch offen – die Abgabe war bis zum 3. Werktag.", "Kleine Erinnerung: {monat} ist noch nicht abgeschlossen.",
    "{monat} wartet noch. Kurz drucken, unterschreiben, abgeben.", "Der Nachweis für {monat} fehlt noch. Heute ist ein guter Tag dafür.",
    "Noch offen: Ihr Nachweis für {monat}. Zwei Minuten, dann ist es erledigt.", "{monat} ist noch nicht abgegeben. Ihr Geld wartet."],
  monatsende: ["Letzter Arbeitstag im Monat – bald wird abgeschlossen.", "Der Monat ist fast geschafft. Gut gemacht.",
    "Monatsende! Noch einmal kurz alle Tage prüfen.", "Heute den Monat sauber zu Ende bringen.",
    "Letzter Tag im Monat. Der nächste Nachweis wartet schon.", "Monat geschafft. Morgen gibt es einen neuen."],
  zahlenTage: ["Schon {tage} Spesentage diesen Monat. Weiter so!", "{tage} Spesentage bisher – da kommt was zusammen.",
    "Ihr Monat läuft: {tage} Spesentage und es geht weiter."],
  zahlenRest: ["Noch {rest} Urlaubstage für {jahr}. Schon verplant?", "{rest} Urlaubstage übrig. Gut geplant ist halb erholt.",
    "Noch {rest} Tage Urlaub – das Jahr ist noch nicht vorbei."],
  montag: ["Montag: Der Kaffee muss heute doppelt arbeiten.", "Neue Woche, neues Glück.", "Montag ist auch nur ein Tag. Ein langer, aber ein Tag.",
    "Die Woche gehört Ihnen. Fangen Sie gut an.", "Montag – der Tag, an dem alle Pläne noch funktionieren.", "Frisch in die Woche. Oder wenigstens wach.",
    "Montags ist alles möglich. Sogar gute Laune.", "Start in die Woche. Der Rest ergibt sich.", "Ein guter Montag ist ein halber Freitag. Fast.",
    "Neue Woche, leerer Kalender, volle Energie. Hoffentlich.", "Montag: Kurz durchatmen, dann los.", "Die Woche ist jung. Sie auch.",
    "Wer montags lächelt, hat den Rest der Woche im Griff.", "Montag? Kein Problem. Das schaffen Sie.", "Auf in die Woche – einer muss sie ja machen."],
  freitag: ["Freitag! Das Wochenende winkt schon von Weitem.", "Endspurt – das Wochenende ist in Sichtweite.",
    "Freitag: Der schönste Tag, um Dinge auf Montag zu verschieben.", "Noch einmal Gas geben, dann ist Wochenende.", "Freitag – die Woche hat sich gelohnt.",
    "Fast geschafft. Das Wochenende hat schon Hunger.", "Freitag ist der Montag, der sich gemacht hat.", "Heute noch, dann gehört die Zeit Ihnen.",
    "Wochenende in Sicht. Kurs halten!", "Freitag: Gute Laune ist heute Pflicht.", "Die Woche ist im Kasten. Fast.", "Freitag: Die Woche lächelt schon.",
    "Letzte Etappe der Woche. Gute Fahrt!", "Schönes Wochenende schon mal vorab!", "Freitag. Der Tag mit dem besten Ausblick."],
  wochenende: ["Wochenende! Die Spesen ruhen. Sie hoffentlich auch.", "Heute ist frei. Das Werkzeug macht auch Pause.", "Schönes Wochenende – genießen Sie es.",
    "Samstag, Sonntag, Sofa. Klingt nach einem Plan.", "Kurz reinschauen ist erlaubt. Länger bleiben nicht.", "Wochenende ist zum Auftanken da.",
    "Heute zählt keine Arbeitszeit. Nur die gute Zeit.", "Erholen Sie sich – Montag kommt von ganz allein.", "Freie Tage sind die besten Tage.",
    "Wochenende. Das Wort allein ist schon schön."],
  feiertag: ["Feiertag – genießen Sie ihn.", "Heute wird nicht gearbeitet. Ausdrücklich erlaubt.", "Ein freier Tag mitten in der Woche – was für ein Geschenk.",
    "Feiertag! Die Spesen feiern mit.", "Heute ist frei. Machen Sie das Beste draus.", "Schönen Feiertag – bis morgen!"],
  dezember: ["Bald ist das Jahr geschafft. Gut gemacht.", "Dezember – ein bisschen Ruhe tut gut.", "Das Jahr biegt auf die Zielgerade ein.",
    "Plätzchen sind im Dezember ein Grundnahrungsmittel.", "Schöne Dezembertage!", "Noch ein paar Tage, dann ist das Jahr rund.",
    "Dezember: Zeit, das Jahr sauber abzuschließen.", "Ein gutes Jahr geht zu Ende. Ein neues kommt."],
  januar: ["Neues Jahr, neue Spesen, neue Chancen.", "Frohes neues Jahr! Auf ein gutes.", "Das Jahr ist noch frisch – genau wie die Vorsätze.",
    "Januar: Alles auf Anfang.", "Ein neues Jahr voller Arbeitstage. Und hoffentlich voller guter.", "Neues Jahr, neues Urlaubskonto. Schon geplant?"],
  winter: ["Glatte Straßen, kühler Kopf – fahren Sie vorsichtig.", "Draußen kalt, drinnen warm. Gute Fahrt!", "Winter: Lieber zwei Minuten später als einmal zu schnell.",
    "Scheiben frei, Kopf frei, los geht's.", "Kalt draußen? Die gute Laune hält warm.", "Bei Glätte gilt: ankommen ist wichtiger als schnell sein.",
    "Wintertag. Warm anziehen und sicher ankommen.", "Heute schon Eis gekratzt? Respekt."],
  fruehling: ["Der Frühling kommt – die Laune auch.", "Mehr Licht, mehr Energie. Endlich.", "Frühling: Fenster auf, durchatmen, los.",
    "Die Tage werden länger. Die Feierabende gefühlt auch.", "Alles blüht. Sie hoffentlich auch.", "Frühling: Die Laune wächst mit."],
  sommer: ["Heiß heute? Genug trinken nicht vergessen!", "Sommer: Wasserflasche einpacken, gute Laune auch.", "Sonne draußen, Sonne drinnen.",
    "Bei Hitze gilt: trinken, trinken, trinken.", "Sommerzeit ist Urlaubszeit. Schon geplant?", "Heute ist ein guter Tag für ein Eis nach Feierabend.",
    "Sommer, Sonne, Spesen.", "Klimaanlage an, Laune hoch.", "Lange Tage, laue Abende – genießen Sie sie.", "Bei Hitze ruhig ein Gang zurück. Ankommen zählt."],
  herbst: ["Der Herbst ist da – gemütlich wird's.", "Herbst: Bunte Blätter, klare Köpfe.", "Es wird früher dunkel. Licht an, Augen auf.",
    "Herbstwetter? Gute Laune hat kein Wetter.", "Die Tage werden kürzer. Die To-do-Liste hoffentlich auch.", "Nebel am Morgen? Langsam fahren, sicher ankommen."],
  unterwegs: ["Gute Fahrt heute – kommen Sie heil an.", "Ankommen ist wichtiger als schnell sein.", "Wer gelassen fährt, kommt entspannt an.",
    "Die Straße gehört heute Ihnen. Teilweise.", "Tank voll, Kopf klar, los geht's.", "Jeder Kilometer zählt – auch für die Spesen.", "Gute Fahrt und freie Straßen!",
    "Stau ist nur eine längere Pause mit Aussicht.", "Navi an, Musik an, gute Laune an.", "Unterwegs zu Hause – heute wieder.",
    "Pausen machen ist auch Arbeit. Wichtige sogar.", "Heute wird gefahren, morgen gerechnet. Oder umgekehrt.", "Sicher hin, sicher zurück. Mehr braucht es nicht.",
    "Die beste Abkürzung ist die, die man kennt.", "Wer unterwegs lächelt, hat mehr vom Tag.", "Rückspiegel checken, Laune checken, losfahren.", "Gute Strecke heute!",
    "Unterwegs gilt: lieber eine Pause zu viel als eine zu wenig.", "Freie Fahrt wünscht das Werkzeug.", "Viele Kilometer, viele Geschichten. Schöne Tour heute.",
    "Rote Ampeln sind die Kaffeepausen der Straße.", "Wer viel unterwegs ist, kennt die besten Bäcker.", "Der Tag ist eine Strecke. Schritt für Schritt.",
    "Fahren Sie vorsichtig – die anderen tun es nicht immer.", "Heute schon die schönste Strecke gefunden?"],
  allgemein: [
    /* Motivation */
    "Wer früh startet, hat mehr vom Feierabend.", "Kleine Schritte, große Wirkung.", "Heute ist ein guter Tag für einen guten Tag.",
    "Gute Arbeit spricht für sich. Heute wieder.", "Ein Tag nach dem anderen. Heute ist dran.", "Ordnung im Nachweis, Ruhe im Kopf.",
    "Läuft. Und wenn nicht, dann gleich.", "Machen ist wie wollen, nur krasser.", "Wer anfängt, ist schon halb fertig.", "Jeder Tag ist eine neue Chance. Heute auch.",
    "Erst die Arbeit, dann der Feierabend. Gute Reihenfolge.", "Sie schaffen das. Wie immer.", "Konzentriert anfangen, entspannt aufhören.",
    "Gut geplant ist halb geschafft.", "Was heute erledigt ist, stört morgen nicht.", "Die beste Zeit zum Anfangen ist jetzt.",
    "Ein Lächeln kostet nichts und bringt viel.", "Heute wird ein guter Tag. Das ist beschlossen.", "Ruhe bewahren, Kurs halten.",
    "Nicht perfekt, aber erledigt – auch eine Leistung.", "Der Tag hat 24 Stunden. Ein paar davon gehören Ihnen.", "Wer dranbleibt, kommt an.",
    "Heute schon etwas geschafft? Dann ist der Tag schon gut.", "Schritt für Schritt geht's auch bergauf.", "Mit guter Laune geht alles leichter. Fast alles.",
    "Fleiß zahlt sich aus. Manchmal sogar in Spesen.", "Machen Sie heute etwas, worauf Sie morgen stolz sind.", "Auf sich selbst kann man sich verlassen.",
    "Wer Spaß an der Arbeit hat, arbeitet nicht. So heißt es.", "Ein klarer Kopf ist das beste Werkzeug.", "Gut gemacht ist besser als gut gemeint.",
    "Ein gutes Team macht jeden Tag leichter.", "Danke für Ihren Einsatz. Ehrlich.", "Heute ist Ihr Tag. Zumindest ein Teil davon.",
    "Durchatmen. Weitermachen. Feierabend genießen.", "Wer Ziele hat, findet Wege.", "Jede Strecke beginnt mit dem ersten Meter.", "Was zählt, ist das Ankommen.",
    "Gelassenheit ist eine Superkraft.", "Erfolg ist die Summe kleiner Tage. Wie heute.",
    /* zum Schmunzeln */
    "Kaffee ist kein Getränk. Kaffee ist ein Arbeitsmittel.", "Die Spesen rechnen sich von selbst. Den Rest erledigen Sie.",
    "Plan für heute: alles schaffen. Plan B: das Wichtigste.", "Multitasking heißt: drei Dinge gleichzeitig vergessen.", "Wer Ordnung hält, ist nur zu faul zum Suchen.",
    "Das Leben ist zu kurz für schlechten Kaffee.", "Heute schon jemanden angelächelt? Der Spiegel zählt auch.",
    "Gute Laune ist ansteckend. Heute bitte großzügig verteilen.", "Ein aufgeräumter Schreibtisch ist ein Zeichen für einen vollen Schrank.",
    "Wer Zeit sparen will, trägt seine Zeiten einmal ein. Erledigt.", "Optimismus: Ein Brötchen mitnehmen, falls es länger dauert.",
    "Der frühe Vogel fängt den Wurm. Der ausgeschlafene den guten Parkplatz.", "Heute wird nicht gemeckert. Höchstens ein bisschen.",
    "Pünktlichkeit ist die Höflichkeit der Spesen.", "Wer viel arbeitet, darf auch viel Kuchen essen. Das ist Gesetz. Fast.",
    "Der Papierkram erledigt sich nicht von selbst. Hier schon.", "Ich bin nicht faul, ich bin im Energiesparmodus.",
    "Der Tag beginnt mit einem Lächeln. Oder mit Kaffee. Beides geht.", "Schreibtisch, Lenkrad oder Werkbank – Hauptsache, die Laune stimmt.",
    "Feierabend ist auch nur ein anderes Wort für Ziel.", "Arbeit ist das, was zwischen zwei Kaffees passiert.", "Heute schon gelacht? Hier, das zählt auch.",
    "Man kann nicht alles haben. Wo sollte man es auch hinstellen?", "Wer lächelt, statt zu toben, ist immer der Stärkere.", "Keine Panik. Erst mal einen Kaffee.",
    "Der Montag hat angerufen. Er kommt nächste Woche wieder.", "Abwarten und Tee trinken. Oder Kaffee. Hauptsache abwarten.", "Gute Nachricht: Der Tag ist noch jung.",
    "Heute ist ein guter Tag, um gute Laune zu haben. Gestern auch schon.", "Wer Witze über Spesen macht, hat sie meistens schon abgegeben.",
    "Ein voller Bauch arbeitet gern. Erst Frühstück, dann Welt retten.", "Mittagspause ist die wichtigste Besprechung des Tages.",
    "Heute bleibt alles im grünen Bereich. Ehrenwort.", "Wenn das Leben Ihnen Zitronen gibt: Limo draus machen und weiter.",
    "Wer immer pünktlich ist, hat irgendwann viel Zeit zum Warten.", "Ordnung ist das halbe Leben. Die andere Hälfte ist Feierabend.",
    "Der Kalender sagt Werktag. Die Laune sagt: egal, gut drauf.", "Heute läuft's wie geschmiert. Hoffentlich.", "Glück ist, wenn der Nachweis auf Anhieb stimmt.",
    "Wer zuletzt lacht, hat den Witz erst später verstanden. Auch gut."],
};
/* Gemischte Reihenfolge je Mitarbeiter und Topf: Saat aus Name + Topf,
   mulberry32, Fisher-Yates. Stabil, solange der Name gleich bleibt. */
function spruchSaat(text) { let h = 2166136261; for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function spruchReihe(n, saat) {
  let a = saat || 1; const zufall = () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const r = [...Array(n).keys()];
  for (let i = n - 1; i > 0; i--) { const j = Math.floor(zufall() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; }
  return r;
}
/* Element Nr. "zaehler" aus einem Topf - fuer diesen Mitarbeiter gemischt
   (feste Reihenfolge je Name und Topf).
   Der Zaehler rueckt nach jedem Durchlauf um EINEN Platz weiter
   (zaehler + Durchlauf-Nr.). Ohne das haengt alles am Wochentag, sobald die
   Topfgroesse durch 7 teilbar ist - gemessen 10.10.2026: Gruss-Topf 7 ->
   Montag immer "Morgen", Mittwoch immer "Moin Meister"; Spruch-Topf fuer
   unterwegs 105 -> an den allgemeinen Tagen (Di-Do) nur 45 von 105 je sichtbar.
   So: jeder Eintrag kommt dran, derselbe fruehestens nach Topfgroesse - 1 Tagen. */
function ausTopf(liste, topf, zaehler) {
  const name = (config.name || "").trim().toLowerCase(), n = liste.length;
  const c = zaehler + Math.floor(zaehler / n), pos = ((c % n) + n) % n;
  return liste[spruchReihe(n, spruchSaat(name + "|" + topf))[pos]];
}
/* Tage seit 1.1.1970 nach ORTSZEIT - der Tag wechselt um Mitternacht des Geraets */
const tagNummer = (d) => Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5);
/* Wie viele Tage bis einschliesslich Tag n fielen auf diese Wochentage
   (0 = So … 6 = Sa)? Zaehler fuer Toepfe, die nur an bestimmten Wochentagen
   drankommen: Jeder dieser Tage ist der naechste Platz im Topf. Mit dem
   Kalendertag als Zaehler blieben Plaetze dauerhaft ungenutzt (gemessen
   10.10.2026: 24 von 105 Spruechen in drei Jahren nie). 1.1.1970 = Do (4). */
function wtZaehler(n, wochentage) {
  const voll = Math.floor((n + 1) / 7) * wochentage.length;
  let rest = 0; for (let m = Math.floor((n + 1) / 7) * 7; m <= n; m++) if (wochentage.includes((m + 4) % 7)) rest++;
  return voll + rest;
}
/* Die allgemeinen Tage nach Kalender: Di-Do, kein Zahlen-Tag (jeder 5.), kein
   Jahreszeit-Tag (jeder 4., Rest 1). Zaehlt nur DIESE Tage - sonst trafen die
   Zahlen-Tage in jedem Durchlauf dieselben Plaetze (Durchlauf 245 Tage, durch
   5 teilbar) und 25 Sprueche kamen nie (gemessen 10.10.2026). Muster wiederholt
   sich alle 140 Tage (7 * 5 * 4). */
const diDo = (m) => [2, 3, 4].includes((m + 4) % 7);
const istAllgemeinTag = (m) => diDo(m) && m % 5 !== 0 && m % 4 !== 1;
/* Jahreszeit-Tage: jeder 4. (Rest 1) - und die Zahlen-Tage (jeder 5.), wenn
   die eigenen Zahlen nichts hergeben (Monatsanfang). Eigener Zaehler, damit
   zwei solche Tage nie denselben Platz bekommen (gemessen 10.10.2026: Do/Di
   mit fuenf Tagen Abstand, derselbe Spruch). */
const istJahreszeitTag = (m) => diDo(m) && (m % 4 === 1 || m % 5 === 0);
const je140 = {};
function kalenderZaehler(n, art, gilt) {
  if (je140[art] === undefined) { je140[art] = 0; for (let m = 0; m < 140; m++) if (gilt(m)) je140[art]++; }
  const block = Math.floor((n + 1) / 140);
  let rest = 0; for (let m = block * 140; m <= n; m++) if (gilt(m)) rest++;
  return block * je140[art] + rest;
}
function tagesGruss(d = new Date()) {
  const s = d.getHours();
  const slot = s < 5 ? "frueh" : s < 11 ? "morgen" : s < 14 ? "mittag" : s < 18 ? "nachmittag" : s < 22 ? "abend" : "spaet";
  let liste = GRUSS[slot].concat(GRUSS_IMMER);
  /* "Schoenen Feierabend" nur an einem Arbeitstag */
  if (slot === "abend") { const w = tagInfo(d, feiertage(d.getFullYear(), config.bundesland)); if (w.art === "ruhe" || w.art === "status") liste = liste.filter((g) => g !== "Schönen Feierabend"); }
  return ausTopf(liste, "gruss-" + slot, tagNummer(d));
}
/* Der Spruch des Tages und aus welchem Topf er kommt.
   opt.ohneErinnerung (Mitteilungen, 11.10.2026): Abgabe, Frist verpasst und
   Monatsende ueberspringen - fuer wen unter "Mehr" -> "Mitteilungen" nur der
   Spruch an ist, kommt an diesen Tagen der normale Spruch. */
function tagesSpruchMit(d = new Date(), opt = {}) {
  const mitErinnerung = !opt.ohneErinnerung;
  const J = d.getFullYear(), M = d.getMonth() + 1, n = tagNummer(d), wd = d.getDay();
  const map = feiertage(J, config.bundesland), heute = tagInfo(d, map);
  const morgen = new Date(J, M - 1, d.getDate() + 1);
  const vorM = M === 1 ? 12 : M - 1, vorJ = M === 1 ? J - 1 : J;
  const info = monatInfo(J, M);
  const tagNr = info.arbeit.findIndex((t) => t.iso === isoVon(d)) + 1;              // Werktag Nr. dieses Datums (monatInfo zaehlt ab dem echten Heute)
  const werte = { monat: MON[vorM - 1], werktag: String(tagNr), tage: String(info.spesentage), rest: "", jahr: String(J) };
  const nimm = (topf, zaehler = n) => ({ topf, text: ausTopf(SPRUCH[topf], topf, zaehler).replace(/\{(\w+)\}/g, (_, k) => werte[k] || "") });
  /* Erinnert wird nur an einen Vormonat, in dem das Werkzeug schon
     eingerichtet war (index.html einrichtungSpeichern, 11.10.2026, Mirko: "ja
     ändern"). Ohne Datum (vorher eingerichtet) wie bisher. Und er muss
     Spesentage gehabt haben. */
  const vorTageVon = () => {
    if (config.eingerichtetAm && config.eingerichtetAm > isoVon(new Date(vorJ, vorM, 0))) return 0;
    try { return computeMonth(vorJ, vorM).workdays || 0; } catch (e) { return 0; }
  };
  if (heute.art === "status" && heute.status === "krank") return nimm("krank");
  if (heute.art === "status") return nimm("frei");                                   // Urlaub, Sonderurlaub, Elternzeit, Frei
  if (heute.art === "ruhe" && heute.fei) return nimm("feiertag");
  if (wd === 0 || wd === 6) return nimm("wochenende", wtZaehler(n, [0, 6]));
  /* Werktag 1-3: Abgabe des Vormonats - nur, wenn es dort Spesentage gab
     (sonst bekaeme ein neuer Kollege im ersten Monat eine Erinnerung) */
  if (mitErinnerung && tagNr >= 1 && tagNr <= 3) {
    if (vorTageVon() > 0) return nimm(localStorage.getItem(monthSubmittedKey(vorJ, vorM)) ? "abgabeErledigt" : "abgabeOffen");
  }
  /* Frist verpasst (11.10.2026, Mirko: "1 mal in der woche"): Vormonat nach
     dem 3. Werktag noch offen -> am 4. Werktag und dann jeden 5. Werktag
     (4., 9., 14., 19., 24.) - also einmal pro Arbeitswoche, bis er
     abgeschlossen ist. Gleiche Bedingung wie oben: nur mit Spesentagen. */
  if (mitErinnerung && tagNr >= 4 && (tagNr - 4) % 5 === 0) {
    if (vorTageVon() > 0 && !localStorage.getItem(monthSubmittedKey(vorJ, vorM))) return nimm("fristVerpasst");
  }
  if (((overrides[isoVon(morgen)] || {}).status) === "urlaub") return nimm("morgenUrlaub");
  if (mitErinnerung && tagNr && tagNr === info.arbeit.length) return nimm("monatsende");
  const woche = Math.floor((n + 3) / 7);                                              // Wochen-Zaehler (Montag bis Sonntag)
  if (wd === 1) return nimm("montag", woche);
  if (wd === 5) return nimm("freitag", woche);
  /* jeder 5. Tag: die eigenen Zahlen - Resturlaub nur ab September */
  if (n % 5 === 0) {
    const rest = urlaubRestFuer(J);
    if (M >= 9 && rest > 0 && n % 10 === 0) { werte.rest = String(rest).replace(".", ","); return nimm("zahlenRest", Math.floor(n / 10)); }
    if (info.spesentage >= 3) return nimm("zahlenTage", Math.floor(n / 5));
  }
  /* jeder 4. Tag - und ein Zahlen-Tag ohne passende Zahlen: Jahreszeit bzw.
     Dezember/Januar */
  if (n % 4 === 1 || n % 5 === 0) {
    if (M === 12 && n % 8 === 1) return nimm("dezember", Math.floor(n / 8));
    if (M === 1 && n % 8 === 1) return nimm("januar", Math.floor(n / 8));
    return nimm(M <= 2 || M === 12 ? "winter" : M <= 5 ? "fruehling" : M <= 8 ? "sommer" : "herbst", kalenderZaehler(n, "jz", istJahreszeitTag));
  }
  /* allgemein - Fahrer und Monteur Aussendienst dazu die fuer unterwegs.
     Zaehler: nur die allgemeinen Tage nach Kalender */
  const unterwegs = ["fahrer", "monteur-aussen"].includes(config.mitarbeitertyp);
  const zaehler = kalenderZaehler(n, "allg", istAllgemeinTag);
  if (unterwegs) { SPRUCH.allgemeinUnterwegs = SPRUCH.allgemeinUnterwegs || SPRUCH.allgemein.concat(SPRUCH.unterwegs); return nimm("allgemeinUnterwegs", zaehler); }
  return nimm("allgemein", zaehler);
}
/* Fuer die Pruefung: Gruss und Spruch fuer ein beliebiges Datum/Uhrzeit */
window.riebSpruchToepfe = SPRUCH;
window.riebGrussSpruch = (zeit) => { const d = zeit ? new Date(zeit) : new Date(); const s = tagesSpruchMit(d); return { gruss: tagesGruss(d), spruch: s.text, topf: s.topf }; };

/* ---------------- Mitteilungen (11.10.2026) ----------------
   Mirko 10.10.2026: "können wir bauen, dass die app das aufs handy als
   benachrichtigung wirft? den spruch des tages?" - "es wäre generell cool wenn
   die app einem benachrichtigungen schickt, wenn man mal wieder spesen spät
   dran ist" - "A und B für zwischenzeitige Motivation" (Erinnerung bei Anlass,
   sonst der Spruch), "frist verpasst 1 mal in der woche", Wochenende und
   Feiertage "das passende zum tag", "unter mehr kann man es ausschalten gute
   idee", "ja in ordnung bau es trotzdem für safari mit ein".
   SO LAEUFT ES:
   - Das Geraet rechnet die naechsten MT_TAGE Tage voraus: Titel (Gruss +
     Vorname) und Text - DIESELBE Rechnung wie die Startseite. Das liegt NUR auf
     dem Geraet (Cache MT_CACHE); der Service Worker (sw.js) liest es beim Weckruf.
     Dort liegen auch die Einstellungen und die Nummer bei Firebase - bewusst
     NICHT im localStorage: der geht per "Geraete abgleichen" und Backup auf
     andere Geraete, zwei Geraete mit derselben Nummer wuerden sich gegenseitig
     die Mitteilungs-Adresse ueberschreiben.
   - Bei Firebase liegt je Geraet nur: Mitteilungs-Adresse + plan
     ("2026-10-12@6,…" = an welchen Tagen um welche Stunde). Kein Name, keine
     Eintraege. Firestore-Regel: sync/firestore.rules, mitteilungen/{id}.
   - GitHub (privates Repo miooo96/rieb-mitteilungen, senden.mjs) schickt
     morgens einen Weckruf ohne Text.
   - Apple: am iPhone NUR in der installierten App. Im Safari-Tab gibt es dort
     keine Mitteilungen (kein PushManager) - die Zeile steht trotzdem an
     derselben Stelle und erklaert es. Am Mac in Safari, Chrome, Edge, Firefox
     geht es auch im Tab. Ausnahme von "App = Browser" mit Mirkos Zusage
     (10.10.2026: "ja in ordnung").
   - Wer das Werkzeug MT_TAGE Tage nicht oeffnet, bekommt danach keine
     Mitteilungen mehr (der plan laeuft aus) - kein Weckruf ins Leere. */
const MT_CACHE = "rieb-mitteilungen";
const MT_DATEI = "/__mitteilungen.json";
const MT_TAGE = 90;
const MT_STUNDE = { arbeit: 6, frei: 9 };          // Arbeitstag 6 Uhr, Wochenende/Feiertag 9 Uhr
const MT_ERINNERUNG = ["abgabeOffen", "fristVerpasst", "monatsende"];
const MT_VAPID = "BEgG9uCEB4QB-apgmIHQalvvRZjpXF5UnZgL1wyHhqv3uy76qqlaXAZBGlVvy5bFCYFi-S6zoskb3S599SLwKAc";
let mtZustand = { geladen: false, erinnerung: false, spruch: false, id: "", sig: "", tag: "", tage: [], gefragt: false };
const mtAn = () => mtZustand.erinnerung || mtZustand.spruch;
const mtLokal = () => ["localhost", "127.0.0.1"].includes(location.hostname);
const mtIos = () => /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
/* "ja" | "nur-app" (iPhone/iPad im Safari-Tab) | "geht-nicht" | "alte-adresse" | "gesperrt" */
function mtMoeglich() {
  /* Automatisch gesteuerte Test-Browser (Playwright: Chrome, Chromium, WebKit)
     bekommen nachweislich KEIN Abo - "Registration failed - permission
     denied", gemessen 11.10.2026 (Neues Design/mitteilungen-probe.js). Fuer
     sie gibt es Mitteilungen also wirklich nicht: kein Einrichtungs-Schritt,
     keine Frage auf der Startseite. Sonst liefen die ueber 100 bestehenden
     Pruefungen in einen Schritt und einen Bogen, die es dort nie geben kann.
     mitteilungen-pruefen ersetzt den Dienst und setzt window.__mtPruefung. */
  if (navigator.webdriver && !window.__mtPruefung) return "geht-nicht";
  if (!("serviceWorker" in navigator) || !("Notification" in window) || !("PushManager" in window) || !("caches" in window)) return mtIos() ? "nur-app" : "geht-nicht";
  if (!amZiel() && !mtLokal()) return "alte-adresse";
  if (Notification.permission === "denied") return "gesperrt";
  return "ja";
}
async function mtSpeichern() {
  const c = await caches.open(MT_CACHE);
  const { geladen, ...rest } = mtZustand;
  await c.put(MT_DATEI, new Response(JSON.stringify(rest), { headers: { "Content-Type": "application/json" } }));
}
async function mtLaden() {
  try {
    const r = await (await caches.open(MT_CACHE)).match(MT_DATEI);
    if (r) Object.assign(mtZustand, await r.json());
  } catch (e) { /* kein Cache -> aus */ }
  mtZustand.geladen = true;
}
/* Die naechsten MT_TAGE Tage: { tage: [{t, titel, text}], plan: "JJJJ-MM-TT@S,…" } */
function mtVorausrechnen() {
  const h = new Date(), tage = [], plan = [];
  const vorname = (config.name || "").trim().split(/\s+/)[0] || "";
  for (let i = 0; i < MT_TAGE; i++) {
    const d0 = new Date(h.getFullYear(), h.getMonth(), h.getDate() + i), wd = d0.getDay();
    const frei = wd === 0 || wd === 6 || !!feiertage(d0.getFullYear(), config.bundesland)[isoVon(d0)];
    const stunde = frei ? MT_STUNDE.frei : MT_STUNDE.arbeit;
    const d = new Date(d0.getFullYear(), d0.getMonth(), d0.getDate(), stunde, 0, 0);
    /* So rechnen, wie die Startseite AN diesem Tag rechnet: Die Vorgabe-Zeiten
       gelten bis zu diesem Tag (index.html, vorgabeBisIso). Ohne das hatte ein
       Monat in der Zukunft keine Spesentage - die Abgabe-Erinnerung fehlte und
       "Schon 12 Spesentage" stimmte nicht (mitteilungen-pruefen, 11.10.2026). */
    let s, ohne = null;
    window.__vorgabeBis = isoVon(d0);
    try { s = tagesSpruchMit(d); if (MT_ERINNERUNG.includes(s.topf) && !mtZustand.erinnerung) ohne = tagesSpruchMit(d, { ohneErinnerung: true }); }
    finally { delete window.__vorgabeBis; }
    const erinnerung = MT_ERINNERUNG.includes(s.topf);
    let text = "";
    if (erinnerung && mtZustand.erinnerung) text = s.text;
    else if (mtZustand.spruch) text = ohne ? ohne.text : s.text;
    if (!text) continue;
    tage.push({ t: isoVon(d0), s: stunde, titel: tagesGruss(d) + (vorname ? ", " + vorname : ""), text });
    plan.push(isoVon(d0) + "@" + stunde);
  }
  return { tage, plan: plan.join(",") };
}
/* Firestore ueber REST (ohne die Firebase-Bausteine - die laedt das Werkzeug
   bewusst nur fuer angemeldete Nutzer). Pruefumgebung wie firebase-sync.js:
   nur auf localhost UND mit ?sync-test -> lokale Emulatoren. */
async function mtFirebase(methode, felder) {
  if (!window.SPESEN_FIREBASE_CONFIG) { try { await import("./sync/firebase-config.js"); } catch (e) { /* fehlt */ } }
  const cfg = window.SPESEN_FIREBASE_CONFIG;
  if (!cfg || !cfg.apiKey || String(cfg.apiKey).startsWith("DEIN_")) throw new Error("keine Firebase-Einstellungen");
  let emu = false; try { emu = mtLokal() && (new URLSearchParams(location.search).has("sync-test") || sessionStorage.getItem("__sync_test") === "ja"); } catch (e) { /* egal */ }
  let url = (emu ? "http://127.0.0.1:8080" : "https://firestore.googleapis.com") + `/v1/projects/${cfg.projectId}/databases/(default)/documents/mitteilungen/${mtZustand.id}?key=${encodeURIComponent(cfg.apiKey)}`;
  const init = { method: methode, headers: { "Content-Type": "application/json" } };
  if (methode === "PATCH") {
    url += Object.keys(felder).map((k) => "&updateMask.fieldPaths=" + k).join("");
    init.body = JSON.stringify({ fields: Object.fromEntries(Object.entries(felder).map(([k, v]) => [k, { stringValue: String(v) }])) });
  }
  const r = await fetch(url, init);
  if (!r.ok && !(methode === "DELETE" && r.status === 404)) throw new Error("Firebase " + r.status);
}
const mtSchluessel = () => { const b = (MT_VAPID + "=".repeat((4 - MT_VAPID.length % 4) % 4)).replace(/-/g, "+").replace(/_/g, "/"); return Uint8Array.from(atob(b), (c) => c.charCodeAt(0)); };
function mtNeueId() { const z = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789", r = crypto.getRandomValues(new Uint8Array(24)); return [...r].map((x) => z[x % z.length]).join(""); }
/* Vorausrechnen, auf dem Geraet ablegen und - wenn sich etwas geaendert hat -
   den plan bei Firebase melden (hoechstens einmal am Tag, ausser opt.sofort) */
async function mtAuffrischen(opt = {}) {
  if (!mtZustand.geladen || !mtAn() || mtMoeglich() !== "ja" || Notification.permission !== "granted") return;
  if (localStorage.getItem("spesen_config") === null) return;
  const reg = await navigator.serviceWorker.ready;
  const sub = opt.sub || await reg.pushManager.getSubscription();
  if (!sub) { mtZustand.erinnerung = mtZustand.spruch = false; mtZustand.verloren = true; await mtSpeichern(); return; }
  const v = mtVorausrechnen(), j = sub.toJSON();
  mtZustand.tage = v.tage;
  const sig = j.endpoint + "|" + v.plan, heute = isoVon(new Date());
  if (!mtZustand.id) mtZustand.id = mtNeueId();
  if (opt.sofort || mtZustand.sig !== sig || mtZustand.tag !== heute) {
    await mtFirebase("PATCH", { endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, plan: v.plan, stand: new Date().toISOString() });
    mtZustand.sig = sig; mtZustand.tag = heute;
  }
  mtZustand.verloren = false;
  await mtSpeichern();
}
let mtTimer = 0;
function mtAuffrischenSpaeter() { clearTimeout(mtTimer); mtTimer = setTimeout(() => { mtAuffrischen().catch((e) => console.info("[Mitteilungen]", e.message)); }, 1500); }
async function mtAusschalten() {
  try { const reg = await navigator.serviceWorker.ready; const sub = await reg.pushManager.getSubscription(); if (sub) await sub.unsubscribe(); } catch (e) { /* egal */ }
  if (mtZustand.id) { try { await mtFirebase("DELETE"); } catch (e) { console.info("[Mitteilungen] Abmelden bei Firebase:", e.message); } }
  Object.assign(mtZustand, { erinnerung: false, spruch: false, id: "", sig: "", tag: "", tage: [], verloren: false });
  try { await mtSpeichern(); } catch (e) { /* egal */ }
}
/* Beim Start: laden; nach "Zuruecksetzen" (kein spesen_config mehr) abmelden -
   sonst kaemen weiter Mitteilungen mit dem alten Namen */
async function mtStart() {
  if (!("caches" in window)) { mtZustand.geladen = true; return; }
  await mtLaden();
  if (mtAn() && localStorage.getItem("spesen_config") === null) await mtAusschalten();
  if (aktuell === "mehr" && !document.querySelector("#ebene:not([hidden])")) renderMehr();
  await mtAuffrischen();
}
/* Jeder Untertitel passt am Handy (393 px) in EINE Zeile - sonst ist die Zeile
   je nach Zustand 64 oder 80 px hoch und alles darunter springt, zwischen
   iPhone-App und Safari-Tab ebenso wie beim Ein-/Ausschalten (gemessen
   11.10.2026, mitteilungen-pruefen) */
function mtZeile(z) {
  const m = mtMoeglich();
  const unter = m === "nur-app" ? "Am iPhone nur in der App" : m === "alte-adresse" ? "Nur unter " + zielName()
    : m === "geht-nicht" ? "In diesem Browser nicht möglich" : m === "gesperrt" ? "Im Gerät ausgeschaltet"
    : mtZustand.verloren ? "Vom Gerät abgeschaltet"
    : mtZustand.erinnerung && !mtZustand.spruch ? "Nur Erinnerungen" : mtZustand.spruch && !mtZustand.erinnerung ? "Nur Spruch des Tages"
    : "Erinnerung und Spruch des Tages";
  return z("mitteilungen", "glocke", "Mitteilungen", unter, m === "ja" && mtAn() ? "An" : "Aus");
}
function oeffneMitteilungen() {
  const m = mtMoeglich(), geht = m === "ja", an = mtAn();
  const hinweis = {
    "nur-app": "<b>Am iPhone gibt es Mitteilungen nur in der App</b> – so will es Apple. In Safari unten auf „Teilen“ tippen, dann „Zum Home-Bildschirm“. Danach die App öffnen und hier einschalten.<br><b>Achtung:</b> App und Safari speichern getrennt. Wer wechselt, meldet sich vorher unter „Geräte abgleichen“ an.",
    "alte-adresse": "Mitteilungen gibt es unter der neuen Adresse <b>" + esc(zielName()) + "</b>. Erst umziehen, dann dort einschalten.",
    "geht-nicht": "Dieser Browser kann keine Mitteilungen anzeigen.",
    "gesperrt": "Mitteilungen sind für Rieb Spesen in den <b>Einstellungen dieses Geräts</b> ausgeschaltet. Dort erlauben, dann hier einschalten.",
  }[m];
  const zeit = `an Arbeitstagen um ${MT_STUNDE.arbeit} Uhr, am Wochenende und an Feiertagen um ${MT_STUNDE.frei} Uhr`;
  oeffneEbene(`${bogenKopf("Freiwillig · kostenlos", "Mitteilungen")}
    <p class="e-unterzeile" style="margin:12px 2px 0;font-size:14.5px;color:var(--tinte2)">Rieb Spesen meldet sich einmal am Tag auf diesem Gerät – ${zeit}.</p>
    ${hinweis ? `<div class="hinweis karte" style="margin-top:12px">${ic("info")}<span>${hinweis}</span></div>` : ""}
    <div class="schalter-liste" style="margin-top:12px">
      <label class="schalter"><span><b>Erinnerungen</b><small>Abgabe bis zum 3.&nbsp;Werktag · Frist verpasst (einmal pro Woche) · letzter Arbeitstag im Monat</small></span><input type="checkbox" id="mtErinnerung" ${(an ? mtZustand.erinnerung : true) ? "checked" : ""} ${geht ? "" : "disabled"}></label>
      <label class="schalter"><span><b>Spruch des Tages</b><small>An allen anderen Tagen – auch am Wochenende, an Feiertagen und im Urlaub</small></span><input type="checkbox" id="mtSpruch" ${(an ? mtZustand.spruch : true) ? "checked" : ""} ${geht ? "" : "disabled"}></label>
    </div>
    <div class="hinweis karte" style="margin-top:12px">${ic("info")}<span><b>Datenschutz.</b> Dafür meldet sich dieses Gerät bei Google Firebase im Projekt von Mirko Rieb an. Gespeichert werden nur die Mitteilungs-Adresse des Geräts und die Tage, an denen es geweckt wird – kein Name, keine Einträge. Den Text baut Ihr Gerät selbst.</span></div>
    <p class="abgleich-meldung" id="mtMeldung" role="alert" hidden></p>
    <button class="haupt-knopf" style="margin-top:14px" data-aktion="${geht ? "mitteilungen-ok" : "mitteilungen-zu"}">${!geht ? "Verstanden" : an ? "Speichern" : "Einschalten"}</button>`);
}
function mtMeldung(text) { const e = document.getElementById("mtMeldung"); if (!e) return; e.hidden = !text; e.textContent = text || ""; }
/* Die Erlaubnis-Frage des Geraets. MUSS direkt aus einem Tipp kommen
   (iPhone) - darum ruft jeder Weg sie als Allererstes auf, vor jedem
   anderen await. */
async function mtErlaubnis() {
  let e = Notification.permission;
  if (e !== "granted") { try { e = await Notification.requestPermission(); } catch (x) { e = "denied"; } }
  return e;
}
/* EIN Weg zum Einschalten fuer alle drei Stellen (Mehr, Einrichtung,
   einmalige Frage auf der Startseite): Abo, Vorrat, Melden bei Firebase,
   sichtbare Probe. Die Erlaubnis ist vorher erteilt. Wirft bei Fehler -
   der Stand davor bleibt dann. */
async function mtEinschalten(er, sp) {
  /* Ganz frisch gestartet (mtStart laeuft erst nach 1,2 s)? Erst den
     gespeicherten Stand laden - sonst ueberschriebe mtStart danach die
     neue Wahl mit dem alten Stand */
  if (!mtZustand.geladen) await mtLaden();
  const vorher = { erinnerung: mtZustand.erinnerung, spruch: mtZustand.spruch };
  try {
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: mtSchluessel() });
    mtZustand.erinnerung = er; mtZustand.spruch = sp; mtZustand.gefragt = true;
    await mtAuffrischen({ sofort: true, sub });
    /* Gleich eine sichtbare Probe - so sieht man sofort, dass es ankommt */
    const heute = isoVon(new Date()), naechste = mtZustand.tage.find((t) => t.t > heute);
    const wann = naechste ? new Date(naechste.t + "T12:00").toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "numeric" }) : "";
    await reg.showNotification("Mitteilungen sind an", { body: naechste ? `Die nächste kommt am ${wann} um ${naechste.s} Uhr.` : "Sie kommen wie eingestellt.", icon: "/icons/icon-192.png", tag: "rieb-probe", lang: "de" });
  } catch (e) { Object.assign(mtZustand, vorher); throw e; }
}
const MT_OHNE_ERLAUBNIS = "Ohne Ihre Erlaubnis kann Rieb Spesen keine Mitteilungen zeigen. Erlauben lässt es sich jederzeit in den Einstellungen des Geräts.";
const mtFehlerText = (e) => "Das hat nicht geklappt – bitte mit Empfang noch einmal versuchen." + (e && e.message ? " (" + e.message + ")" : "");
let mtLaeuft = false;
/* Mehr -> Mitteilungen -> Einschalten / Speichern */
async function mitteilungenOk() {
  if (mtLaeuft) return;
  const er = !!(document.getElementById("mtErinnerung") || {}).checked, sp = !!(document.getElementById("mtSpruch") || {}).checked;
  if (!er && !sp) {
    if (mtAn()) { await mtAusschalten(); toast("Mitteilungen ausgeschaltet"); }
    schliesseEbene(); if (aktuell === "mehr") renderMehr(); return;
  }
  if ((await mtErlaubnis()) !== "granted") { mtMeldung(MT_OHNE_ERLAUBNIS); return; }
  const knopf = document.querySelector('#ebene [data-aktion="mitteilungen-ok"]');
  mtLaeuft = true; if (knopf) { knopf.disabled = true; knopf.textContent = "Wird eingeschaltet …"; }
  try { await mtEinschalten(er, sp); }
  catch (e) { mtLaeuft = false; if (knopf) { knopf.disabled = false; knopf.textContent = mtAn() ? "Speichern" : "Einschalten"; } mtMeldung(mtFehlerText(e)); return; }
  mtLaeuft = false;
  schliesseEbene(); toast("Mitteilungen eingeschaltet"); if (aktuell === "mehr") renderMehr();
}
/* Einrichtung, "Los geht's": "Aktivieren" gewaehlt (Erlaubnis kam schon beim
   Tipp auf "Aktivieren") -> einschalten; sonst nur merken, dass gefragt
   wurde - dann fragt die Startseite nicht noch einmal */
async function mtNachEinrichtung(ja) {
  try {
    if (!mtZustand.geladen) await mtLaden();
    if (ja && Notification.permission === "granted") await mtEinschalten(true, true);
    else { mtZustand.gefragt = true; await mtSpeichern(); }
  } catch (e) { setTimeout(() => toast("Mitteilungen: " + mtFehlerText(e) + " Unter „Mehr“ geht es jederzeit."), 2500); }
}
/* Einmalige Frage auf der Startseite fuer alle, die schon eingerichtet waren
   (11.10.2026, Mirko: "b, ja sollen sie"). Nur wo es geht (am iPhone im
   Safari-Tab nicht - Mirko: "wie du es sagst"), nur einmal je Geraet (der
   Merker liegt im Vorrat, nicht im localStorage - Mitteilungen gelten je
   Geraet). Wartet wie resturlaubFragen, bis Einstieg, Brief, Einrichtung
   und andere Boegen weg sind - nie zwei Dinge uebereinander. */
function mtFragen() {
  let versuche = 0;
  const t = setInterval(() => {
    if (++versuche > 120) { clearInterval(t); return; }
    if (!mtZustand.geladen) return;
    if (mtAn() || mtZustand.gefragt || mtMoeglich() !== "ja" || localStorage.getItem("spesen_config") === null) { clearInterval(t); return; }
    const e = document.getElementById("ebene");
    /* ... und kein Hinweis unten (Toast): nach dem Umzug lag "Umzug
       abgeschlossen - Ihre Eintraege sind da" sonst gut 2 s genau ueber
       "Nicht jetzt" (gefunden 11.10.2026 im Live-Durchlauf kollegen-weg-bilder) */
    const frei = aktuell === "start" && !document.getElementById("intro") && !document.getElementById("brief") && !document.querySelector("#einrichtung:not([hidden])")
      && e && e.hidden && !document.documentElement.dataset.vt && !document.querySelector("#toast.zeigen");
    if (!frei) return;
    clearInterval(t);
    mtZustand.gefragt = true; mtSpeichern().catch(() => {});
    oeffneEbene(`${bogenKopf("Neu", "Mitteilungen")}
      <p class="e-unterzeile" style="margin:12px 2px 0;font-size:14.5px;color:var(--tinte2)">Rieb Spesen kann Sie jetzt an die Abgabe erinnern – bis zum 3.&nbsp;Werktag und einmal pro Woche, wenn die Frist verpasst ist. An den anderen Tagen kommt der Spruch des Tages. An Arbeitstagen um ${MT_STUNDE.arbeit} Uhr, am Wochenende und an Feiertagen um ${MT_STUNDE.frei} Uhr.</p>
      <div class="hinweis karte" style="margin-top:12px">${ic("info")}<span><b>Datenschutz.</b> Dafür meldet sich dieses Gerät bei Google Firebase im Projekt von Mirko Rieb an. Gespeichert werden nur die Mitteilungs-Adresse des Geräts und die Tage, an denen es geweckt wird – kein Name, keine Einträge. Den Text baut Ihr Gerät selbst.</span></div>
      <p class="abgleich-meldung" id="mtMeldung" role="alert" hidden></p>
      <button class="haupt-knopf" style="margin-top:14px" data-aktion="mitteilungen-frage-ja">Aktivieren</button>
      <button class="text-knopf" data-aktion="mitteilungen-frage-nein">Nicht jetzt</button>`);
  }, 500);
}
async function mtFrageJa() {
  if (mtLaeuft) return;
  if ((await mtErlaubnis()) !== "granted") { mtMeldung(MT_OHNE_ERLAUBNIS); return; }
  const knopf = document.querySelector('#ebene [data-aktion="mitteilungen-frage-ja"]');
  mtLaeuft = true; if (knopf) { knopf.disabled = true; knopf.textContent = "Wird eingeschaltet …"; }
  try { await mtEinschalten(true, true); }
  catch (e) { mtLaeuft = false; if (knopf) { knopf.disabled = false; knopf.textContent = "Aktivieren"; } mtMeldung(mtFehlerText(e)); return; }
  mtLaeuft = false;
  schliesseEbene(); toast("Mitteilungen eingeschaltet – änderbar unter „Mehr“");
}
/* ---------------- Erinnerung an die Datensicherung (13.10.2026) ----------------
   Mirko: "kleinere ideen auch umsetzen" - auf den Vorschlag: Wer nicht
   angemeldet ist, hat alles nur auf diesem Geraet. Neues Handy = Spesen weg,
   und der Anruf geht an Mirko. Deshalb fragt die Startseite hoechstens einmal
   in 30 Tagen, ob gesichert werden soll.
   - nur ohne Anmeldung: wer angemeldet ist oder es auf diesem Geraet schon war
     (__sync_uid, setzt firebase-sync.js sofort beim Start), gleicht ab
   - fruehestens 14 Tage nach der Einrichtung (config.eingerichtetAm; Geraete
     ohne das Feld laufen schon laenger - dort sofort)
   - letzte Sicherung UND letzte Frage beide mindestens 30 Tage her
   - nie zwei Boegen in einer Sitzung: kommt heute die Mitteilungs-Frage oder
     war schon irgendein Bogen offen, fragt es beim naechsten Oeffnen
   - NICHT im Test-Browser (navigator.webdriver), ausser window.__sichPruefung -
     sonst stuende in vielen Pruefungen ploetzlich ein Bogen im Weg (dieselbe
   Regel wie bei den Mitteilungen, Entscheidung 60).
   Merker auf dem Geraet: rieb_sicherung_am (letztes "Backup als Datei
   speichern", Datum), rieb_sicherung_gefragt (letzte Frage, Datum). */
const SICH_AM = "rieb_sicherung_am", SICH_GEFRAGT = "rieb_sicherung_gefragt", SICH_ABSTAND = 30, SICH_SCHONZEIT = 14;
function tageSeit(iso) {
  if (!iso) return Infinity;
  return Math.floor((new Date(heuteIso() + "T12:00") - new Date(String(iso).slice(0, 10) + "T12:00")) / 864e5);
}
function sicherungFaellig() {
  if (localStorage.getItem("spesen_config") === null) return false;
  if (localStorage.getItem("__sync_uid") || syncAn()) return false;
  if (config.eingerichtetAm && tageSeit(config.eingerichtetAm) < SICH_SCHONZEIT) return false;
  return tageSeit(localStorage.getItem(SICH_AM)) >= SICH_ABSTAND && tageSeit(localStorage.getItem(SICH_GEFRAGT)) >= SICH_ABSTAND;
}
function sicherungZuletzt() {
  const am = localStorage.getItem(SICH_AM);
  return am ? new Date(am + "T12:00").toLocaleDateString("de-DE") : "";
}
function sicherungFragen() {
  if (navigator.webdriver && !window.__sichPruefung) return;
  const start = ebenenSeitStart;
  let versuche = 0;
  const t = setInterval(() => {
    if (++versuche > 120) { clearInterval(t); return; }
    if (!mtZustand.geladen && versuche < 20) return;   // erst wissen, ob heute die Mitteilungs-Frage kommt
    const mtKommt = mtZustand.geladen && !mtAn() && !mtZustand.gefragt && mtMoeglich() === "ja";
    if (mtKommt || ebenenSeitStart !== start || !sicherungFaellig()) { clearInterval(t); return; }
    const e = document.getElementById("ebene");
    const frei = aktuell === "start" && !document.getElementById("intro") && !document.getElementById("brief") && !document.querySelector("#einrichtung:not([hidden])")
      && e && e.hidden && !document.documentElement.dataset.vt && !document.querySelector("#toast.zeigen");
    if (!frei) return;
    clearInterval(t);
    localStorage.setItem(SICH_GEFRAGT, heuteIso());
    const zuletzt = sicherungZuletzt();
    const abgleich = !!syncZ();   // Anmelden nur anbieten, wo der Abgleich verfuegbar ist
    oeffneEbene(`${bogenKopf("Erinnerung", "Datensicherung")}
      <p class="e-unterzeile" style="margin:12px 2px 0;font-size:14.5px;color:var(--tinte2)">Ihre Spesen und Ihr Urlaub liegen nur auf diesem Gerät. Geht es verloren oder bekommen Sie ein neues, sind die Einträge weg. ${zuletzt ? `Zuletzt gesichert am ${esc(zuletzt)}.` : "Auf diesem Gerät gibt es noch keine Sicherung."}</p>
      <button class="haupt-knopf" style="margin-top:14px" data-aktion="sicherung-jetzt">Jetzt sichern</button>
      ${abgleich ? `<button class="text-knopf" data-aktion="sicherung-anmelden">Lieber anmelden – dann gleicht es sich von selbst ab</button>` : ""}
      <button class="text-knopf" data-aktion="sicherung-spaeter">Später</button>`);
  }, 500);
}
/* "Backup als Datei speichern" (Mehr) und "Jetzt sichern" (Erinnerung): ein Weg */
async function sicherungSpeichern() {
  await exportBackupVoll();
  localStorage.setItem(SICH_AM, heuteIso());
  if (aktuell === "mehr") renderMehr();
}

/* Fuer die Pruefung (mitteilungen-pruefen.js): vorausrechnen mit gesetzten Schaltern, ohne sie zu speichern */
window.riebMitteilungen = {
  zustand: () => JSON.parse(JSON.stringify(mtZustand)),
  vorausrechnen: (schalter) => { const alt = { erinnerung: mtZustand.erinnerung, spruch: mtZustand.spruch }; Object.assign(mtZustand, schalter || {}); try { return mtVorausrechnen(); } finally { Object.assign(mtZustand, alt); } },
  auffrischen: (o) => mtAuffrischen(o || {}),
};

/* ---------------- Live: Uhr und laufender Tag ---------------- */
let letzterZustand = null;
function uhrStellen() {
  const d = new Date();
  const H = document.getElementById("uhrH"); if (!H) return;
  H.textContent = zwei(d.getHours()); document.getElementById("uhrM").textContent = zwei(d.getMinutes()); document.getElementById("uhrS").textContent = zwei(d.getSeconds());
  const g = document.getElementById("riebGruss"); if (g) g.textContent = tagesGruss(d) + ",";
  /* Neuer Tag, waehrend die Seite offen ist (ueber Mitternacht): neuer Spruch */
  const sp = document.getElementById("riebSpruch"); if (sp && sp.dataset.tag !== isoVon(d)) { sp.textContent = tagesSpruchMit(d).text; sp.dataset.tag = isoVon(d); }
}
function takt() {
  if (!aktuell) return;
  uhrStellen();
  if (aktuell === "zeit") zeitTakt();
  if (aktuell === "start") stempelTakt();
  const h = new Date(), w = tagInfo(h, feiertage(h.getFullYear(), config.bundesland));
  const p = (w.p || 0).toFixed(4);
  const kh = document.getElementById("kHeute"); if (kh) kh.style.setProperty("--p", p);
  document.querySelectorAll("#rieb .seg-heute").forEach((s) => s.style.setProperty("--p", p));
  document.querySelectorAll("#rieb .tag.heute .t-lauf").forEach((s) => s.style.setProperty("--p", p));
  const zustand = (w.heute || w.art) + "|" + w.iso;
  if (letzterZustand !== null && zustand !== letzterZustand) {
    alleNeu();
    if (w.heute === "fertig" && kh) {
      const neu = document.getElementById("kHeute"); if (neu) neu.classList.add("blitz");
      document.querySelectorAll("#rieb .seg-heute").forEach((s) => s.classList.add("neu"));
      toast("Feierabend · der Tag ist erledigt");
    }
  }
  letzterZustand = zustand;
}

/* Nach jeder Aenderung: sichtbare Zahlen rollen vom alten auf den neuen
   Wert, unsichtbare werden still neu gezeichnet. */
function alleNeu() {
  if (!document.getElementById("rieb")) return;
  const sichtbarStart = aktuell === "start";
  renderStart({ rollen: sichtbarStart });
  if (sichtbarStart) rollenLos(document.getElementById("s-start"));
  if (aktuell === "spesen") renderSpesen({ von: schnappschuss.s, halteScroll: true, auftritt: false });
  if (aktuell === "jahr") renderJahr({ von: schnappschuss.j, halteScroll: true });
  if (aktuell === "urlaub") { const s = document.getElementById("s-urlaub"), st = s.scrollTop; renderUrlaub(); s.scrollTop = st; }
  if (aktuell === "mehr") renderMehr();
  if (aktuell === "zeit") renderZeit({ halteScroll: true, auftritt: false });
  /* Ware nur neu zeichnen, wenn dort gerade nicht getippt wird */
  if (aktuell === "ware" && !(document.activeElement && document.activeElement.closest && document.activeElement.closest("#s-ware"))) renderWare({ halteScroll: true });
  /* Inventur ebenso (beide Ansichten) */
  if (aktuell === "inventur" && !(document.activeElement && document.activeElement.closest && document.activeElement.closest("#s-inventur"))) renderInventur({ halteScroll: true });
  const { j, m } = gewaehlt();
  schnappschuss = { s: monatInfo(j, m).summe, j: jahrInfos(config.jahr).reduce((s, x) => s + x.summe, 0) };
  /* Mitteilungen: Texte und plan nachziehen (Abschluss, Krank, Name …) */
  if (mtAn()) mtAuffrischenSpaeter();
}

/* ---------------- Boegen ---------------- */
let ebenenSeitStart = 0;   /* zaehlt geoeffnete Boegen - sicherungFragen() fragt nur, wenn noch keiner offen war */
function oeffneEbene(html) {
  ebenenSeitStart++;
  document.getElementById("bogenInhalt").innerHTML = html;
  const e = document.getElementById("ebene"); e.hidden = false;
  requestAnimationFrame(() => requestAnimationFrame(() => e.classList.add("offen")));
}
function schliesseEbene() {
  const e = document.getElementById("ebene"); if (!e || e.hidden) return;
  const r = document.getElementById("rieb"); if (r) r.classList.remove("ebene-oben");   // erAnmelden (10.10.2026)
  e.classList.remove("offen"); setTimeout(() => { e.hidden = true; }, 420);
}
const bogenKopf = (ueber, titel) => `<div class="bogen-kopf"><div><div class="ueber">${ueber}</div><h3>${titel}</h3></div><button class="rund hell" data-zu aria-label="Schließen">${ic("x")}</button></div>`;
/* Zeitfeld: zeigt die Zeit gross, oeffnet beim Antippen das Zeit-Dreh-Rad
   der Live-Fassung ("das Zeit-Dreh-Rad behalten, nur neu einkleiden"). */
/* spiegel: Id eines (versteckten) Eingabefelds, das den Wert mitbekommt -
   fuer die Funktionen der Live-Fassung, die ihre Zeiten aus Feldern lesen
   (Zeit: azNachVon/azNachBis, azFuellVon/azFuellBis). */
const zeitfeld = (id, label, wert, spiegel) => `<button class="zeitfeld" data-rad="${id}" type="button"><span>${label}</span><b id="${id}" data-wert="${wert || ""}"${spiegel ? ` data-spiegel="${spiegel}"` : ""}>${wert || "--:--"}</b></button>`;
const wertVon = (id) => { const el = document.getElementById(id); return el ? (el.dataset.wert || "") : ""; };

let bearbeite = null, bArt = "arbeit";
function oeffneTag(iso) {
  const d = new Date(iso + "T12:00:00"), map = feiertage(d.getFullYear(), config.bundesland);
  const w = tagInfo(d, map), ov = overrides[iso] || {}, std = standard(), f = felderFuer();
  bearbeite = iso;
  bArt = ov.status && ARTEN[ov.status] ? ov.status : "arbeit";
  const ab = ov[f.s] || (w.ab && w.art !== "kommt" ? w.ab : "") || std.ab || "";
  const an = ov[f.e] || (w.an && w.art !== "kommt" ? w.an : "") || std.an || "";
  const orte = ov.orte !== undefined ? ov.orte : (config.orteDefault || "");
  const gesperrt = tagGesperrt(iso);
  const hatEigenes = !!(ov[f.s] || ov[f.e] || ov.orte !== undefined || ov.status);
  oeffneEbene(`
    ${bogenKopf(WT_LANG[d.getDay()] + (iso === heuteIso() ? " · heute" : "") + (map[iso] ? " · " + esc(map[iso]) : ""), `${d.getDate()}. ${MON[d.getMonth()]} ${d.getFullYear()}`)}
    ${gesperrt ? `<div class="status-text">${ic("schloss")} Dieser Monat ist abgeschlossen. Zum Ändern zuerst „Wieder öffnen“.</div>` : ""}
    <div class="arten">${[["arbeit", "Arbeitstag"], ...Object.entries(ARTEN)].map(([a, t]) => `<button class="art ${a === bArt ? "an" : ""}" data-bart="${a}">${t}</button>`).join("")}</div>
    <div id="bArbeit">
      <div class="zeiten">${zeitfeld("bAb", startLabel(), ab)}${zeitfeld("bAn", endLabel(), an)}</div>
      ${innen() ? "" : `<label class="feld ortfeld"><span>besuchte Orte</span><input id="bOrte" value="${esc(orte)}"></label>`}
      <div class="messer">
        <div class="messer-zeile"><span class="messer-std" id="mStd"></span><span class="messer-betrag" id="mBetrag"></span></div>
        <div class="skala" id="mSkala"><div class="skala-fuell" id="mFuell"></div><span class="strich" style="left:${8 / 11 * 100}%"></span><span class="strich" style="left:${10 / 11 * 100}%"></span></div>
        <div class="skala-text"><span style="left:${8 / 11 * 100}%">8 Std</span><span style="left:${10 / 11 * 100}%">10 Std</span></div>
        <div class="messer-satz" id="mSatz"></div>
      </div>
    </div>
    <div id="bStatus" class="status-text" hidden></div>
    ${gesperrt ? `<button class="haupt-knopf" data-aktion="oeffnen-bogen">Wieder öffnen</button>`
               : `<button class="haupt-knopf" data-aktion="tag-speichern">Speichern</button>`}
    ${!gesperrt && hatEigenes ? `<button class="text-knopf" data-aktion="tag-standard">${iso <= heuteIso() ? "Auf Standardzeiten zurücksetzen" : "Eintrag entfernen"}</button>` : ""}
    ${!gesperrt && !hatEigenes && w.art === "standard" ? `<p class="klein-text" style="text-align:center">Dieser Tag läuft mit Ihren Standardzeiten.</p>` : ""}`);
  messen(); artZeigen();
}
function messen() {
  const ab = wertVon("bAb"), an = wertVon("bAn");
  if (!document.getElementById("mStd")) return;
  const n = nettoAus(ab, an), s = satzFuer(n);
  document.getElementById("mStd").innerHTML = n == null ? "–" : `${stundenText(n / 60).replace(" Std", "")}<small>Std</small>`;
  document.getElementById("mBetrag").textContent = euro(s) + " €";
  document.getElementById("mFuell").style.width = Math.min(100, Math.max(0, (n || 0) / 660 * 100)) + "%";
  const sk = document.getElementById("mSkala"); sk.classList.toggle("kurz", (n || 0) <= 480); sk.classList.toggle("lang", (n || 0) > 600);
  document.getElementById("mSatz").textContent = n == null ? "Beide Zeiten eintragen."
    : n > 600 ? "Über 10 Std – dieser Tag wird nicht genehmigt."
    : n > 480 ? "Mehr als 8 Std Arbeitszeit – Pauschale " + euro(pauschaleSatz8()) + " €."
    : "Erst ab mehr als 8 Std Arbeitszeit gibt es eine Pauschale.";
}
function artZeigen() {
  const arbeit = bArt === "arbeit";
  const a = document.getElementById("bArbeit"); if (!a) return;
  a.hidden = !arbeit;
  const st = document.getElementById("bStatus"); st.hidden = arbeit;
  if (!arbeit) st.innerHTML = `Der Tag zählt als <b>${ARTEN[bArt]}</b> – ohne Pauschale. Er erscheint im Urlaubskalender.`;
  document.querySelectorAll("#rieb [data-bart]").forEach((b) => b.classList.toggle("an", b.dataset.bart === bArt));
}
function tagSpeichern() {
  const iso = bearbeite; if (!iso) return;
  if (tagGesperrt(iso)) { sperrHinweis(); return; }
  const f = felderFuer(), ov = overrides[iso] = overrides[iso] || {};
  if (bArt === "arbeit") {
    const ab = wertVon("bAb"), an = wertVon("bAn");
    if (!!ab !== !!an) { toast("Bitte beide Zeiten eintragen"); return; }
    delete ov.status;
    const orteEl = document.getElementById("bOrte");
    const std = standard();
    const wieStandard = ab === std.ab && an === std.an && (!orteEl || orteEl.value === (config.orteDefault || ""));
    /* Gleich wie die Standardzeiten UND nicht in der Zukunft: dann den Tag
       wieder an die Vorgabe haengen. In der Zukunft gilt die Vorgabe nicht
       von selbst (Tag fuer Tag) - dort bleibt der Eintrag ausdruecklich. */
    if (wieStandard && iso <= heuteIso()) { delete ov[f.s]; delete ov[f.e]; delete ov.orte; }
    else {
      if (ab) ov[f.s] = ab; else delete ov[f.s];
      if (an) ov[f.e] = an; else delete ov[f.e];
      if (orteEl) { if (orteEl.value !== (config.orteDefault || "")) ov.orte = orteEl.value; else delete ov.orte; }
    }
    delete ov.voraus;   // von Hand bearbeitet = kein "vorausgefuellt" mehr
  } else {
    ov.status = bArt;
  }
  if (Object.keys(ov).length === 0) delete overrides[iso];
  saveOverrides();
  schliesseEbene();
  renderFormular();          // -> riebNachRender() -> alleNeu()
  toast("Gespeichert");
}
function tagStandard() {
  const iso = bearbeite; if (!iso) return;
  if (tagGesperrt(iso)) { sperrHinweis(); return; }
  const f = felderFuer(), ov = overrides[iso] || {};
  delete ov[f.s]; delete ov[f.e]; delete ov.orte; delete ov.status; delete ov.voraus;
  if (Object.keys(ov).length === 0) delete overrides[iso]; else overrides[iso] = ov;
  saveOverrides(); schliesseEbene(); renderFormular();
  toast(iso <= heuteIso() ? "Wieder auf Standardzeiten" : "Eintrag entfernt");
}

function oeffneZeiten() {
  const std = standard();
  oeffneEbene(`
    ${bogenKopf("Einmal eintragen – gilt für jeden Werktag", "Zeiten für alle Tage")}
    <div class="zeiten">${zeitfeld("zAb", startLabel() + " (Standard)", std.ab)}${zeitfeld("zAn", endLabel() + " (Standard)", std.an)}</div>
    ${/* Seit 10.10.2026 direkt unter den Zeiten - wie in der alten Fassung (Mirko:
         "wieso kann ich ... nicht auch die funktion an jeden tag unterschiedlich
         ankreuzen? die gibts da garnicht"). Dieselbe Einstellung wie unter
         Einstellungen -> Arbeitstag (cfgZeitenVariieren). */ ""}
    <div class="schalter-liste" style="margin-top:12px">
      <label class="schalter"><span><b>Jeden Tag gleich</b><small>Jeder Werktag mit Ihren Zeiten für alle Tage</small></span><input type="radio" name="zVar" id="zVarGleich" ${config.zeitenVariieren ? "" : "checked"}></label>
      <label class="schalter"><span><b>Jeden Tag anders</b><small>Kein Tag wie der andere: Mo–Mi 8:50–10:00, Do–Fr 8:30–9:10 Arbeitszeit – 10 Std an höchstens einem Tag pro Woche, nie unter 8:30</small></span><input type="radio" name="zVar" id="zVariieren" ${config.zeitenVariieren ? "checked" : ""}></label>
    </div>
    <div class="messer"><div class="messer-zeile"><span class="messer-std" id="zStd"></span><span class="messer-betrag" id="zBetrag"></span></div>
      <div class="messer-satz">Die Zeiten stehen dann automatisch auf jedem Werktag des Monats – Tag für Tag bis heute. Einzelne Tage lassen sich danach weiterhin abweichend ändern; die werden hier nicht überschrieben.</div></div>
    <button class="haupt-knopf" data-aktion="zeiten-ok">Übernehmen</button>
    ${std.ab || std.an ? `<button class="text-knopf" data-aktion="zeiten-leeren">Zeiten leeren</button>` : ""}`);
  zeitenMessen();
}
function zeitenMessen() {
  if (!document.getElementById("zStd")) return;
  const n = nettoAus(wertVon("zAb"), wertVon("zAn"));
  document.getElementById("zStd").innerHTML = n == null ? "–" : `${stundenText(n / 60).replace(" Std", "")}<small>Std je Tag</small>`;
  document.getElementById("zBetrag").textContent = euro(satzFuer(n)) + " €";
}

/* Stammdaten: geschrieben wird ueber die Felder der alten Einstellungen und
   saveConfig() - EIN Speicherweg, derselbe wie bisher. */
function setze(id, wert) { const el = document.getElementById(id); if (el) el.value = wert; }
function oeffneStamm() {
  const optionen = Object.entries(BUNDESLAENDER).map(([k, v]) => `<option value="${k}" ${k === config.bundesland ? "selected" : ""}>${v}</option>`).join("");
  oeffneEbene(`
    ${bogenKopf("Stehen auf Ihrem Spesennachweis", "Stammdaten")}
    <div style="margin-top:16px">
      <label class="feld"><span>Name</span><input id="sName" value="${esc(config.name || "")}" autocomplete="name"></label>
      <div class="felder" style="margin-top:10px"><label class="feld"><span>Straße</span><input id="sStrasse" value="${esc(config.strasse || "")}"></label><label class="feld"><span>Ort</span><input id="sOrt" value="${esc(config.ort || "")}"></label></div>
      <label class="feld" style="margin-top:10px"><span>Niederlassung</span><input id="sNl" value="${esc(config.niederlassung || "")}"></label>
    </div>
    <div class="rollen">${Object.entries(ROLLEN).map(([k, [t, u]]) => `<button class="rolle-wahl ${k === config.mitarbeitertyp ? "an" : ""}" data-srolle="${k}"><span class="r-ic">${ic(ROLLEN_IC[k])}</span><span><b>${t}</b><small>${u}</small></span></button>`).join("")}</div>
    <label class="feld" style="margin-top:10px"><span>Bundesland (für die Feiertage)</span><select id="sLand">${optionen}</select></label>
    <label class="feld" style="margin-top:10px"><span>Ihre E-Mail (für „CSV an mich selbst“)</span><input id="sMail" type="email" value="${esc(config.eigeneEmail || "")}"></label>
    ${tabErlaubt("inventur") ? `<label class="feld" style="margin-top:10px"><span>Tour-Nr. (Inventurblatt)</span><input id="sTour" value="${esc(config.tour || "")}"></label>` : ""}
    <button class="haupt-knopf" style="margin-top:16px" data-aktion="stamm-ok">Speichern</button>`);
}
function stammSpeichern() {
  const wert = (id) => { const el = document.getElementById(id); return el ? el.value.trim() : null; };
  setze("cfgName", wert("sName")); setze("cfgStrasse", wert("sStrasse")); setze("cfgOrt", wert("sOrt"));
  setze("cfgNiederlassung", wert("sNl")); setze("cfgBundesland", wert("sLand")); setze("cfgEigeneEmail", wert("sMail"));
  if (document.getElementById("sTour")) setze("cfgTour", wert("sTour"));
  const r = document.querySelector("#rieb [data-srolle].an");
  if (r) setze("cfgMitarbeitertyp", r.dataset.srolle);
  saveConfig(); updateMitarbeitertypUI(); aktualisiereZeitSichtbarkeit();
  schliesseEbene(); renderFormular();
  toast("Stammdaten gespeichert");
}

/* Einstellungen: alles, was die alte Fassung in den Einstellungen hatte und
   der Entwurf nicht zeigt - damit keine Funktion verloren geht.
   Seit 09.10.2026 (Entwurf 2, Mirko: "einstellung steuert ja spesen, deshalb
   gehört es zu spesen dazu") je KARTE im Spesen-Bereich ein Teil:
     arbeitstag  Orte, Samstag, Zeiten variieren
     nl          Anwesenheit in der Niederlassung
     pauschalen  Pauschalen, ueber Gehalt bezahlt
   Ohne Teil: alles wie bisher. */
const NL_TAGE = [["alle", "Alle Wochentage (Mo–Fr)"], ["0", "Montag"], ["1", "Dienstag"], ["2", "Mittwoch"], ["3", "Donnerstag"], ["4", "Freitag"], ["5", "Samstag"]];
function oeffneEinstellungen(teil) {
  const nlTage = NL_TAGE;
  const pausch8 = document.getElementById("cfgPauschale8"), fest = pausch8 && pausch8.disabled;
  const zeig = (t) => !teil || teil === t;
  const titel = { arbeitstag: "Arbeitstag", nl: "Anwesenheit in der Niederlassung", pauschalen: "Pauschalen & Gehalt" }[teil] || "Einstellungen";
  oeffneEbene(`
    ${bogenKopf("Einstellungen für Ihren Spesennachweis", titel)}
    ${zeig("arbeitstag") ? `<div class="e-unterzeile" style="margin:14px 2px 6px;font-weight:620;color:var(--tinte2)">Ihre Zeiten</div>
    <div class="schalter-liste" style="margin-top:0">
      <label class="schalter"><span><b>Jeden Tag gleich</b><small>Jeder Werktag mit Ihren Zeiten für alle Tage</small></span><input type="radio" name="eVar" id="eVarGleich" ${config.zeitenVariieren ? "" : "checked"}></label>
      <label class="schalter"><span><b>Jeden Tag anders</b><small>Kein Tag wie der andere: Mo–Mi 8:50–10:00, Do–Fr 8:30–9:10 Arbeitszeit – 10 Std an höchstens einem Tag pro Woche, nie unter 8:30</small></span><input type="radio" name="eVar" id="eVariieren" ${config.zeitenVariieren ? "checked" : ""}></label>
    </div>
    <div class="schalter-liste" style="margin-top:14px">
      <label class="schalter"><span><b>Samstag als Tageszeile</b><small>Für alle Wochen – einzelne Samstage lassen sich auch direkt in der Liste eintragen</small></span><input type="checkbox" id="eSamstag" ${config.samstagAktiv ? "checked" : ""}></label>
    </div>
    ${innen() ? "" : `<label class="feld" style="margin-top:14px"><span>Besuchte Orte (Vorgabe für jeden Tag)</span><input id="eOrte" value="${esc(config.orteDefault || "")}"></label>`}` : ""}
    ${zeig("nl") ? `<div class="karte" style="margin-top:14px">
      ${teil ? "" : "<h3>Anwesenheit in der Niederlassung</h3>"}
      <label class="schalter"><span><b>An einem festen Wochentag</b><small>Trägt die Anwesenheitszeit automatisch ein</small></span><input type="checkbox" id="eNlAktiv" ${config.nlAktiv ? "checked" : ""}></label>
      <div class="felder" style="margin-top:10px">
        <label class="feld"><span>Wochentag</span><select id="eNlTag">${nlTage.map(([v, t]) => `<option value="${v}" ${String(config.nlTag) === v ? "selected" : ""}>${t}</option>`).join("")}</select></label>
        <span></span>
      </div>
      <div class="zeiten">${zeitfeld("eNlVon", "Von", config.nlVon || "")}${zeitfeld("eNlBis", "Bis", config.nlBis || "")}</div>
    </div>` : ""}
    ${zeig("pauschalen") ? `<div class="felder" style="margin-top:14px">
      <label class="feld"><span>Pauschale über 8 Std (€)</span><input id="eP8" type="number" step="0.5" value="${config.pauschale8}" ${fest ? "disabled" : ""}></label>
      <label class="feld"><span>Pauschale über 24 Std (€)</span><input id="eP24" type="number" step="0.5" value="${config.pauschale24}" ${fest ? "disabled" : ""}></label>
    </div>
    <label class="feld" style="margin-top:10px"><span>Über Gehaltsabrechnung bezahlt (Vorgabe je Monat, €)</span><input id="eBezahlt" type="number" step="0.5" value="${config.bezahltDefault}"></label>` : ""}
    <button class="haupt-knopf" style="margin-top:16px" data-aktion="einstellungen-ok">Speichern</button>`);
}
function einstellungenSpeichern() {
  const chk = (id, ziel) => { const q = document.getElementById(id), z = document.getElementById(ziel); if (q && z) z.checked = q.checked; };
  chk("eVariieren", "cfgZeitenVariieren"); chk("eSamstag", "cfgSamstagAktiv"); chk("eNlAktiv", "cfgNlAktiv");
  const da = (id) => !!document.getElementById(id);
  const v = (id) => { const el = document.getElementById(id); return el ? el.value : null; };
  /* Nur schreiben, was im Bogen STEHT (seit 09.10.2026 zeigt er je Karte nur
     einen Teil) - sonst setzte ein fehlendes Feld den alten Wert auf leer. */
  if (da("eOrte")) setze("cfgOrte", v("eOrte"));
  if (da("eNlTag")) {
    setze("cfgNlTag", v("eNlTag"));
    setze("cfgNlVon", wertVon("eNlVon")); setze("cfgNlBis", wertVon("eNlBis"));
    if (typeof syncTimePickerDisplay === "function") { syncTimePickerDisplay("cfgNlVon"); syncTimePickerDisplay("cfgNlBis"); }
  }
  const p8 = document.getElementById("eP8");
  if (p8 && !p8.disabled) { setze("cfgPauschale8", v("eP8")); setze("cfgPauschale24", v("eP24")); }
  if (da("eBezahlt")) setze("cfgBezahltDefault", v("eBezahlt"));
  saveConfig(); schliesseEbene(); renderFormular();
  toast("Einstellungen gespeichert");
}

/* Einen eingetragenen Abwesenheits-Zeitraum wieder herausnehmen - die
   Live-Funktion removeAbsenceRange() (laesst gesperrte Monate aus). Die
   alte Oberflaeche hatte die Liste mit X; in der neuen fehlte sie (09.10.2026).
   Mit Rueckfrage: am Handy ist ein X schnell aus Versehen getroffen. */
function abwesenheitEntfernen(von, bis, art) {
  const dm = (iso) => iso.slice(8, 10) + "." + iso.slice(5, 7) + "." + iso.slice(0, 4);
  if (!confirm(`${art || "Abwesenheit"} ${von === bis ? "am " + dm(von) : dm(von) + " – " + dm(bis)} wieder herausnehmen?\n\nDie Tage gelten danach wieder als Arbeitstage.`)) return;
  removeAbsenceRange(von, bis);
  toast("Herausgenommen");
}

function oeffneAbwesenheit() {
  oeffneEbene(`${bogenKopf("Urlaub, Krank, Frei – auch mehrere Tage am Stück", "Abwesenheit eintragen")}<div style="margin-top:14px">${abwesenheitFelder("b")}</div>`);
}
function abwesenheitEintragen(p) {
  const von = (document.getElementById(p + "AbwVon") || {}).value || "";
  let bis = (document.getElementById(p + "AbwBis") || {}).value || "";
  if (!von) { toast("Bitte ein Von-Datum wählen"); return; }
  if (!bis) bis = von;
  if (bis < von) { toast("Das Bis-Datum liegt vor dem Von-Datum"); return; }
  const gruppe = document.querySelector(`#rieb .arten[data-gruppe="${p}"] .art.an`);
  const status = gruppe ? gruppe.dataset.art : "urlaub";
  const isos = []; eachDateInRange(von, bis, (iso) => isos.push(iso));
  const frei = ohneGesperrteTage(isos);
  frei.forEach((iso) => { overrides[iso] = overrides[iso] || {}; overrides[iso].status = status; });
  saveOverrides();
  if (p === "b") schliesseEbene();
  renderFormular();
  if (typeof renderAbsenceRangesList === "function") renderAbsenceRangesList();
  toast(`${ARTEN[status]} eingetragen · ${frei.length} ${frei.length === 1 ? "Tag" : "Tage"}`);
}

const zk = (x) => String(x).replace(".", ",");
function oeffneAnspruch() {
  const J = urlaubJahr || config.jahr, g = urlaubGilt(J);
  /* Seit 09.10.2026: der automatische Uebertrag ist ein VORSCHLAG (zaehlt erst
     nach Bestaetigung, urlaubGilt in index.html). Das Feld traegt ihn vor -
     wer hier nur den Anspruch aendert und speichert, bestaetigt sonst
     versehentlich "0". Speichern = bestaetigen. */
  const uebertrag = g.auto ? g.auto.rest : g.uebertrag;
  const woher = g.auto
    ? `<div class="hinweis karte" style="margin-top:12px">${ic("info")}<span><b>Vorschlag: ${zk(g.auto.rest)} Tage aus ${g.auto.jahr}.</b> Dort standen Ihnen ${zk(g.auto.stand)} Tage zu, eingetragen sind ${zk(g.auto.genommen)}. Bitte prüfen – mit „Speichern“ zählt die Zahl.</span></div>`
    : "";
  oeffneEbene(`${bogenKopf("Gilt für das Jahr " + J, "Urlaubsanspruch")}
    <div class="felder" style="margin-top:14px">
      <label class="feld"><span>Urlaubstage ${J}</span><input id="aAnspruch" type="number" step="0.5" min="0" value="${g.anspruch}"></label>
      <label class="feld"><span>Übertrag aus ${J - 1}</span><input id="aUebertrag" type="number" step="0.5" min="0" value="${uebertrag}"></label>
    </div>
    ${woher}
    <p class="klein-text">Manche haben 30, manche 28 – tragen Sie ein, was für Sie gilt. Den Rest aus dem Vorjahr schlägt das Werkzeug aus Ihren Einträgen vor – er zählt, sobald Sie ihn bestätigen.</p>
    <button class="haupt-knopf" style="margin-top:14px" data-aktion="anspruch-ok">Speichern</button>`);
}
/* Anspruch + Uebertrag eines Jahres festschreiben - ueber die Felder der
   alten Ansicht und urlaubSaveAnspruch(), EIN Speicherweg wie bisher. */
function anspruchSchreiben(J, anspruch, uebertrag) {
  const sel = document.getElementById("urlaubJahr");
  if (sel) { if (![...sel.options].some((o) => o.value === String(J))) { const o = document.createElement("option"); o.value = String(J); o.textContent = String(J); sel.appendChild(o); } sel.value = String(J); }
  setze("urlaubAnspruch", anspruch);
  setze("urlaubUebertrag", uebertrag);
  urlaubSaveAnspruch();
}
function anspruchSpeichern() {
  const J = urlaubJahr || config.jahr;
  anspruchSchreiben(J, document.getElementById("aAnspruch").value, document.getElementById("aUebertrag").value);
  schliesseEbene(); alleNeu(); toast("Urlaubsanspruch gespeichert");
}

/* ---------------- Resturlaub: nachfragen statt still uebernehmen ----------------
   Mirko 09.10.2026 auf den Vorschlag "Im Januar fragt das Werkzeug jeden
   einmal: Übertrag laut Ihren Einträgen – stimmt das?": "ja genau es soll
   nachfragen". Grund: Die Automatik kennt nur Eingetragenes - wer das
   Werkzeug erst ab Juli nutzt, haette sonst den Urlaub Jan-Jun als Rest.
   Gefragt wird beim Start, solange ein Vorschlag offen ist; "Später" fragt
   am naechsten Tag wieder. Bis dahin zaehlt der Vorschlag NICHT. */
const REST_SPAETER_KEY = "rieb_resturlaub_spaeter";
function oeffneResturlaub() {
  const J = config.jahr, g = urlaubGilt(J);
  if (!g.auto) return;
  const a = g.auto;
  oeffneEbene(`${bogenKopf("Neues Urlaubsjahr " + J, "Resturlaub aus " + a.jahr)}
    <p class="e-unterzeile" style="margin:14px 2px 0;font-size:14.5px;color:var(--tinte2)">Laut Ihren Einträgen standen Ihnen ${a.jahr} <b>${zk(a.stand)} Tage</b> zu, eingetragen sind <b>${zk(a.genommen)}</b>. Übrig wären <b>${zk(a.rest)} Tage</b>.</p>
    <p class="e-unterzeile" style="margin:10px 2px 0;font-size:14.5px;color:var(--tinte)"><b>Stimmt das?</b> Wenn nicht alles eingetragen ist, tragen Sie Ihren echten Rest ein.</p>
    <label class="feld" style="margin-top:14px"><span>Übertrag aus ${a.jahr} nach ${J} (Tage)</span><input id="aRest" type="number" step="0.5" min="0" value="${a.rest}"></label>
    <button class="haupt-knopf" style="margin-top:14px" data-aktion="rest-ok">Speichern</button>
    <button class="text-knopf" data-aktion="rest-spaeter">Später</button>
    <p class="klein-text" style="text-align:center">Erst mit „Speichern“ zählt die Zahl. Ändern geht jederzeit unter Urlaub → Urlaubsanspruch.</p>`);
}
function resturlaubSpeichern() {
  const J = config.jahr, g = urlaubGilt(J);
  const wert = (document.getElementById("aRest") || {}).value;
  if (wert === "" || wert == null || isNaN(Number(wert)) || Number(wert) < 0) { toast("Bitte eine Zahl eintragen"); return; }
  anspruchSchreiben(J, g.anspruch, wert);
  localStorage.removeItem(REST_SPAETER_KEY);
  schliesseEbene(); alleNeu(); toast("Resturlaub übernommen");
}
function resturlaubSpaeter() {
  localStorage.setItem(REST_SPAETER_KEY, heuteIso());
  schliesseEbene();
}
/* Beim Start: erst wenn Einstieg, Brief, Einrichtung und andere Boegen
   weg sind - nie zwei Dinge uebereinander. */
function resturlaubFragen() {
  let versuche = 0;
  const t = setInterval(() => {
    if (++versuche > 60) { clearInterval(t); return; }
    const frei = !document.getElementById("intro") && !document.getElementById("brief") && !document.querySelector("#einrichtung:not([hidden])")
      && document.getElementById("ebene") && document.getElementById("ebene").hidden && !document.documentElement.dataset.vt;
    if (!frei) return;
    clearInterval(t);
    const g = urlaubGilt(config.jahr);
    if (g.auto && localStorage.getItem(REST_SPAETER_KEY) !== heuteIso()) oeffneResturlaub();
  }, 500);
}

/* Der Ordner zeigt jeden Monat, der abgeschlossen IST - und jeden, dessen
   PDF noch im Tool liegt, auch wenn er wieder geoeffnet wurde. So war es
   vorgeschlagen und angenommen (08.10.2026): "Speichert man danach neu,
   ersetzt die neue PDF die alte im Ordner" - bis dahin bleibt die alte da.
   Gefunden von rieb-wege-pruefen.js: Nach "Wieder öffnen" war der Monat
   aus der Liste verschwunden, obwohl die PDF noch gespeichert war. */
async function oeffneArchiv() {
  const liste = computeArchivedMonths();
  const schluessel = await pdfDbSchluessel();
  schluessel.forEach((k) => {
    const t = /^spesen-(\d{4})-(\d{1,2})$/.exec(String(k)); if (!t) return;
    const jahr = +t[1], monat = +t[2];
    if (liste.some((x) => x.jahr === jahr && x.monat === monat)) return;
    liste.push({ jahr, monat, ts: null, total: computeMonth(jahr, monat).total, offen: true });
  });
  liste.sort((a, b) => (b.jahr - a.jahr) || (b.monat - a.monat));
  const mirko = zeigtDigitaleAbgabe();
  oeffneEbene(`${bogenKopf("Monat für Monat", "Abgeschlossene Spesen")}
    <div class="liste" style="margin-top:16px">${liste.length ? liste.map((x) => `
      <div class="zeile archiv-zeile"><span class="z-ic">${ic("archiv")}</span>
        <span class="z-text">${MON[x.monat - 1]} ${x.jahr}<small>${x.offen ? "wieder geöffnet – die PDF zeigt den letzten Abschluss" : (mirko ? "eingereicht" : "abgeschlossen") + " am " + formatTimestampDE(x.ts) + " · " + euro(x.total) + " €"}</small></span>
        <span class="archiv-knoepfe"><button class="knopf-klein" data-pdf="spesen-${x.jahr}-${x.monat}" data-titel="Spesen ${MON[x.monat - 1]} ${x.jahr}">PDF</button><button class="knopf-klein" data-monatwahl="${x.jahr}-${x.monat}">Ansehen</button></span>
      </div>`).join("") : `<div class="zeile"><span class="z-text">Noch keine Spesen abgeschlossen<small>Sobald Sie einen Monat über „Abschließen“ fertigstellen, liegt er hier.</small></span></div>`}</div>
    <div class="hinweis karte" style="margin-top:14px">${ic("info")}<span>${syncAn()
      /* Angemeldet gleichen sich die PDFs ab (sync-pruefen Fall 1+2) - der
         Satz "nur auf diesem Geraet" stimmte dann nicht (Mirko 09.10.2026: "ja") */
      ? "<b>Angemeldet:</b> Die PDFs werden über Ihr Konto mit Ihren anderen Geräten abgeglichen."
      : "Alles liegt nur auf diesem Gerät. Bei einem Gerätewechsel vorher unter „Mehr“ ein <b>Backup</b> speichern."}</span></div>`);
}

function oeffneApp(os) {
  os = os || (/iPhone|iPad|iPod/.test(navigator.userAgent) ? "ios" : "android");
  const adresse = location.host || "diese Seite";
  const ios = `<ol class="schritte"><li><span><b>Safari</b> öffnen – andere Browser können das auf dem iPhone nicht</span></li><li><span>Diese Seite aufrufen: <b>${esc(adresse)}</b></span></li><li><span>Unten auf das <b>Teilen-Symbol</b> tippen (Quadrat mit Pfeil nach oben)</span></li><li><span>Nach unten wischen und <b>„Zum Home-Bildschirm“</b> wählen</span></li><li><span>Mit <b>„Hinzufügen“</b> bestätigen</span></li></ol>`;
  const andr = `<ol class="schritte"><li><span><b>Chrome</b> öffnen und <b>${esc(adresse)}</b> aufrufen</span></li><li><span>Meist meldet sich der Browser von selbst mit <b>„App installieren“</b> – einfach bestätigen</span></li><li><span>Falls nicht: Menü <b>⋮</b> oben rechts → <b>„App installieren“</b> oder <b>„Zum Startbildschirm hinzufügen“</b></span></li></ol>`;
  /* In der installierten App bleibt die Kachel stehen (App und Browser
     gleich aufgebaut, CLAUDE.md 22.09.2026) - der Bogen sagt dann nur, dass
     alles erledigt ist. */
  const schon = document.body.classList.contains("als-app");
  oeffneEbene(`
    ${bogenKopf("Einmal einrichten, immer griffbereit", "Am Handy als App")}
    ${schon ? `<div class="status-text"><b>Erledigt:</b> Sie nutzen Rieb Spesen bereits als App.</div>` : ""}
    <div class="symbol-vorschau"><span class="symbol"><img src="icons/apple-touch-icon.png" alt=""></span><p><b>Rieb Spesen</b>So erscheint das Symbol auf Ihrem Startbildschirm.</p></div>
    <div class="os-wahl"><button data-os="ios" class="${os === "ios" ? "an" : ""}">iPhone</button><button data-os="android" class="${os === "android" ? "an" : ""}">Android</button></div>
    ${os === "ios" ? ios : andr}
    <div class="hinweis karte" style="margin-top:12px">${ic("info")}<span>${syncAn()
      ? "<b>Sie sind angemeldet.</b> Melden Sie sich in der App mit derselben E-Mail an – dann haben App und Browser denselben Stand."
      : "<b>App und Browser speichern getrennt.</b> Bleiben Sie bei einem Weg – oder melden Sie sich unter „Mehr“ → „Geräte abgleichen“ an, dann ist überall derselbe Stand. Ohne Anmeldung wechseln Sie über „Backup als Datei speichern“ und „Backup wiederherstellen“."}</span></div>`);
}

/* ---------------- Monatswahl ---------------- */
function monatWechseln(schritt) {
  const { j, m } = gewaehlt();
  let nj = j, nm = m + schritt;
  if (nm < 1) { nm = 12; nj--; } if (nm > 12) { nm = 1; nj++; }
  const altSumme = monatInfo(j, m).summe;
  monatSetzen(nj, nm);
  renderSpesen({ richtung: schritt > 0 ? "rechts" : "links", von: altSumme, halteScroll: false });
  schnappschuss.s = monatInfo(nj, nm).summe;
}
/* Ueber die Felder der alten Einstellungen (Jahr, Zeitraum), damit
   saveConfig() alles konsistent schreibt - derselbe Weg wie in der alten
   Oberflaeche. */
function monatSetzen(j, m) {
  if (j !== config.jahr) setze("cfgJahr", j);
  const start = parseInt(document.getElementById("cfgStartMonat").value, 10) || 1;
  const ende = parseInt(document.getElementById("cfgEndMonat").value, 10) || 12;
  if (j !== config.jahr) { setze("cfgStartMonat", 1); setze("cfgEndMonat", 12); }
  else { if (m < start) setze("cfgStartMonat", m); if (m > ende) setze("cfgEndMonat", m); }
  saveConfig();
  rebuildMonthPicker();
  document.getElementById("monthPicker").value = String(m);
  stillRendern();
}
let stumm = false;
function stillRendern() { stumm = true; try { renderFormular(); } finally { stumm = false; } }

/* ---------------- Klicks ---------------- */
function aktion(a, t) {
  switch (a) {
    case "drucken": return printSpesen();
    case "ansehen": return previewPDF();
    case "speichern": return downloadPDF();
    case "abschliessen": return submitCurrentMonth();
    case "abwesenheit": return oeffneAbwesenheit();
    case "abwesenheit-eintragen": return abwesenheitEintragen(t.dataset.p);
    case "csv": return openCsvMenu();
    case "oeffnen": { const { j, m } = gewaehlt(); return reopenMonth(j, m); }
    case "oeffnen-bogen": { schliesseEbene(); const d = new Date(bearbeite + "T12:00:00"); return reopenMonth(d.getFullYear(), d.getMonth() + 1); }
    case "zu-heute": { const h = new Date(); monatSetzen(h.getFullYear(), h.getMonth() + 1); return renderSpesen({}); }
    case "tag-speichern": return tagSpeichern();
    case "tag-standard": return tagStandard();
    case "zeiten-ok": {
      const ab = wertVon("zAb"), an = wertVon("zAn");
      if (!ab || !an) { toast("Bitte beide Zeiten setzen"); return; }
      /* "Jeden Tag gleich / anders" aus diesem Bogen - szUebernehmen() speichert
         ueber saveConfig(), das cfgZeitenVariieren liest */
      const zv = document.getElementById("zVariieren"), cv = document.getElementById("cfgZeitenVariieren");
      if (zv && cv) cv.checked = zv.checked;
      szUebernehmen(ab, an); schliesseEbene(); toast("Zeiten für alle Tage übernommen"); return;
    }
    case "zeiten-leeren": szLeeren(); schliesseEbene(); return;
    case "stamm-ok": return stammSpeichern();
    case "einstellungen-ok": return einstellungenSpeichern();
    case "rest-pruefen": return oeffneResturlaub();
    case "rest-ok": return resturlaubSpeichern();
    case "rest-spaeter": return resturlaubSpaeter();
    case "abw-weg": return abwesenheitEntfernen(t.dataset.von, t.dataset.bis, t.dataset.abwart);   // NICHT data-art: das faengt klick() fuer die Art-Knoepfe vorher ab
    case "spesen-zuruecksetzen": return bereichZuruecksetzen("spesen");   // index.html: Sicherung vorher, abgeschlossene Monate bleiben
    case "urlaub-zuruecksetzen": return bereichZuruecksetzen("urlaub");   // dito; dazu Anspruch/Uebertrag/urlaubJahre auf Grundwert
    case "anspruch-ok": return anspruchSpeichern();
    case "sig-einfuegen": { const f = document.getElementById("sigFile-spesen_signature"); if (f) f.click(); return; }
    case "sig-weg": clearSignature("spesen_signature"); return alleNeu();
    case "urlaub-drucken": return urlaubDrucken();
    case "jahr-drucken": return jahrDrucken();
    case "backup": return sicherungSpeichern();
    case "sicherung-jetzt": schliesseEbene(); return sicherungSpeichern().then(() => toast("Sicherung gespeichert – am besten in „Dateien“ aufheben"));
    case "sicherung-anmelden": return oeffneAbgleich("anmelden");
    case "sicherung-spaeter": schliesseEbene(); return toast("Sichern geht jederzeit unter „Mehr“");
    case "wiederherstellen": { const f = document.getElementById("backupFileInput"); if (f) f.click(); return; }
    case "feedback": return sendFeedback();
    case "qr": return oeffneQr();
    case "mitteilungen": return oeffneMitteilungen();       // 11.10.2026
    case "mitteilungen-ok": return mitteilungenOk();
    case "mitteilungen-zu": return schliesseEbene();
    case "mitteilungen-frage-ja": return mtFrageJa();
    case "mitteilungen-frage-nein": return schliesseEbene();
    case "sprache": { setLang(config.lang === "en" ? "de" : "en"); return renderMehr(); }
    case "verlauf": return openChangelogModal();
    case "zuruecksetzen": return zuruecksetzenMitAbgleich();   // angemeldet: vorher abmelden (09.10.2026)
    /* Geraete abgleichen (09.10.2026) */
    case "umzug-code": return umzugCodeKopieren(null, () => toast("Umzugs-Code kopiert – jetzt " + zielName() + " öffnen, als App hinzufügen und beim ersten Start „Daten einfügen“ tippen."));
    case "umzug-einfuegen": return umzugEinfuegen();
    case "er-anmelden": return erAnmelden();
    case "abgleich-anmelden": return oeffneAbgleich("anmelden");
    case "abgleich-modus": return oeffneAbgleich(t.dataset.amodus);
    case "abgleich-los": return abgleichLos();
    case "abgleich-vergessen": return abgleichVergessen();
    case "abgleich-abmelden": return abgleichAbmelden();
    case "abgleich-loeschen": return oeffneKontoLoeschen();
    case "abgleich-loeschen-ok": return abgleichLoeschenOk();
    /* Zeit */
    case "z-stempeln": return zeitStempeln();
    case "stempel-karte": return stempelKarteTipp();
    case "stempel-ja": return stempelJa();
    case "z-tag-speichern": return zeitTagSpeichern(false);
    case "z-tag-weiter": return zeitTagSpeichern(true);
    case "z-fuellen": return zeitFuellen();
    case "z-monat-drucken": zeitMonatKey(); return zeitMonatDrucken();
    case "z-jahr-drucken": return zeitJahrDrucken();
    case "z-export": zeitMonatKey(); return azExport();
    case "z-ablegen": zeitMonatKey(); return zeitOrdnerAblegen();
    /* Neue Ware zaehlen */
    case "w-plus": return kaeZaehlerPlus();
    case "w-plus10": return kaeZaehlerPlus(10);
    case "w-minus": return kaeZaehlerMinus();
    case "w-uebernehmen": kaeZaehlerUebernehmen(); schliesseEbene(); renderWare({ halteScroll: true }); return toast("Übernommen");
    case "w-neu": kaeNeu(); wareSprache = { text: "", ergebnis: null }; return renderWare({});
    case "w-sprache-uebernehmen": return wareSpracheUebernehmen();
    case "w-sprache-leeren": wareSprache = { text: "", ergebnis: null }; return renderWare({ halteScroll: true });
    case "w-fuehrung": return fuehrungStart("ware");
    /* Fahrzeug-Inventur - alles ueber die Live-Funktionen */
    case "i-drucken": return invDrucken();             // Original-Vordruck (#invBlatt)
    case "i-ansehen": return invZeigeErgebnis();
    case "i-speichern": return invSpeichern();
    case "i-abschliessen": return invAbschliessen();
    case "i-kopf": return kopfDialog();             // nach dem Speichern: Anschluss kopfUebernehmen unten
    case "i-neu": invNeueInventur(); invAnsicht = "erfassen"; invSprache = { text: "", ergebnis: null }; return renderInventur({});
    case "i-sprache-uebernehmen": return invSpracheUebernehmen();
    case "i-sprache-leeren": invSprache = { text: "", ergebnis: null }; return renderInventur({ halteScroll: true });
    case "i-fuehrung": return fuehrungStart("inventur");
    case "i-ordner": return oeffneInvOrdner();
    case "i-sig-einfuegen": { const f = document.getElementById("sigFile-inventur_signature"); if (f) f.click(); return; }
    case "i-sig-weg": clearSignature("inventur_signature"); return;   // frischt ueber renderSignatureTimestamp auf
  }
}

function klick(ev) {
  const t = ev.target.closest("button,[data-zu]"); if (!t) return;
  if (t.hasAttribute("data-zu")) return schliesseEbene();
  if (t.dataset.wzaehl) return oeffneZaehlwerk(t.dataset.wzaehl);
  if (t.dataset.iansicht) return invAnsichtWechseln(t.dataset.iansicht);
  /* Zeit */
  if (t.dataset.ztag) return oeffneZeitTag(t.dataset.ztag, t.dataset.zneu ? null : undefined);
  if (t.dataset.zeintrag !== undefined) return oeffneZeitTag(t.dataset.ztagiso, t.dataset.zeintrag || null);
  if (t.dataset.zloeschen) return zeitLoeschen(t.dataset.zloeschen, t.dataset.ztagiso);
  if (t.dataset.zbogen === "fuellen") return oeffneZeitFuellen();
  if (t.dataset.zbogen === "vorgaben") return oeffneZeitVorgaben();
  if (t.dataset.zbogen === "ordner") return oeffneZeitOrdner();
  if (t.dataset.zmonat) return zeitMonatWechseln(Number(t.dataset.zmonat));
  if (t.dataset.zjahr) {
    const j = zeitJahre(), i = j.indexOf(zeitJahrWahl) + Number(t.dataset.zjahr);
    if (i >= 0 && i < j.length) { zeitJahrWahl = j[i]; renderZeit({ halteScroll: true, auftritt: false }); }
    return;
  }
  if (t.dataset.ziel) {
    if (t.dataset.heute) { const h = new Date(); const { j, m } = gewaehlt(); if (j !== h.getFullYear() || m !== h.getMonth() + 1) monatSetzen(h.getFullYear(), h.getMonth() + 1); }
    return geheZu(t.dataset.ziel);
  }
  if (t.dataset.alt) return inAlteOberflaeche(t.dataset.alt);
  if (t.hasAttribute("data-zurueck")) return geheZu("start");
  if (t.dataset.nav) return geheZu(t.dataset.nav);
  if (t.dataset.tag) return oeffneTag(t.dataset.tag);
  if (t.dataset.utag) return oeffneTag(t.dataset.utag);
  if (t.dataset.bogen === "app") return oeffneApp();
  if (t.dataset.bogen === "zeiten") return oeffneZeiten();
  if (t.dataset.bogen === "stamm") return oeffneStamm();
  if (t.dataset.bogen === "einstellungen") return oeffneEinstellungen(t.dataset.teil);   // Teil: arbeitstag | nl | pauschalen
  if (t.dataset.bogen === "archiv") return oeffneArchiv();
  if (t.dataset.bogen === "anspruch") return oeffneAnspruch();
  if (t.dataset.os) return oeffneApp(t.dataset.os);
  if (t.dataset.design) return designUmschalten(t.dataset.design);
  if (t.dataset.bart) { bArt = t.dataset.bart; return artZeigen(); }
  if (t.dataset.srolle) { document.querySelectorAll("#rieb [data-srolle]").forEach((b) => b.classList.toggle("an", b === t)); return; }
  if (t.dataset.art) { t.parentElement.querySelectorAll(".art").forEach((b) => b.classList.toggle("an", b === t)); return; }
  if (t.dataset.rad) {
    const ziel = document.getElementById(t.dataset.rad);
    return openTimeWheel(ziel.dataset.wert || "", (neu) => {
      ziel.dataset.wert = neu || ""; ziel.textContent = neu || "--:--";
      if (ziel.dataset.spiegel) {
        const s = document.getElementById(ziel.dataset.spiegel);
        if (s) { s.value = neu || ""; s.dispatchEvent(new Event("input", { bubbles: true })); }
      }
      messen(); zeitenMessen();
    });
  }
  if (t.dataset.monat) return monatWechseln(Number(t.dataset.monat));
  if (t.dataset.ujahr) { urlaubJahr = (urlaubJahr || config.jahr) + Number(t.dataset.ujahr); return renderUrlaub(); }
  if (t.dataset.jjahr) {
    const { m } = gewaehlt(), alt = jahrInfos(config.jahr).reduce((s, x) => s + x.summe, 0);
    monatSetzen(config.jahr + Number(t.dataset.jjahr), m);
    renderJahr({ von: alt }); return;
  }
  if (t.dataset.pdf) return pdfAblageOeffnen(t.dataset.pdf, t.dataset.titel);
  if (t.dataset.monatwahl) { const [jj, mm] = t.dataset.monatwahl.split("-").map(Number); schliesseEbene(); monatSetzen(jj, mm); return geheZu("spesen", { erzwingen: true, ohneVT: true }); }
  if (t.dataset.voraus === "fuellen") return restDesMonatsFuellen();
  if (t.dataset.voraus === "zurueck") return vorausRueckgaengig();
  if (t.dataset.aktion) return aktion(t.dataset.aktion, t);
}

/* Unter "Mehr": Hell <-> Dunkel, mit sanfter Ueberblendung */
function designUmschalten(d) {
  if (d === (designGewaehlt() || "hell")) return;
  const tausch = () => { designSetzen(d); renderMehr(); };
  if (!vtDa() || reduziert()) { tausch(); }
  else {
    document.documentElement.dataset.vt = "design";
    const t = document.startViewTransition(tausch);
    t.finished.finally(() => delete document.documentElement.dataset.vt);
  }
  toast(d === "dunkel" ? "Design: Dunkel" : "Design: Hell");
}

/* ---------------- Toast ---------------- */
let toastZeit;
function toast(text) {
  const el = document.getElementById("toast"); if (!el) return;
  /* In der Einrichtung UEBER dem Knopf statt darauf (Mirko 10.10.2026:
     "hinweis über dem knopf nicht drauf") - CSS #toast.ueber-knopf */
  const er = document.getElementById("einrichtung");
  el.classList.toggle("ueber-knopf", !!er && !er.hidden);
  el.textContent = text; el.classList.add("zeigen");
  clearTimeout(toastZeit); toastZeit = setTimeout(() => el.classList.remove("zeigen"), 2400);
}

/* ---------------- Anschluss an die Live-Fassung ---------------- */
/* renderFormular() ruft das nach jeder Aenderung auf (index.html). */
window.riebNachRender = function () {
  if (stumm || !document.getElementById("rieb")) return;
  alleNeu();
};
/* zeigeTab() fragt hier, ob die neue Oberflaeche den Bereich uebernimmt. */
window.riebUebernimmt = function (tab) {
  if (zeigeTabAltLaeuft || !document.getElementById("rieb")) return false;
  if (EIGENE.indexOf(tab) > -1) { geheZu(tab, { erzwingen: true }); return true; }
  /* Ein Bereich der alten Oberflaeche (Inventur, Ware, Zeit): die neue tritt
     zur Seite. */
  aktuell = null; zeige(null); schliesseEbene();
  return false;
};
/* zeigeKachelStartseite() -> die neue Startseite */
window.riebStart = function () {
  if (zeigeTabAltLaeuft || !document.getElementById("rieb")) return;
  geheZu("start", { ohneAlt: true, erzwingen: aktuell !== "start" });
};
/* zeigeSpesenUnteransicht("stammdaten", feld) - z. B. aus sendPerEmail(),
   wenn Name oder Adresse fehlen: der Stammdaten-Bogen. */
window.riebStammdaten = function () {
  if (zeigeTabAltLaeuft || !document.getElementById("rieb")) return false;
  if (aktuell !== "spesen") geheZu("spesen", { erzwingen: true, ohneVT: true });
  oeffneStamm();
  return true;
};
/* Fahrzeug-Inventur: zwei Stellen der Live-Fassung melden sich hier - ohne
   Aenderung an index.html. Die Funktionen dort sind global und werden ueber
   ihren Namen aufgerufen, also greift auch die ergaenzte Fassung:
     kopfUebernehmen()           nach "Kopfdaten - Uebernehmen" (auch wenn das
                                 Fenster beim Oeffnen von selbst kam)
     renderSignatureTimestamp()  nach Unterschrift einfuegen / entfernen
   Die Live-Funktion laeuft immer zuerst und unveraendert. */
function anhaengen(name, nachher) {
  const vorher = window[name]; if (typeof vorher !== "function") return;
  window[name] = function () {
    const r = vorher.apply(this, arguments);
    try { nachher.apply(this, arguments); } catch (e) { console.error(e); }
    return r;
  };
}
/* Das Gegenstueck: eine Pruefung VOR der Live-Funktion. Sagt die Pruefung
   "nein", laeuft die Live-Funktion gar nicht. */
function vorschalten(name, darf) {
  const echt = window[name]; if (typeof echt !== "function") return;
  window[name] = function () {
    if (!darf.apply(this, arguments)) return;
    return echt.apply(this, arguments);
  };
}
/* „Rest des Monats mitfüllen“ und „rückgängig“ schrieben bis 09.10.2026 auch
   in einen ABGESCHLOSSENEN Monat - keine der beiden Live-Funktionen fragte
   tagGesperrt(). Seit Kollegen abschliessen (Entscheidung 22) und mitfuellen
   duerfen (13), haette das jeden getroffen: Monat abgeschlossen, PDF im
   Ordner - ein Tipp aendert ihn trotzdem. Gefunden in Teil C
   (sperre-app-pruefen.sh). Die Live-Funktionen bleiben unveraendert. */
const monatOffen = () => { const { j, m } = gewaehlt(); if (!localStorage.getItem(monthSubmittedKey(j, m))) return true; sperrHinweis(); return false; };
vorschalten("restDesMonatsFuellen", monatOffen);
vorschalten("vorausRueckgaengig", monatOffen);
anhaengen("kopfUebernehmen", () => { if (aktuell === "inventur" && !zeigeTabAltLaeuft) renderInventur({ halteScroll: true }); });
/* invAufgebaut: beim allerersten Aufbau ruft invAufbauen() selbst
   renderSignatureTimestamp() auf - dann nicht neu zeichnen (Endlosschleife) */
anhaengen("renderSignatureTimestamp", (key) => { if (key === "inventur_signature" && aktuell === "inventur" && invAufgebaut) renderInventur({ halteScroll: true }); });

/* ---------------- Ersteinrichtung ----------------
   Im Look des Entwurfs, mit den Schritten der Live-Fassung:
     alle         zuerst das Design: Hell oder Dunkel (Mirko 08.10.2026)
                  · Daten uebertragen oder neu starten (10.10.2026)
                  · Name · Adresse + NL · Rolle · Bundesland · Zeiten
                  · Urlaubstage im Jahr · Urlaub aus dem Vorjahr · schon
                  genommener Urlaub
   Die drei Urlaubsfragen bekommen seit 10.10.2026 ALLE (Entscheidung 53).
   Mirko: "urlaub haben doch eh alle mitarbeiter" - "es soll abgefragt werden
   wie viele urlaubstage im jahr haben sie? und die naechste abfrage dann,
   haben sie noch urlaubstage aus dem vorjahr mitgenommen? wenn ja wie viele,
   die werden dann beruecksichtigt" - "als drittes dann die abfrage hatten sie
   dieses jahr schon urlaub lassen". Bis dahin nur Mirko und Chef-Link; die
   Kollegen bekamen stillschweigend 30 Tage.
   Urlaubstage OHNE Vorgabe und Pflicht - Mirko: "keine vorgabe muss von jedem
   mitarbeiter eingetragen werden (selbst)". Ebenso die Vorjahres-Frage: erst
   Nein oder Ja tippen, dann geht es weiter.
   Gespeichert wird ueber einrichtungSpeichern() in index.html - derselbe
   Weg wie beim alten Assistenten.
   Die Zeiten-Felder starten LEER (Mirko 07.10.2026 nicht widersprochen):
   wer nur durchklickt, haette sonst Zeiten, die er nie eingetragen hat. */
let erSchritt = 0;
/* Nur die Design-Wahl (wer das Werkzeug schon eingerichtet hat, aber noch
   kein Design gewaehlt hat - einmal nach dem Update) */
let erNurDesign = false;
const ER = {};
function erZuruecksetzen() {
  Object.assign(ER, { design: designGewaehlt() || "", name: "", strasse: "", ort: "", nl: "", rolle: "fahrer", land: "HE", ab: "", an: "",
                      herkunft: "", anspruch: "", vorjahr: "", vorjahrTage: "", hatteUrlaub: false, urlaub: [], mitteilung: "" });
}
/* Zahl aus einem Feld - auch mit Komma ("27,5"). NaN, wenn leer. */
function erZahl(w) { const s = String(w == null ? "" : w).trim().replace(",", "."); return s === "" ? NaN : Number(s); }
/* Kleine Vorschau fuer die Design-Wahl: Kopf mit Zahl und Balken, darunter
   drei Zeilen - hell auf weissem Blatt oder dunkel auf Glas. */
function designBild(d) {
  return `<span class="mv ${d}" aria-hidden="true"><span class="mv-kopf"><i class="mv-titel"></i><i class="mv-zahl"></i><i class="mv-balken"></i></span>
    <span class="mv-blatt"><span class="mv-knoepfe"><i></i><i></i><i></i></span><i class="mv-zeile"></i><i class="mv-zeile"></i><i class="mv-zeile"></i></span></span>`;
}
function erSchrittListe() {
  if (erNurDesign) return ["design"];
  /* "mitteilungen" (11.10.2026, Mirko: "ja soll am besten auch abgefragt
     werden mitteilung aktivieren oder deaktivieren") nur, wo es geht - am
     iPhone im Safari-Tab nicht (Apple), dort faellt der Schritt weg (Mirko:
     "a wie du es sagst") */
  return ["design", "herkunft", "name", "adresse", "rolle", "land", "zeiten", "anspruch", "vorjahr", "urlaub"]
    .concat(mtMoeglich() === "ja" ? ["mitteilungen"] : [], ["fertig"]);
}
function erFeld(id, label, wert, ph, typ = "text") {
  return `<label class="er-feld"><span>${label}</span><input id="${id}" type="${typ}" value="${esc(wert)}" placeholder="${esc(ph)}" autocomplete="off"></label>`;
}
function erZeigen(richtung) {
  const liste = erSchrittListe(), art = liste[erSchritt], schritte = liste.length - 1;
  const inh = document.getElementById("erInhalt");
  const knopf = document.getElementById("erWeiter"), spaeter = document.getElementById("erSpaeter");
  const leiste = document.getElementById("erSchritte");
  leiste.style.gridTemplateColumns = `repeat(${Math.max(1, schritte)},1fr)`;
  leiste.innerHTML = erNurDesign ? "" : Array.from({ length: schritte }, (_, n) => `<i class="${n <= erSchritt ? "an" : ""}"></i>`).join("");
  document.getElementById("erZurueck").style.visibility = erSchritt > 0 && art !== "fertig" ? "visible" : "hidden";
  spaeter.hidden = art !== "zeiten";
  /* "Daten uebertragen" gewaehlt: der Knopf unten wird zu "Daten einfuegen" -
     an der gewohnten Stelle, immer sichtbar (ein zweiter Knopf im Inhalt lag
     am Handy halb unter dem Fuss) */
  const einfuegen = art === "herkunft" && ER.herkunft === "alt";
  knopf.textContent = erNurDesign ? "Übernehmen" : einfuegen ? "Daten einfügen" : art === "fertig" ? "Los geht’s" : liste[erSchritt + 1] === "fertig" ? "Fertig" : "Weiter";
  const innenD = ER.rolle === "monteur-innen";
  const land = Object.entries(BUNDESLAENDER).map(([k, v]) => `<option value="${k}" ${k === ER.land ? "selected" : ""}>${v}</option>`).join("");
  const vor = (ER.name || "").trim().split(/\s+/)[0];
  const S = {
    design: () => `<h2>${erNurDesign ? "Neu: Hell oder Dunkel." : "Willkommen."}<br>Wie soll es aussehen?</h2><p class="er-text">Sie können das jederzeit unter „Mehr“ ändern.</p>
      <div class="er-design">${[["hell", "Hell", "Weiße Flächen, dunkler Kopf"], ["dunkel", "Dunkel", "Alles dunkel – wie diese Seite"]].map(([d, t, u]) =>
        `<button class="er-dkarte ${ER.design === d ? "an" : ""}" data-edesign="${d}" aria-pressed="${ER.design === d}">${designBild(d)}<b>${t}</b><small>${u}</small></button>`).join("")}</div>
`,
    /* Seit 10.10.2026 eine eigene Frage statt der kleinen Zeile "Schon Rieb
       Spesen benutzt? Daten einfuegen · Mit Konto anmelden" unter der
       Design-Wahl. Mirko: "da muss eine abfrage kommen? wollen sie ihre daten
       aus der alten fassung mit uebertragen oder neu starten? ... wichtig ist
       nur das der nutzer auch weis was er machen muss". "Daten uebertragen"
       zeigt die drei Handgriffe, der Knopf unten heisst dann "Daten
       einfuegen" - wer es gerade nicht kann, tippt "Neu starten". Der
       Einleitungssatz faellt dann weg, damit alles ohne Scrollen passt. */
    herkunft: () => `<h2>Wollen Sie Ihre Daten aus der alten Fassung übertragen oder neu starten?</h2>${ER.herkunft === "alt" ? "" : `<p class="er-text">Wer Rieb Spesen schon benutzt hat, nimmt seine Einträge mit – nichts muss neu eingetragen werden.</p>`}
      <button class="er-rolle ${ER.herkunft === "alt" ? "an" : ""}" data-eherkunft="alt"><span class="r-ic">${ic("laden")}</span><span><b>Daten übertragen</b><small>Ich habe Rieb Spesen schon benutzt</small></span></button>
      <button class="er-rolle ${ER.herkunft === "neu" ? "an" : ""}" data-eherkunft="neu"><span class="r-ic">${ic("plus")}</span><span><b>Neu starten</b><small>Ich benutze Rieb Spesen zum ersten Mal</small></span></button>
      ${ER.herkunft === "alt" ? `<ol class="er-anleitung">
        <li><b>Alte Fassung öffnen</b><span>So wie bisher – über Ihr App-Symbol oder Ihr Lesezeichen</span></li>
        <li><b>Dort „Umzugs-Code kopieren“ tippen</b><span>Steht im Brief „Wichtig für Ihre Spesen“ und unter „Mehr“</span></li>
        <li><b>Hierher zurück und unten „Daten einfügen“ tippen</b><span>Danach sind alle Ihre Einträge da</span></li>
      </ol>
      <div class="er-schon"><span>Sie nutzen „Geräte abgleichen“ mit einem Konto?</span><button type="button" data-aktion="er-anmelden">Mit Konto anmelden</button></div>` : ""}`,
    name: () => `<h2>Wie heißen Sie?</h2><p class="er-text">Ihr Name steht später auf Ihrem Spesennachweis.</p>${erFeld("eName", "Vor- und Nachname", ER.name, "Max Mustermann")}`,
    adresse: () => `<h2>Wo wohnen Sie?</h2><p class="er-text">Für die Kopfzeile des Nachweises – und Ihre Niederlassung.</p>${erFeld("eStrasse", "Straße und Hausnummer", ER.strasse, "Musterstraße 1")}${erFeld("eOrt", "Ort", ER.ort, "Musterstadt")}${erFeld("eNl", "Niederlassung", ER.nl, "z. B. Lollar")}`,
    rolle: () => `<h2>Als was arbeiten Sie?</h2><p class="er-text">Davon hängt ab, welche Zeiten der Nachweis zeigt.</p>${Object.entries(ROLLEN).map(([k, [t, u]]) => `<button class="er-rolle ${ER.rolle === k ? "an" : ""}" data-erolle="${k}"><span class="r-ic">${ic(ROLLEN_IC[k])}</span><span><b>${t}</b><small>${u}</small></span></button>`).join("")}`,
    land: () => `<h2>In welchem Bundesland?</h2><p class="er-text">Damit die Feiertage automatisch richtig stehen.</p><label class="er-feld"><span>Bundesland</span><select id="eLand">${land}</select></label>`,
    zeiten: () => `<h2>Ihre üblichen Zeiten</h2><p class="er-text">Einmal eintragen – sie gelten dann automatisch für jeden Werktag. Abweichende Tage ändern Sie später mit einem Tipp.</p><div class="er-zeiten">${erFeld("eAb", innenD ? "Anwesenheit NL Beginn" : "Abfahrt WP", ER.ab, "", "time")}${erFeld("eAn", innenD ? "Anwesenheit NL Ende" : "Ankunft WP", ER.an, "", "time")}</div>`,
    anspruch: () => `<h2>Wie viele Urlaubstage im Jahr haben Sie?</h2><p class="er-text">Manche haben 30, manche 28 – tragen Sie ein, was für Sie gilt. Änderbar bleibt es jederzeit unter „Urlaub“.</p>${erFeld("eAnspruch", "Urlaubstage pro Jahr", ER.anspruch, "", "number")}`,
    vorjahr: () => `<h2>Haben Sie noch Urlaubstage aus dem Vorjahr mitgenommen?</h2><p class="er-text">Die Tage aus ${new Date().getFullYear() - 1} werden zu Ihren Urlaubstagen ${new Date().getFullYear()} dazugerechnet.</p>
      <div class="er-wahl"><button class="er-rolle ${ER.vorjahr === "nein" ? "an" : ""}" data-evorjahr="nein"><span><b>Nein</b></span></button><button class="er-rolle ${ER.vorjahr === "ja" ? "an" : ""}" data-evorjahr="ja"><span><b>Ja</b></span></button></div>
      ${ER.vorjahr === "ja" ? `<div style="margin-top:12px">${erFeld("eVorjahr", "Wie viele Tage?", ER.vorjahrTage, "", "number")}</div>` : ""}`,
    urlaub: () => `<h2>Hatten Sie dieses Jahr schon Urlaub?</h2><p class="er-text">An Urlaubstagen entsteht keine Pauschale. Fehlt der Urlaub, wird der Nachweis zu hoch.</p>
      <div class="er-wahl"><button class="er-rolle ${!ER.hatteUrlaub ? "an" : ""}" data-eurlaub="nein"><span><b>Nein</b></span></button><button class="er-rolle ${ER.hatteUrlaub ? "an" : ""}" data-eurlaub="ja"><span><b>Ja</b></span></button></div>
      ${ER.hatteUrlaub ? ER.urlaub.map((z, i) => `<div class="er-zeiten" style="margin-top:12px">${erFeld("eUv" + i, "Von" + (i ? " (" + (i + 1) + ")" : ""), z.von, "", "date")}${erFeld("eUb" + i, "Bis" + (i ? " (" + (i + 1) + ")" : ""), z.bis, "", "date")}</div>`).join("")
        + `<button class="er-spaeter" data-ezeitraum>+ Weiterer Zeitraum</button>` : ""}`,
    mitteilungen: () => `<h2>Mitteilungen aktivieren?</h2><p class="er-text">Rieb Spesen erinnert Sie an die Abgabe bis zum 3.&nbsp;Werktag – und an den anderen Tagen kommt der Spruch des Tages. An Arbeitstagen um ${MT_STUNDE.arbeit} Uhr, am Wochenende und an Feiertagen um ${MT_STUNDE.frei} Uhr. Änderbar jederzeit unter „Mehr“.</p>
      <div class="er-wahl"><button class="er-rolle ${ER.mitteilung === "ja" ? "an" : ""}" data-emitteilung="ja"><span><b>Aktivieren</b></span></button><button class="er-rolle ${ER.mitteilung === "nein" ? "an" : ""}" data-emitteilung="nein"><span><b>Nicht aktivieren</b></span></button></div>`,
    fertig: () => `<div class="er-fertig"><svg class="er-haken" viewBox="0 0 100 100" fill="none" stroke="url(#riebS)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"><circle cx="50" cy="50" r="45"/><path d="M31 51l13 13 26-28"/></svg><h2>Alles bereit${vor ? ", " + esc(vor) : ""}.</h2><p class="er-text">${ER.ab && ER.an ? "Ihr Monat läuft ab jetzt automatisch mit.<br>Ausdrucken, unterschreiben, abgeben – fertig." : "Tragen Sie unter „Spesen“ einmal Ihre üblichen Zeiten ein – dann läuft jeder Tag automatisch mit."}</p></div>`,
  };
  inh.innerHTML = S[art]();
  inh.classList.remove("er-rein", "er-zurueck-rein"); void inh.offsetWidth;
  inh.classList.add(richtung === "zurueck" ? "er-zurueck-rein" : "er-rein");
  const erstes = inh.querySelector("input"); if (erstes && matchMedia("(hover:hover)").matches) erstes.focus({ preventScroll: true });
}
function erLesen() {
  const v = (id) => { const e = document.getElementById(id); return e ? e.value : null; };
  const art = erSchrittListe()[erSchritt];
  if (art === "name") ER.name = v("eName");
  if (art === "adresse") { ER.strasse = v("eStrasse"); ER.ort = v("eOrt"); ER.nl = v("eNl"); }
  if (art === "land") ER.land = v("eLand");
  if (art === "zeiten") { ER.ab = v("eAb") || ""; ER.an = v("eAn") || ""; }
  if (art === "anspruch") ER.anspruch = v("eAnspruch");
  if (art === "vorjahr" && v("eVorjahr") !== null) ER.vorjahrTage = v("eVorjahr");
  if (art === "urlaub") ER.urlaub = ER.urlaub.map((z, i) => ({ von: v("eUv" + i) || "", bis: v("eUb" + i) || "" }));
}
function erWeiter(spaeter) {
  erLesen();
  const liste = erSchrittListe(), art = liste[erSchritt];
  if (art === "design") {
    if (!ER.design) { toast("Bitte Hell oder Dunkel wählen"); return; }
    designSetzen(ER.design);
    if (erNurDesign) { designWahlEnde(); return; }
  }
  if (art === "zeiten") {
    if (spaeter) { ER.ab = ""; ER.an = ""; }
    else if (!!ER.ab !== !!ER.an) { toast("Bitte beide Zeiten eintragen – oder „Später eintragen“"); return; }
  }
  if (art === "herkunft" && ER.herkunft === "alt") { umzugEinfuegen(); return; }   // Knopf heisst dann "Daten einfuegen"
  if (art === "herkunft" && ER.herkunft !== "neu") { toast("Bitte „Daten übertragen“ oder „Neu starten“ wählen"); return; }
  /* Urlaubstage: Pflicht, keine Vorgabe (Mirko 10.10.2026) */
  if (art === "anspruch" && !(erZahl(ER.anspruch) > 0)) { toast("Bitte tragen Sie ein, wie viele Urlaubstage Sie im Jahr haben"); return; }
  if (art === "vorjahr") {
    if (!ER.vorjahr) { toast("Bitte „Nein“ oder „Ja“ wählen"); return; }
    if (ER.vorjahr === "ja" && !(erZahl(ER.vorjahrTage) > 0)) { toast("Bitte eintragen, wie viele Tage Sie mitgenommen haben"); return; }
  }
  /* Schon genommener Urlaub: "Ja" ohne Datum ging bis 10.10.2026 still
     verloren - und ein einzelner Tag (nur Von) ebenso, weil
     urlaubZeitraeumeEintragen() Von UND Bis verlangt. Jetzt: Von reicht
     fuer einen Tag (wie bei "Abwesenheit eintragen"), ohne Von kein Weiter. */
  if (art === "urlaub" && ER.hatteUrlaub && !ER.urlaub.some((z) => z.von)) { toast("Bitte das Von-Datum eintragen – oder „Nein“ wählen"); return; }
  if (art === "mitteilungen" && !ER.mitteilung) { toast("Bitte „Aktivieren“ oder „Nicht aktivieren“ wählen"); return; }
  if (art !== "fertig") { erSchritt++; erZeigen("vor"); return; }
  /* Fertig: speichern ueber denselben Weg wie der alte Assistent */
  const meldung = einrichtungSpeichern({
    name: ER.name, strasse: ER.strasse, ort: ER.ort, niederlassung: ER.nl, typ: ER.rolle, bundesland: ER.land,
    zeitVon: ER.ab, zeitBis: ER.an, anspruch: erZahl(ER.anspruch),
    uebertrag: ER.vorjahr === "ja" ? erZahl(ER.vorjahrTage) : 0,
    urlaub: ER.hatteUrlaub ? ER.urlaub.filter((z) => z.von).map((z) => ({ von: z.von, bis: z.bis || z.von })) : [],
  });
  if (typeof closeModal === "function") closeModal();
  /* Mitteilungen: jetzt einschalten - die Einrichtung ist gespeichert (Name
     fuer den Titel), und "Los geht's" ist ein Tipp (iPhone verlangt einen) */
  if (erSchrittListe().includes("mitteilungen")) mtNachEinrichtung(ER.mitteilung === "ja");
  initSettingsUI(); updateMitarbeitertypUI(); renderFormular(); aktualisiereZeitSichtbarkeit();
  const er = document.getElementById("einrichtung");
  const ende = () => { er.hidden = true; aktuell = null; geheZu("start", { ohneVT: true }); if (meldung) toast(meldung); rollenLos(document.getElementById("s-start")); };
  if (!vtDa() || reduziert()) { ende(); return; }
  document.documentElement.dataset.vt = "zu";
  const t = document.startViewTransition(ende);
  t.finished.finally(() => delete document.documentElement.dataset.vt);
}
function einrichtungStarten() {
  schliesseEbene();
  if (typeof closeModal === "function") closeModal();   // den alten Assistenten, falls er schon offen ist
  const intro = document.getElementById("intro"); if (intro) intro.remove();
  erNurDesign = false; erSchritt = 0; erZuruecksetzen();
  const er = document.getElementById("einrichtung");
  er.hidden = false; erZeigen("vor");
}
/* Schon eingerichtet, aber noch kein Design gewaehlt: nur diese eine Frage,
   bevor irgendetwas anderes geht. Danach die Startseite. */
function designWahlStarten() {
  schliesseEbene();
  const intro = document.getElementById("intro"); if (intro) intro.remove();
  erNurDesign = true; erSchritt = 0; erZuruecksetzen(); ER.design = "";
  const er = document.getElementById("einrichtung");
  er.hidden = false; erZeigen("vor");
}
function designWahlEnde() {
  const er = document.getElementById("einrichtung");
  /* Danach der Brief an die Kollegen (nach der Design-Wahl, Mirko 08./09.10.) */
  const ende = () => { er.hidden = true; erNurDesign = false; rollenLos(document.getElementById("s-start")); setTimeout(nachDemEinstieg, 450); };
  if (!vtDa() || reduziert()) { ende(); return; }
  document.documentElement.dataset.vt = "zu";
  const t = document.startViewTransition(ende);
  t.finished.finally(() => delete document.documentElement.dataset.vt);
}
/* maybeShowSetupWizard() fragt hier (index.html) */
window.riebEinrichtung = function () {
  if (!document.getElementById("einrichtung")) return false;
  einrichtungStarten(); return true;
};

/* ---------------- Einstieg: "Tafel + Durchflug" ----------------
   Seit 09.10.2026 (Mirko: "erst zwei und dann der uebergang mit 3
   kombiniert ... genug zeit zum lesen aber nicht zu lange", dazu "dass das
   s dann auch blau ist bzw wird"; freigegeben "das passt so"). Entwurf:
   Neues Design/start-entwurf/animation.html?v=4.
     0 - 0,95 s   Fallblaetter klappen durch bis RIEB SPESEN, darunter
                  Wochentag, Datum, Uhrzeit (echte Werte)
     bis 2,05 s   alles steht ruhig zum Lesen; Lichtwelle, das S in der
                  Mitte (erstes S von SPESEN) blendet in das Logo-Blau
     ab 1,4 s     Sternenflug setzt leise ein
     2,05-2,7 s   Flug durch dieses S (das Blatt flutet blau), dann die
                  Startseite; ihre Ziffern rollen, sobald sie sichtbar wird
   Ein Tipp ueberspringt. Bei "Bewegung reduzieren" kein Einstieg.
   Danach ggf. der Brief an die Kollegen (briefZeigen).
   Vorher (08.10.2026): R taucht auf, S zeichnet sich, Gleiten in den Kopf. */
function einstieg() {
  const startRollen = () => rollenLos(document.getElementById("s-start"));
  if (reduziert()) { startRollen(); nachDemEinstieg(); return; }
  const intro = document.createElement("div");
  intro.id = "intro"; intro.className = "tafel-intro"; intro.setAttribute("aria-hidden", "true");
  document.getElementById("rieb").appendChild(intro);
  const anfangen = () => tafelEinstieg(intro, startRollen);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(anfangen); else anfangen();
}
function tafelEinstieg(intro, startRollen) {
  const WTK = ["SO", "MO", "DI", "MI", "DO", "FR", "SA"], MON_G = ["JAN", "FEB", "MÄR", "APR", "MAI", "JUN", "JUL", "AUG", "SEP", "OKT", "NOV", "DEZ"];
  const h = new Date();
  const zeile1 = "RIEB SPESEN", zeile2 = `${WTK[h.getDay()]} ${zwei(h.getDate())} ${MON_G[h.getMonth()]}  ${zwei(h.getHours())}:${zwei(h.getMinutes())}`;
  const platz = innerWidth - 36, klein = innerWidth < 760;
  const kb1 = Math.min(66, (platz - 10 * 5) / 11), kb2 = Math.min(30, (platz - (zeile2.length - 1) * 3) / zeile2.length);
  const reihe = (t, kb, gap, k) => `<div class="fb-reihe${k ? " klein" : ""}" style="--kb:${kb}px;--kh:${kb * 1.42}px;--lg:${gap}px">${[...t].map((c) => `<div class="fb" data-z="${c}"></div>`).join("")}</div>`;
  intro.innerHTML = `<canvas class="sterne"></canvas><div class="fb-tafel">${reihe(zeile1, kb1, 5)}${reihe(zeile2, kb2, 3, true)}</div>`;
  const tafel = intro.querySelector(".fb-tafel"), leinwand = intro.querySelector("canvas"), ctx = leinwand.getContext("2d");
  const dpr = devicePixelRatio || 1; leinwand.width = innerWidth * dpr; leinwand.height = innerHeight * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const ZEICHEN = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const kacheln = [...intro.querySelectorAll(".fb")].map((el) => {
    const reiheNr = el.parentElement.classList.contains("klein") ? 1 : 0, idx = [...el.parentElement.children].indexOf(el);
    return { el, z: el.dataset.z, stopp: (reiheNr ? .55 : .32) + idx * (reiheNr ? .022 : .045) + Math.random() * .06, naechst: 0, reiheNr, idx };
  });
  const sKachel = kacheln.find((k) => !k.reiheNr && k.idx === 5);   // das erste S von SPESEN, genau in der Mitte
  /* fill "forwards" fuer alles, was spaeter beginnt: mit "both" hielte eine
     spaetere Animation ihren Anfang schon waehrend der Wartezeit fest (im
     Entwurf am 09.10. gesehen) */
  const ani = (el, kf, opt) => el.animate(kf, Object.assign({ fill: "forwards", easing: "cubic-bezier(.22,1,.36,1)" }, opt));
  kacheln.forEach((k) => ani(k.el, [{ opacity: 0, transform: "translateY(10px) scale(.96)" }, { opacity: 1, transform: "none" }], { delay: (k.reiheNr ? 100 : 0) + k.idx * 15, duration: 340, fill: "both" }));
  const klappen = (k) => k.el.animate([{ transform: "rotateX(0)" }, { transform: "rotateX(-80deg)", offset: .5 }, { transform: "rotateX(0)" }], { duration: 85, easing: "linear" });
  const sterne = Array.from({ length: klein ? 110 : 190 }, () => ({ w: Math.random() * Math.PI * 2, d: Math.random() * 40 + 6, v: Math.random() * .8 + .4 }));
  const T0 = performance.now();
  let welle = false, flug = false, fertig = false, gerollt = false, raf = 0;
  const rollen = () => { if (!gerollt) { gerollt = true; startRollen(); } };
  const ende = (sprung) => {
    if (fertig) return; fertig = true; cancelAnimationFrame(raf); rollen();
    intro.style.pointerEvents = "none";
    intro.animate([{ opacity: getComputedStyle(intro).opacity }, { opacity: 0 }], { duration: sprung ? 220 : 120, fill: "forwards" })
      .finished.then(() => { intro.remove(); nachDemEinstieg(); });
  };
  intro.addEventListener("click", () => ende(true));
  const bild = () => {
    const t = (performance.now() - T0) / 1000;
    kacheln.forEach((k) => {
      if (k.fest) return;
      if (t >= k.stopp) { k.fest = true;
        if (k === sKachel) k.el.innerHTML = `<i class="fb-flaeche"></i><span class="fb-stapel"><span class="fb-weiss">S</span><span class="fb-blau">S</span></span>`;
        else k.el.textContent = k.z === " " ? "" : k.z;
        klappen(k); return; }
      if (t >= k.naechst && t > .05) { k.el.textContent = k.z === " " ? "" : ZEICHEN[Math.floor(Math.random() * ZEICHEN.length)]; k.naechst = t + .06; klappen(k); }
    });
    /* Sternenflug: ab 1,4 s leise, beim Durchflug schnell */
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    if (t > 1.4) {
      const sicht = Math.min(1, (t - 1.4) / .5), schub = t < 2.05 ? .35 : .35 + Math.pow(t - 2.05, 2) * 14;
      const r = sKachel.el.getBoundingClientRect(), cx = flug ? innerWidth / 2 : r.left + r.width / 2, cy = flug ? innerHeight / 2 : r.top + r.height / 2;
      sterne.forEach((s) => { const d0 = s.d; s.d *= 1 + .018 * s.v * schub * 3; if (s.d > Math.hypot(innerWidth, innerHeight)) { s.d = Math.random() * 30 + 6; return; }
        const a = Math.min(1, s.d / 160) * sicht;
        ctx.strokeStyle = `rgba(${170 + 60 * s.v},225,255,${a * .8})`; ctx.lineWidth = .6 + a * 1.4 * s.v;
        ctx.beginPath(); ctx.moveTo(cx + Math.cos(s.w) * d0, cy + Math.sin(s.w) * d0); ctx.lineTo(cx + Math.cos(s.w) * s.d, cy + Math.sin(s.w) * s.d); ctx.stroke(); });
    }
    if (!welle && t > 1.0) { welle = true;
      kacheln.filter((k) => !k.reiheNr && k !== sKachel).forEach((k) => ani(k.el, [{ color: "#F2F4F7", textShadow: "0 0 0 rgba(56,189,248,0)" },
        { color: "#E6F6FF", textShadow: "0 0 18px rgba(56,189,248,.95)", offset: .4 }, { color: "#F2F4F7", textShadow: "0 0 6px rgba(56,189,248,.3)" }],
        { delay: k.idx * 30, duration: 520, easing: "ease-out" }));
      /* Das S wird logo-blau und bleibt an: das Tor fuer den Durchflug */
      const d = 5 * 30 + 120;
      ani(sKachel.el, [{ boxShadow: "inset 0 0 0 1px rgba(255,255,255,.07),0 8px 22px rgba(0,0,0,.45)" }, { boxShadow: "inset 0 0 0 1.5px rgba(125,211,252,.85),0 0 34px rgba(56,189,248,.55)" }], { delay: d, duration: 520, easing: "ease-out" });
      ani(sKachel.el.querySelector(".fb-blau"), [{ opacity: 0 }, { opacity: 1 }], { delay: d, duration: 520, easing: "ease-out" });
      ani(sKachel.el.querySelector(".fb-weiss"), [{ opacity: 1 }, { opacity: 0 }], { delay: d, duration: 520, easing: "ease-out" }); }
    if (!flug && t > 2.05) { flug = true;
      const tr = tafel.getBoundingClientRect(), sr = sKachel.el.getBoundingClientRect();
      tafel.style.transformOrigin = `${sr.left + sr.width / 2 - tr.left}px ${sr.top + sr.height / 2 - tr.top}px`;
      sKachel.el.classList.add("tor");
      /* weich blau fluten, das S wird hell und bleibt als Tor sichtbar */
      ani(sKachel.el.querySelector(".fb-flaeche"), [{ opacity: 0 }, { opacity: 1 }], { duration: 320, easing: "ease-in" });
      ani(sKachel.el.querySelector(".fb-weiss"), [{ opacity: 0 }, { opacity: 1 }], { duration: 260, easing: "ease-in" });
      ani(sKachel.el.querySelector(".fb-blau"), [{ opacity: 1 }, { opacity: 0 }], { duration: 260, easing: "ease-in" });
      ani(tafel, [{ transform: "scale(1)" }, { transform: "scale(46)" }], { duration: 650, easing: "cubic-bezier(.7,0,.84,0)" });
      ani(intro, [{ opacity: 1 }, { opacity: 0 }], { delay: 450, duration: 400, easing: "ease-in-out" });
      setTimeout(rollen, 450); }                       // die Startseite wird sichtbar - ihre Ziffern rollen
    if (t > 2.95) { ende(false); return; }
    raf = requestAnimationFrame(bild);
  };
  raf = requestAnimationFrame(bild);
}

/* ---------------- Brief an die Kollegen ----------------
   Mirko 09.10.2026: "bei den kollegen ein brief direkt bei naechster oeffnung
   aufploppen lassen" - Inhalt: "besprochen mit den vorgesetzten darf genutzt
   werden das spesen tool, aber es muss selbst gedruckt werden und
   handschriftlich unterschrieben werden. neues design, selbe funktionen,
   seite zieht um". Die Firma wird NICHT genannt. Inventur/Abrechnung: "das muss
   aber niemand wissen". Entwurf: Neues Design/start-entwurf/brief.html.
   Einmal je Geraet, nur Kollegen (nicht Mirko/Chef), nur wer das Werkzeug
   schon benutzt hat (los(): bei der Ersteinrichtung gilt er als gelesen).
   Kommt NACH der Design-Wahl ("das waehlen sie aus bevor sie irgendwas
   anderes auswaehlen") und nach dem Einstieg. */
const BRIEF_KEY = "rieb_brief_umzug";
function briefFaellig() { return !zeigtNeuerungen() && !localStorage.getItem(BRIEF_KEY) && localStorage.getItem("spesen_config") !== null; }

/* ---------------- Umzug mit einem Klick ----------------
   Mirko 09.10.2026: "der neue link muss am besten auswaehlbar im brief
   angezeigt werden sodass man quasi direkt umziehen kann mit einem klick".
   Ein blosser Link reicht nicht: Der Browser speichert JE ADRESSE - wer nur
   hinueberklickt, kaeme an der neuen Adresse mit einem leeren Werkzeug an.
   Darum nimmt der Klick die Daten mit:
     alte Adresse  alle Eintraege dieses Geraets (localStorage) einpacken,
                   gzip, im Teil HINTER dem # an die neue Adresse haengen. Der
                   Teil hinter # wird nie an einen Server geschickt - die
                   Daten bleiben auf dem Geraet.
     neue Adresse  umzugAnkunft(): sofort aus Adresszeile und Verlauf nehmen,
                   auspacken, uebernehmen, neu laden. Hat das Geraet dort schon
                   eigene Spesendaten (Einstellung MIT Namen), wird gefragt -
                   nichts wird stillschweigend ueberschrieben.
   ⚠ Nicht mit: die abgelegten PDFs im Ordner (IndexedDB) - zu gross fuer
   die Adresse. ⚠ Installierte App am iPhone: ob die Daten nach dem Umzug in
   der NEU installierten App ankommen, ist am echten Geraet zu pruefen.
   ⚠ Voraussetzung Teil D: Unter der alten Adresse muss diese Fassung laufen,
   sonst gibt es dort keinen Brief und keinen Knopf.
   Fuer Pruefungen laesst sich das Ziel ueber window.RIEB_UMZUG_ZIEL setzen. */
const UMZUG_ZIEL = window.RIEB_UMZUG_ZIEL || "https://rieb-spesen.de/";
/* Mirko 10.10.2026: "ende oktober noch anfang november muss die neue seite
   genutzt werden - datum in brief schreiben, ja". Steht im Brief der alten
   Adresse; danach wird die alte Adresse abgeschaltet (Entscheidung 51). */
const UMZUG_FRIST = "31.10.2026";
function amZiel() { try { return location.origin === new URL(UMZUG_ZIEL, location.href).origin; } catch (e) { return false; } }
const zielName = () => { try { return new URL(UMZUG_ZIEL, location.href).hostname; } catch (e) { return "rieb-spesen.de"; } };

/* QR-Code unter "Mehr" (10.10.2026) - im neuen Aussehen statt des alten
   Fensters (Emoji, Code im frueheren Firmen-Braun #370F06). Zeigt IMMER auf die neue
   Adresse: Das alte Fenster nahm die Adresse, unter der man gerade war - wer
   ihn unter der alten Adresse oeffnete und am Schwarzen Brett aushing,
   haette ab dem 01.11.2026 (alte Adresse vom Netz) ins Leere verwiesen. */
function oeffneQr() {
  const ziel = new URL(UMZUG_ZIEL, location.href).href, name = zielName();
  oeffneEbene(`${bogenKopf("Zum Weitergeben an Kollegen", "QR-Code")}
    <div class="qr-feld" id="qrFeld" role="img" aria-label="QR-Code für ${esc(name)}" data-ziel="${esc(ziel)}"></div>
    <div class="qr-adresse">${esc(name)}</div>
    <p class="klein-text" style="text-align:center">Mit der Handy-Kamera scannen – Rieb Spesen öffnet sich direkt. Gut zum Aushängen am Schwarzen Brett.</p>`);
  try {
    new QRCode(document.getElementById("qrFeld"), { text: ziel, width: 220, height: 220, colorDark: "#0E1116", colorLight: "#ffffff", correctLevel: QRCode.CorrectLevel.M });
  } catch (e) { document.getElementById("qrFeld").textContent = name; }
}
function b64url(bytes) { let s = ""; for (let i = 0; i < bytes.length; i += 8192) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
function aus64url(t) { const s = atob(t.replace(/-/g, "+").replace(/_/g, "/")); const b = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i); return b; }
async function packen(text) {
  if (typeof CompressionStream === "function") {
    const strom = new Blob([text]).stream().pipeThrough(new CompressionStream("gzip"));
    return "z" + b64url(new Uint8Array(await new Response(strom).arrayBuffer()));
  }
  return "t" + b64url(new TextEncoder().encode(text));
}
async function auspacken(p) {
  const bytes = aus64url(p.slice(1));
  if (p[0] === "z") return new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"))).text();
  return new TextDecoder().decode(bytes);
}
/* Laeuft unter der neuen Adresse wirklich Rieb Spesen? Erst dann gehen Daten
   hin. Solange dort z. B. noch die IONOS-Parkseite steht, koennten deren
   Skripte den Teil hinter # lesen. Gefragt wird nur die Versionsdatei (ohne
   Daten); GitHub Pages liefert sie mit "access-control-allow-origin: *"
   (an der Live-Seite nachgesehen, 09.10.2026). */
async function zielBereit() {
  try { const r = await fetch(new URL("version.txt", UMZUG_ZIEL), { cache: "no-store" }); return r.ok && /^\d{4}-\d\d-\d\d/.test((await r.text()).trim()); }
  catch (e) { return false; }
}
/* true = die Seite geht gleich zur neuen Adresse; false = hat nicht geklappt
   (der Brief schliesst dann fuer dieses Mal, siehe briefZeigen) */
let umzugLaeuft = false;
async function umziehen() {
  if (umzugLaeuft) return true; umzugLaeuft = true;
  try { return await umziehenJetzt(); } finally { umzugLaeuft = false; }
}
/* Alle Eintraege dieses Geraets als ein Paket - fuer "Jetzt umziehen" UND fuer
   den Umzugs-Code (10.10.2026), damit beide Wege genau dieselben Daten tragen. */
async function umzugPaket() {
  const daten = {};
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); daten[k] = localStorage.getItem(k); }
  daten[BRIEF_KEY] = "umgezogen";                  // an der neuen Adresse kein Brief mehr
  try { return await packen(JSON.stringify({ v: 1, von: location.origin, zeit: Date.now(), daten })); } catch (e) { return ""; }
}
async function umziehenJetzt() {
  if (!(await zielBereit())) {
    alert(navigator.onLine === false
      ? "Gerade keine Internetverbindung – der Umzug braucht kurz Internet.\n\nSie können jetzt normal weiterarbeiten. Beim nächsten Öffnen mit Internet geht es mit einem Klick."
      : "Die neue Adresse " + zielName() + " ist noch nicht bereit.\n\nSie können jetzt normal weiterarbeiten – an Ihren Einträgen ändert sich nichts. Beim nächsten Öffnen kommt der Umzug wieder.");
    return false;
  }
  const paket = await umzugPaket();
  if (!paket || paket.length > 1500000) {
    alert("Der Umzug mit einem Klick geht auf diesem Gerät leider nicht.\n\nSo geht es trotzdem: unter „Mehr“ → „Backup als Datei speichern“, dann " + zielName() + " öffnen und dort „Backup wiederherstellen“.");
    return false;
  }
  localStorage.setItem("rieb_umgezogen", new Date().toISOString());
  location.href = UMZUG_ZIEL.replace(/#.*$/, "") + "#umzug=" + paket;
  return true;
}
/* Ankunft an der neuen Adresse - laeuft VOR allem anderen (starten). true =
   die Seite laedt gleich neu, sonst nichts tun. */
function umzugAnkunft() {
  const m = /^#umzug=(.+)$/.exec(location.hash || ""); if (!m) return false;
  history.replaceState(null, "", location.pathname + location.search);   // Daten sofort aus Adresszeile und Verlauf
  umzugUebernehmen(m[1]);
  return true;
}
/* Ein Paket uebernehmen und neu laden - fuer die Ankunft per Adresse UND fuer
   "Daten einfuegen" mit dem Umzugs-Code. Dieselbe Rueckfrage, wenn das Geraet
   hier schon eigene Spesendaten hat; dieselbe Meldung danach. */
function umzugUebernehmen(paket) {
  return auspacken(paket).then((text) => {
    const daten = (JSON.parse(text) || {}).daten || {};
    if (!daten.spesen_config) throw new Error("ohne Einstellungen");
    let dortName = "";
    try { dortName = ((JSON.parse(localStorage.getItem("spesen_config") || "null") || {}).name || "").trim(); } catch (e) { dortName = ""; }
    if (dortName && localStorage.getItem("spesen_config") !== daten.spesen_config
        && !confirm("Auf diesem Gerät gibt es unter " + location.hostname + " schon Spesendaten (" + dortName + ").\n\nSollen sie durch die Daten von der alten Adresse ersetzt werden?")) { location.reload(); return; }
    // Pakete der alten Fassung tragen noch die alten Speichernamen (index.html: speichernamenNeu)
    Object.entries(speichernamenNeu(daten)).forEach(([k, v]) => { try { localStorage.setItem(k, v); } catch (e) { /* voll - der Rest kommt trotzdem */ } });
    sessionStorage.setItem("rieb_umzug_ok", "1");
    location.reload();
  }).catch(() => {
    alert("Der Umzug hat nicht geklappt – an der alten Adresse ist nichts verloren.\n\nBitte dort unter „Mehr“ → „Backup als Datei speichern“ und hier „Backup wiederherstellen“.");
    location.reload();
  });
}

/* ---------------- Umzugs-Code (10.10.2026) ----------------
   Anlass: Mirkos iPhone-Test am 10.10.2026. Nach "Jetzt umziehen" waren die
   Daten unter der neuen Adresse in SAFARI, die danach installierte App war
   leer - das iPhone gibt jeder App vom Home-Bildschirm einen eigenen Speicher.
   Darum (Mirko: Weg A, Entwurf freigegeben "ok"): In der alten App "Umzugs-Code
   kopieren" (Brief, und unter der alten Adresse auch unter "Mehr"), in der
   neuen App beim ersten Start "Daten einfuegen". Der Code ist dasselbe Paket
   wie bei "Jetzt umziehen" und geht nur ueber die Zwischenablage des Geraets -
   kein Internet, kein Konto, nichts verlaesst das Handy. */
const UMZUG_CODE = "RIEB-SPESEN-UMZUG:";
let umzugCodeVorrat = "";
/* Vorab packen (beim Anzeigen von Brief bzw. "Mehr"): Das iPhone erlaubt das
   Kopieren nur unmittelbar im Tipp - ein vorher gepacktes Paket geht ohne
   Warten in die Zwischenablage. */
async function umzugCodeVorbereiten() {
  const p = await umzugPaket();
  umzugCodeVorrat = p && p.length <= 1500000 ? UMZUG_CODE + p : "";
}
function textKopierenAlt(text) {
  const t = document.createElement("textarea");
  t.value = text; t.setAttribute("readonly", ""); t.style.cssText = "position:fixed;top:0;left:0;width:1px;height:1px;opacity:0";
  document.body.appendChild(t); t.focus(); t.select(); t.setSelectionRange(0, text.length);
  let gut = false; try { gut = document.execCommand("copy"); } catch (e) { gut = false; }
  t.remove(); return gut;
}
function textKopieren(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text).catch(() => { if (!textKopierenAlt(text)) throw new Error("kopieren"); });
  return textKopierenAlt(text) ? Promise.resolve() : Promise.reject(new Error("kopieren"));
}
function umzugCodeKopieren(knopf, danach) {
  const geklappt = () => { if (knopf) knopf.textContent = "Kopiert ✓"; if (danach) danach(); };
  const nicht = () => alert("Der Umzugs-Code ließ sich nicht kopieren.\n\nSo geht es trotzdem: unter „Mehr“ → „Backup als Datei speichern“, dann in der neuen App „Backup wiederherstellen“.");
  if (umzugCodeVorrat) { textKopieren(umzugCodeVorrat).then(geklappt, nicht); return; }
  umzugCodeVorbereiten().then(() => (umzugCodeVorrat ? textKopieren(umzugCodeVorrat) : Promise.reject())).then(geklappt, nicht);
}
/* Neue App, erster Start: "Schon Rieb Spesen benutzt? Daten einfuegen" */
async function umzugEinfuegen() {
  let text = null;
  try { text = await navigator.clipboard.readText(); } catch (e) { text = null; }
  if (text === null || !String(text).trim()) text = prompt("Umzugs-Code hier einfügen (lange tippen → „Einfügen“):", "");
  if (text === null) return;
  text = String(text).trim();
  if (!text.startsWith(UMZUG_CODE)) {
    alert("In der Zwischenablage ist kein Umzugs-Code.\n\nBitte in der bisherigen App auf „Umzugs-Code kopieren“ tippen (im Brief oder unter „Mehr“) und dann hier noch einmal „Daten einfügen“.");
    return;
  }
  umzugUebernehmen(text.slice(UMZUG_CODE.length));
}
/* Unter der alten Adresse: Gruppe unter "Mehr" (nach "Geraete abgleichen") */
function umzugGruppe(z) {
  umzugCodeVorbereiten();
  return `<div class="gruppe"><div class="gruppe-titel">Umzug auf ${esc(zielName())}</div><div class="liste">
    ${z("umzug-code", "datei", "Umzugs-Code kopieren", "Für die App auf dem Handy – in der neuen App beim ersten Start „Daten einfügen“")}
  </div></div>`;
}
/* Nach Einstieg bzw. Design-Wahl: Brief - und nach einem Umzug die Bestaetigung */
function nachDemEinstieg() {
  briefZeigen();
  resturlaubFragen();   // 09.10.2026: neues Urlaubsjahr - Rest bestaetigen lassen (wartet, bis der Brief zu ist)
  mtFragen();           // 11.10.2026: einmal fragen, ob Mitteilungen an sollen (wartet ebenso)
  sicherungFragen();    // 13.10.2026: ohne Anmeldung hoechstens alle 30 Tage an die Sicherung erinnern (nie nach einem anderen Bogen)
  if (sessionStorage.getItem("rieb_umzug_ok")) { sessionStorage.removeItem("rieb_umzug_ok"); toast("Umzug abgeschlossen – Ihre Einträge sind da"); }
  if (sessionStorage.getItem("rieb_konto_ok")) { sessionStorage.removeItem("rieb_konto_ok"); toast("Angemeldet – Ihre Einträge sind da"); }
}

function briefZeigen() {
  if (!briefFaellig() || document.getElementById("brief")) return;
  const punkt = (icon, titel, text) => `<li><span class="b-nr">${ic(icon)}</span><div><b>${titel}</b><span>${text}</span></div></li>`;
  /* Unter der alten Adresse: anklickbare neue Adresse + NUR "Jetzt umziehen"
     (Mirko 09.10.2026: Weg A, kein "Spaeter" - so entsteht vor dem Umzug
     keine PDF im Ordner, die zurueckbliebe; der Klick zieht 1:1 alles um).
     Klappt der Umzug nicht (kein Internet, neue Adresse noch nicht bereit),
     schliesst der Brief fuer dieses Mal - sonst kaeme ein Kollege offline
     gar nicht an seine Spesen. Beim naechsten Oeffnen kommt er wieder. */
  const alt = !amZiel();
  const adresse = alt ? `<a class="b-adresse" href="${esc(UMZUG_ZIEL)}" data-umzug>${esc(zielName())}</a>` : `<b class="b-adresse">${esc(zielName())}</b>`;
  const b = document.createElement("div");
  b.id = "brief"; b.className = "brief-ebene";
  b.innerHTML = `<div class="brief-schleier"></div>
    <div class="brief-blatt" role="dialog" aria-modal="true" aria-labelledby="briefTitel">
      <div class="brief-kopf"><svg viewBox="${RS_BOX}" aria-hidden="true"><text x="26" y="123" font-family="Geist" font-weight="660" font-size="92" fill="currentColor">R</text>
        <g transform="translate(80 48) scale(1.3)"><path d="${S_PFAD}" fill="none" stroke="url(#riebS)" stroke-width="9.5" stroke-linecap="round"/></g></svg>
        <div><small>Rieb Spesen · Information</small><b id="briefTitel">Wichtig für Ihre Spesen</b></div></div>
      <p>Liebe Kolleginnen und Kollegen,</p>
      <p>in Absprache mit den Vorgesetzten darf dieses Werkzeug für Ihre Spesen genutzt werden. Dabei gilt:</p>
      <ul class="brief-punkte">
        ${punkt("stift", "Selbst drucken, von Hand unterschreiben", "Drucken Sie Ihren Spesennachweis selbst aus und unterschreiben Sie ihn handschriftlich.")}
        ${punkt("farbe", "Neues Design, gewohnte Funktionen", "Das Werkzeug hat ein neues Aussehen bekommen – die Funktionen bleiben dieselben.")}
        ${punkt("haus", alt ? `Umzug bis ${UMZUG_FRIST}` : "Neue Adresse", alt ? `Das Werkzeug zieht um auf ${adresse}, die alte Adresse wird danach abgeschaltet. Ein Klick genügt – Ihre bisherigen Einträge kommen mit.`
                                            : `Das Werkzeug ist umgezogen auf ${adresse}.`)}
      </ul>
      <p class="brief-gruss">Bei Fragen sprechen Sie mich gern an.<b>Mirko Rieb</b></p>
      ${alt ? `<button class="haupt-knopf" id="briefUmzug" type="button" data-umzug>Jetzt umziehen</button>
        <div class="brief-app"><span>App auf dem Handy?</span><button class="knopf-klein" id="briefCode" type="button">Umzugs-Code kopieren</button></div>
        <p class="brief-app-hinweis" id="briefCodeHinweis" hidden>Jetzt <b>${esc(zielName())}</b> öffnen, „Zum Home-Bildschirm“ – und in der neuen App beim ersten Start <b>„Daten einfügen“</b> tippen.</p>`
            : `<button class="haupt-knopf" id="briefOk" type="button">Verstanden</button>`}
    </div>`;
  document.getElementById("rieb").appendChild(b);
  const zu = () => { b.classList.add("weg"); setTimeout(() => b.remove(), 420); };
  if (alt) {
    b.querySelectorAll("[data-umzug]").forEach((el) => el.addEventListener("click", async (ev) => { ev.preventDefault(); if (!(await umziehen())) zu(); }));
    umzugCodeVorbereiten();
    document.getElementById("briefCode").addEventListener("click", (ev) => umzugCodeKopieren(ev.currentTarget, () => {
      const h = document.getElementById("briefCodeHinweis"); h.hidden = false;
      h.scrollIntoView({ block: "end", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    }));
  } else {
    document.getElementById("briefOk").addEventListener("click", () => { localStorage.setItem(BRIEF_KEY, new Date().toISOString()); zu(); });
  }
  setTimeout(() => { const k = document.getElementById(alt ? "briefUmzug" : "briefOk"); if (k && matchMedia("(hover:hover)").matches) k.focus({ preventScroll: true }); }, 900);
}

/* ---------------- Start ---------------- */
function los() {
  geruestBauen();
  /* Das alte Startbild (das fruehere Nachtfoto) wird nicht mehr gezeigt. */
  const alt = document.getElementById("splashScreen"); if (alt) alt.style.display = "none";
  if (!vtDa()) document.documentElement.classList.add("ohne-vt");
  const anker = (location.hash || "").toLowerCase();
  /* Brief an die Kollegen: wer HIER zum ersten Mal einrichtet, fuer den ist
     nichts neu und nichts zieht um - er gilt als gelesen */
  if (localStorage.getItem("spesen_config") === null && !localStorage.getItem(BRIEF_KEY)) localStorage.setItem(BRIEF_KEY, "ersteinrichtung");
  /* #arbeitszeit und #inventur fuehren seit 08.10.2026 in die neue Oberflaeche */
  /* Neu geladen nach einem Abgleich von einem anderen Geraet (firebase-sync.js,
     09.10.2026): zurueck in denselben Bereich, ohne Einstieg - vorher landete
     man mitten in der Arbeit mit Animation auf der Startseite. */
  let nachAbgleich = null;
  try { nachAbgleich = sessionStorage.getItem("rieb_nach_abgleich"); sessionStorage.removeItem("rieb_nach_abgleich"); } catch (e) { /* egal */ }
  const bereichOk = (b) => ["spesen", "urlaub", "jahr", "mehr", "anleitung"].includes(b) || (EIGENE.includes(b) && tabErlaubt(b));
  if (nachAbgleich && localStorage.getItem("spesen_config") !== null && designGewaehlt()) {
    if (nachAbgleich !== "start" && bereichOk(nachAbgleich)) geheZu(nachAbgleich, { ohneVT: true });
    else { renderStart({}); zeige("start"); aktuell = "start"; }
    nachDemEinstieg();
    toast("Von Ihrem anderen Gerät abgeglichen");
  }
  else if (anker.indexOf("arbeitszeit") > -1 && tabErlaubt("zeit")) { geheZu("zeit", { ohneVT: true }); nachDemEinstieg(); }
  else if (anker.indexOf("inventur") > -1 && tabErlaubt("inventur")) geheZu("inventur", { ohneVT: true });
  else if (anker.indexOf("urlaub") > -1) { geheZu("urlaub", { ohneVT: true }); nachDemEinstieg(); }
  else { renderStart({ ausNull: true, auftritt: true }); zeige("start"); aktuell = "start";
         /* Allererster Start: der alte Assistent hat sich beim Laden schon
            geoeffnet (maybeShowSetupWizard laeuft vor rieb.js) - stattdessen
            die neue Einrichtung. */
         if (localStorage.getItem("spesen_config") === null) einrichtungStarten();
         /* Schon eingerichtet, noch kein Design gewaehlt: zuerst die Wahl */
         else if (!designGewaehlt()) designWahlStarten();
         else einstieg(); }
  const { j, m } = gewaehlt();
  schnappschuss = { s: monatInfo(j, m).summe, j: jahrInfos(config.jahr).reduce((s, x) => s + x.summe, 0) };
  const h = new Date(), w = tagInfo(h, feiertage(h.getFullYear(), config.bundesland));
  letzterZustand = (w.heute || w.art) + "|" + w.iso;
  setInterval(takt, 1000);
  abgleichVerbinden();   // falls firebase-sync.js schon vor rieb.js bereit war
  /* Mitteilungen (11.10.2026): laden, Texte vorausrechnen - bei jedem Start
     und wenn die App wieder nach vorn kommt (neuer Tag, neue Lage) */
  setTimeout(() => { mtStart().catch((e) => console.info("[Mitteilungen]", e.message)); }, 1200);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && mtAn()) mtAuffrischenSpaeter(); });
}
/* Danach geht der dunkle Vorhang aus rieb.css ("VOR DEM ERSTEN BILD") auf -
   die neue Oberflaeche steht, das alte Startbild ist aus. "finally": auch
   wenn beim Aufbau etwas schiefgeht, bleibt der Bildschirm nicht schwarz. */
/* Kommt die Seite mit Umzugsdaten (#umzug=...), zuerst uebernehmen - die
   Seite laedt danach neu; bis dahin bleibt der dunkle Vorhang zu. */
function starten() { if (umzugAnkunft()) return; try { los(); } finally { document.documentElement.classList.add("rieb-bereit"); } }
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", starten); else starten();
})();
