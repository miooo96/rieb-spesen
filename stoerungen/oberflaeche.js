/* =====================================================================
   stoerungen/oberflaeche.js - Störungsliste: Bildschirme (11.10.2026)
   Entwurf: Vault: "Störungsliste - Entwurf.md"

   Nur für Mirko: rieb.js zeigt Kachel und Leisten-Eintrag nur bei
   tabErlaubt("stoerungen") -> istMirko(); render() prüft es zusätzlich.
   Kopf, Bögen, Hinweise und Symbole kommen aus rieb.js (H), damit der
   Bereich in App und Browser genau wie die übrigen aussieht.

   ⛔ Kein localStorage, kein sessionStorage, kein Netz. Alles liegt in
   IndexedDB (daten.js). Dauerhaften Speicher (navigator.storage.persist)
   fragt index.html („Speicher-Schutz“) schon für die ganze Herkunft an -
   hier KEINE zweite Anfrage (Firefox würde erneut nachfragen).
   Eine angefangene Störung liegt als Einstellung "entwurf" in IndexedDB
   und übersteht so ein Neuladen der Seite (Update, Sync, iOS nach der Kamera).

   Aufbau: Jeder Teil (Erfassen, Störung, Kartei, Daten) trägt sich in
   AKTIONEN (Knöpfe data-st), SEITEN (Ansichten), EINGABEN, AENDERUNGEN
   und NACH_ZEICHNEN ein - vor der Zeile "ENDE DER TEILE".
   ===================================================================== */
(function () {
  "use strict";
  const R = window.StoerRegeln, D = window.StoerDaten, A = window.StoerAuswertung, X = window.StoerExcel, B = window.StoerBericht;
  let H = null;   // Helfer aus rieb.js
  let S = null;   // geladener Stand (D.stand())
  const Z = {
    ansicht: "erfassen",            // erfassen | stoerung | kartei | automat | daten
    ziffern: "",                    // A-Nummer ohne "A"
    neu: { kuerzel: "", ort: "", tour: "" },  // Anlage eines unbekannten Automaten
    tourFilter: "",                 // Kartei: "" = alle Touren
    offenGefragt: null,             // id der offenen Störung, nach der schon gefragt wurde
    probe: null,                    // { id, a } - offene Probeverkauf-Frage
    entwurf: null,                  // Störung in Bearbeitung
    fotos: [],                      // Fotos des Entwurfs: [{ id|null, blob, url, zu: "automat"|"mona", zg: schon gespeicherte Zuordnung|null }]
    wegFotos: [],                   // ids gelöschter, schon gespeicherter Fotos
    videos: [],                     // Videos des Entwurfs (nur Angaben, nie das Video selbst): [{ id, zu: "automat"|"mona", dauer: Sekunden|null, url: Standbild|null, gespeichert: gehört schon zu einer gespeicherten Erfassung }]
    wegVideos: [],                  // ids gelöschter, schon gespeicherter Videos (fallen erst beim Speichern wirklich weg)
    videoHinweis: null,             // { zu, text } - das zuletzt abgewiesene Video war zu lang
    videoBusy: null,                // "automat" | "mona", solange ein Video gelesen wird
    bearbeite: null,                // id der Erfassung, die geändert wird
    karteiA: null,                  // geöffneter Automat in der Kartei
    datei: null,                    // fertige Datei zum Teilen: { datei, art, text (nur beim Video: geht mit der Datei mit) }
    einspielen: null,               // geprüfte Sicherung, wartet auf Bestätigung
    urls: [],                       // Objekt-URLs der Kartei-Fotos
    haltScroll: false,
    scrollZiel: 0,                  // Scroll-Stand, den zeichne() halten wollte (Fotos kommen später)
    zeichnung: 0,                   // zählt jedes zeichne() - verspätete Foto-Ladungen erkennen sich daran
    sprache: null,                  // Sprechfeld der Seite "Störung": { fuer: Entwurf, text, bestaetigt: { gehört: Sortennummer }, ergebnis } - nie gespeichert
  };
  const AKTIONEN = {}, SEITEN = {}, EINGABEN = [], AENDERUNGEN = {}, NACH_ZEICHNEN = [];
  const sek = () => document.getElementById("s-stoerungen");
  const esc = (s) => H.esc(s);
  const heute = () => R.lokalIso(new Date()).slice(0, 10);
  const wert = (id) => { const el = document.getElementById(id); return el ? String(el.value || "").trim() : ""; };
  const KAMERA = '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>';
  const VIDEO = '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="6.5" width="12" height="11" rx="2"/><path d="M15 10.5l6-3.5v10l-6-3.5z"/></svg>';
  const PLAY = '<svg class="st-play" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>';   // Dreieck als Zeichnung - das Zeichen ▶ wird am iPhone zum bunten Emoji

  /* ---------------- Rahmen ---------------- */
  async function render(h) {
    if (h) H = h;
    const s = sek(); if (!s || !H) return;
    if (!(typeof istMirko === "function" && istMirko())) { s.innerHTML = ""; return; }
    /* Sofort etwas zeigen (der Seitenwechsel fotografiert jetzt), dann laden */
    if (S) zeichne(); else s.innerHTML = H.kopf("stoerungen", "Störungsliste", { zahl: "–", unter: "wird geladen" });
    try { S = await D.stand(); }
    catch (e) {
      console.error(e);
      s.innerHTML = H.kopf("stoerungen", "Störungsliste", { zahl: "!", unter: "Konnte nicht geladen werden" });
      H.toast("Störungsliste konnte nicht geladen werden: " + (e && e.message ? e.message : String(e)));
      return;
    }
    await entwurfHolen();
    /* Aufgenommene, aber nirgends mehr gebrauchte Entwurfs-Videos (Absturz, Neuladen mitten im Aufnehmen) gehen jetzt weg - was ein Entwurf noch nennt, bleibt */
    await D.videoWaisenLoeschen(Z.videos.map((v) => v.id)).catch((e) => console.error(e));
    zeichne();
  }
  async function neuLaden() { S = await D.stand(); zeichne(); }
  function sicherungsMahnung() {
    if (!S.erfassungen.length) return "";
    if (S.letzteSicherung) { const t = R.tageZwischen(S.letzteSicherung, heute()); return t > 7 ? "Letzte Sicherung vor " + t + " Tagen" : ""; }
    const erste = S.erfassungen.reduce((x, e) => (!x || e.zeit < x ? e.zeit : x), "");
    return R.tageZwischen(R.tagVon(erste), heute()) > 7 ? "Noch keine Sicherung" : "";
  }
  function kopfHTML() {
    const n = S.erfassungen.filter((e) => R.tagVon(e.zeit) === heute()).length, mahnung = sicherungsMahnung();
    const aktiv = Z.ansicht === "stoerung" ? "erfassen" : Z.ansicht === "automat" ? "kartei" : Z.ansicht;
    const reiter = `<div class="ansicht" role="group" aria-label="Ansicht">${[["erfassen", "Erfassen"], ["kartei", "Kartei"], ["daten", "Daten"]].map(([a, t]) =>
      `<button data-st="ansicht" data-wert="${a}" class="${aktiv === a ? "an" : ""}" aria-pressed="${aktiv === a}">${t}</button>`).join("")}</div>`;
    return H.kopf("stoerungen", "Störungsliste", {
      zahl: String(n), label: n + " Automaten heute erfasst", rechts: reiter, mini: n + " heute",
      unter: (n === 1 ? "Automat" : "Automaten") + " heute erfasst" + (mahnung ? ` · <span class="st-mahnung">${esc(mahnung)}</span>` : "") });
  }
  function zeichne() {
    const s = sek(); if (!s || !S || !H) return;
    const scroll = s.scrollTop;
    Z.urls.forEach((u) => URL.revokeObjectURL(u)); Z.urls = [];
    Z.zeichnung++; Z.scrollZiel = Z.haltScroll ? scroll : 0;
    const seite = SEITEN[Z.ansicht] || SEITEN.erfassen;
    s.innerHTML = kopfHTML() + `<div class="blatt"><div class="blatt-innen st-innen">${seite()}</div></div>`;
    NACH_ZEICHNEN.forEach((f) => f());
    s.scrollTop = Z.scrollZiel; Z.haltScroll = false;
    H.kopfScroll(s);
    if (Z.entwurf) entwurfSichern();
  }
  function zeichneHalten() { Z.haltScroll = true; zeichne(); }

  /* Reiter. Mit angefangener Störung führt „Erfassen“ zurück zu ihr; Kartei
     und Daten wechseln normal, die Störung bleibt erhalten. */
  AKTIONEN.ansicht = (t) => {
    const w = t.dataset.wert;
    if (w !== "daten") { Z.datei = null; Z.einspielen = null; }   // fertige Datei / geprüfte Sicherung nicht im Speicher liegen lassen
    Z.ansicht = Z.entwurf && w === "erfassen" ? "stoerung" : w;
    if (Z.ansicht !== "automat") Z.karteiA = null;
    zeichne();
  };

  /* ---- Angefangene Störung in IndexedDB (nie localStorage) ---- */
  let entwurfUhr = null, entwurfKette = Promise.resolve();
  /* Schreibvorgänge der Reihe nach - ein spätes Sichern überholt nie das Löschen */
  function entwurfSchreiben(v) {
    entwurfKette = entwurfKette.then(() => D.setzeEinstellung("entwurf", v)).catch((e) => console.error(e));
    return entwurfKette;
  }
  function entwurfJetzt() {
    clearTimeout(entwurfUhr); entwurfUhr = null;
    if (!Z.entwurf) return;
    /* Videos: nur die Ids. Jedes Video liegt schon im Speicher „videos“ (videoAufnahme) - der Entwurf wird oft neu geschrieben, ein Video nie mit. */
    entwurfSchreiben({ entwurf: Z.entwurf, bearbeite: Z.bearbeite, wegFotos: Z.wegFotos, fotos: Z.fotos.map((f) => ({ id: f.id, blob: f.blob, zu: f.zu, zg: f.zg || null })),
      videos: Z.videos.map((v) => v.id), wegVideos: Z.wegVideos });
  }
  function entwurfSichern() { clearTimeout(entwurfUhr); entwurfUhr = setTimeout(entwurfJetzt, 300); }
  function entwurfLoeschen() { clearTimeout(entwurfUhr); entwurfUhr = null; return entwurfSchreiben(null); }
  /* Seite geht in den Hintergrund (Kamera, App-Wechsel): sofort sichern statt nach 300 ms */
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden" && entwurfUhr) entwurfJetzt(); });
  async function entwurfHolen() {
    if (Z.entwurf) return;
    let g = null;
    try { g = await D.einstellung("entwurf"); } catch (e) { console.error(e); return; }
    if (!g || !g.entwurf || Z.entwurf) return;
    /* Videos des Entwurfs aus dem Speicher holen (der Entwurf nennt nur die Ids; ein Entwurf aus der Fassung vor den Videos hat das Feld nicht). Erst laden, dann
       alles auf einmal setzen - währenddessen könnte ein anderer Aufruf schon einen Entwurf angelegt haben. */
    const vids = await videoEintraege(Array.isArray(g.videos) ? g.videos : []);
    if (Z.entwurf) { vids.forEach((v) => { if (v.url) URL.revokeObjectURL(v.url); }); return; }
    fotosFreigeben();
    Z.wegVideos = Array.isArray(g.wegVideos) ? g.wegVideos.filter((id) => typeof id === "string") : []; Z.videos = vids;
    Z.entwurf = g.entwurf; Z.bearbeite = g.bearbeite || null;
    paeckchenZeilen(Z.entwurf);   // Entwurf aus der älteren Fassung (ohne Feld paeckchen): leere Zeile bzw. Päckchen aus dem Klemmer übernehmen
    entwurfNeuFormat(Z.entwurf);  // Entwurf aus der Fassung vor der festen Auswahl (geraet/mona nur mit text, klemmer-Liste): in Punkte umschreiben
    Z.wegFotos = Array.isArray(g.wegFotos) ? g.wegFotos : [];
    /* zu = Platz des Fotos („automat“ / „mona“); ein Entwurf aus der älteren Fassung hat kein zu → „automat“. zg = was schon gespeichert ist (nur bei Fotos mit id). */
    Z.fotos = (g.fotos || []).filter((f) => f && f.blob).map((f) => ({ id: f.id || null, blob: f.blob, url: URL.createObjectURL(f.blob), zu: f.zu === "mona" ? "mona" : "automat", zg: f.zg || null }));
    if (Z.bearbeite) Z.karteiA = g.entwurf.a; else Z.ziffern = String(g.entwurf.a || "").slice(1);   // wie vor dem Neuladen
    Z.ansicht = "stoerung";
    H.toast("Angefangene Störung wiederhergestellt");
  }
  /* Ein angefangener Entwurf aus der Fassung vor der festen Auswahl (live bis 12.10.2026) trägt geraet/mona nur mit text und die Klemmer als Liste.
     Beim Wiederherstellen wird daraus das neue Format (regeln.js teileNeu): alter Text = Sonstiges, jeder Klemmer = Punkt „klemmer“ mit nr = [Schacht oder Modul].
     Zeitstempel: beim Ändern einer Erfassung deren Zeit (die Punkte waren ja schon vorher da), sonst der Moment der Wiederherstellung. */
  function entwurfNeuFormat(ent) {
    const alt = (t) => !!t && !Array.isArray(t.punkte);
    if (alt(ent.geraet) || alt(ent.mona) || (Array.isArray(ent.klemmer) && ent.klemmer.length)) {
      const rec = ent.id && S ? S.erfassungen.find((x) => x.id === ent.id) : null;
      const zeit = rec ? rec.zeit : ent.id ? (ent.tag || heute()) + "T" + (ent.uhrzeit || "00:00") + ":00" : R.lokalIso(new Date());
      const neu = R.teileNeu({ zeit, geraet: ent.geraet, mona: ent.mona, klemmer: ent.klemmer });
      ent.geraet = ent.geraet && !alt(ent.geraet) ? ent.geraet : neu.geraet;
      ent.mona = ent.mona && !alt(ent.mona) ? ent.mona : neu.mona;
    }
    delete ent.klemmer;
  }
  /* Ein Video des Entwurfs aus seinem Datensatz (nur Angaben und die Adresse des Standbilds - das Video selbst bleibt im Speicher) */
  const videoEintrag = (rec) => ({ id: rec.id, zu: rec.zu === "mona" ? "mona" : "automat", dauer: rec.dauer || null, url: rec.standbild ? URL.createObjectURL(rec.standbild) : null,
    gespeichert: !!rec.erfassung && rec.entwurf !== true });
  async function videoEintraege(idListe) {
    const aus = [];
    for (const id of idListe) {
      let rec = null;
      try { rec = typeof id === "string" ? await D.holen("videos", id) : null; } catch (e) { console.error(e); }
      if (rec) aus.push(videoEintrag(rec));   // ein Video, das es nicht mehr gibt, fällt still weg
    }
    return aus;
  }
  /* Aufgenommene, noch nicht gespeicherte Videos des Entwurfs: die gehen mit Abbrechen/Verwerfen weg (schon gespeicherte nie) */
  const neueVideoIds = () => Z.videos.filter((v) => !v.gespeichert).map((v) => v.id);
  /* Neue Störung oder Ändern, während schon eine angefangen ist: erst fragen */
  function entwurfFrage() {
    H.oeffneEbene(H.bogenKopf("Noch nicht gespeichert", "Angefangene Störung für " + esc(Z.entwurf.a)) + `<div class="st-bogen">
      <p>Erst weitermachen und speichern – oder verwerfen.</p>
      <button class="haupt-knopf" data-st="entwurf-zurueck">Zur angefangenen Störung</button>
      <button class="knopf-klein st-breit" data-st="entwurf-verwerfen">Verwerfen</button></div>`);
  }
  AKTIONEN["entwurf-zurueck"] = () => { H.schliesseEbene(); if (!Z.entwurf) return; Z.ansicht = "stoerung"; zeichne(); };
  AKTIONEN["entwurf-verwerfen"] = async () => {
    const weg = neueVideoIds();   // vor dem Freigeben merken: aufgenommene, noch nicht gespeicherte Videos gehen mit dem Entwurf
    fotosFreigeben(); Z.entwurf = null; Z.bearbeite = null;
    H.schliesseEbene(); H.toast("Verworfen");
    await entwurfLoeschen();
    await D.videosLoeschen(weg);
  };

  /* ================= Teil 1: Erfassen (Bildschirm 1) ================= */
  const aktuellesA = () => (R.aNummerGueltig(Z.ziffern) ? R.aNummer(Z.ziffern) : null);
  const neuerAutomat = (a) => (S.automaten.some((m) => m.a === a) ? null
    : { a, kuerzel: Z.neu.kuerzel, ort: Z.neu.ort, tour: Z.neu.tour, werkstattModell: null, angelegt: R.lokalIso(new Date()) });
  /* Tour-Feld ist mit der zuletzt benutzten Tour vorbelegt (IndexedDB, nie localStorage) */
  const neuLeer = () => ({ kuerzel: "", ort: "", tour: (S && S.letzteTour) || "" });
  const neuBereit = () => !!(Z.neu.kuerzel && Z.neu.ort && Z.neu.tour);
  async function tourMerken(m) { if (m && m.tour) await D.setzeEinstellung("letzteTour", m.tour); }
  function geraetNeu() { const g = document.getElementById("stGeraet"); if (g) g.innerHTML = geraetTeil(); }

  function probeKarte() {
    if (!Z.probe) return "";
    return `<div class="karte st-probe"><span class="ueberschrift">Probeverkauf nach dem Füllen · ${esc(Z.probe.a)}</span>
      <div class="st-zwei"><button class="st-wahl" data-st="probe-ok">ok</button><button class="st-wahl" data-st="probe-klemmer">Klemmer</button></div></div>`;
  }
  function heuteListe() {
    const h = S.erfassungen.filter((e) => R.tagVon(e.zeit) === heute()).sort((x, y) => (x.zeit < y.zeit ? 1 : -1)).slice(0, 8);
    return `<p class="st-tipp">Sechs Ziffern der A-Nummer eingeben.</p>` + (h.length ? `<div class="karte st-heute"><span class="ueberschrift">Heute erfasst</span>
      ${h.map((e) => `<div class="st-heute-zeile"><b>${esc(e.a)}</b> <span>${esc(e.zeit.slice(11, 16))}</span> <span class="st-marke ${esc(e.ergebnis)}">${e.ergebnis === "ok" ? "in Ordnung" : "Störung"}</span></div>`).join("")}</div>` : "");
  }
  function aktionsKnoepfe(bereit) {
    const aus = bereit ? "" : " disabled";
    return `<div class="st-knoepfe">
      <button class="haupt-knopf st-ok" data-st="ok"${aus}>Alles in Ordnung</button>
      <button class="haupt-knopf st-stoer" data-st="stoerung"${aus}>Störung erfassen</button>
      <button class="knopf-klein st-werkstatt" data-st="werkstatt"${aus}>Werkstatt war da</button></div>`;
  }
  function neuAnlage(a) {
    return `<div class="karte st-neu">
      <div class="st-geraet-zeile"><b>${esc(a)}</b> <span>Neuer Automat</span></div>
      <span class="ueberschrift">Kürzel vom Verkaufsbericht</span>
      <div class="st-chips">${S.kuerzel.map((k) => `<button class="st-chip${Z.neu.kuerzel === k.kuerzel ? " an" : ""}" data-st="neu-kuerzel" data-wert="${esc(k.kuerzel)}" aria-pressed="${Z.neu.kuerzel === k.kuerzel}">${esc(k.kuerzel)}</button>`).join("")}
        <button class="st-chip st-chip-neu" data-st="kuerzel-neu">Neues Kürzel …</button></div>
      <span class="ueberschrift">Standort</span>
      <div class="st-zwei">${[["innen", "Innengerät"], ["aussen", "Außengerät"]].map(([w, t]) =>
        `<button class="st-wahl${Z.neu.ort === w ? " an" : ""}" data-st="neu-ort" data-wert="${w}" aria-pressed="${Z.neu.ort === w}">${t}</button>`).join("")}</div>
      <label class="feld"><span>Tour-Nr.</span><input id="stTour" inputmode="numeric" autocomplete="off" value="${esc(Z.neu.tour)}"></label>
    </div>${aktionsKnoepfe(neuBereit())}`;
  }
  /* Gedächtnis (13.10.2026, Mirko: „weis er das der bereits mal wegen dem und dem störung hatte dann und dann … klar getrennt zwischen behobenen und
     neuen störungen“): die Automatenstörungen aus abgeschlossenen Zeiträumen, grau und mit eigener Überschrift – getrennt von allem Laufenden.
     Je Zeile Datum, Störung, „behoben am …“ / „offen“. max = wie viele Zeilen (der Rest steht in der Kartei). */
  function frueherBlock(a, max) {
    const fr = R.frueherVon(S.frueher, a); if (!fr.length) return "";
    const zeigen = max ? fr.slice(0, max) : fr;
    return `<div class="st-frueher"><span class="st-frueher-titel">Früher (abgeschlossene Zeiträume) · ${fr.length} ${fr.length === 1 ? "Störung" : "Störungen"}</span>
      ${zeigen.map((e) => `<span class="st-frueher-zeile${e.behoben === true ? " behoben" : ""}">${esc(R.frueherText(e))}</span>`).join("")}
      ${fr.length > zeigen.length ? `<span class="st-klein">… und ${fr.length - zeigen.length} weitere – in der Kartei beim Automaten</span>` : ""}</div>`;
  }
  function geraetTeil() {
    const a = aktuellesA(); if (!a) return heuteListe();
    if (!S.automaten.some((m) => m.a === a)) return neuAnlage(a);
    const g = R.geraetInfo(S, a), eig = S.erfassungen.filter((e) => e.a === a);
    const letzte = eig.reduce((x, e) => (e.zeit > x ? e.zeit : x), "");
    /* Werkstatt-Zähler über laufenden Zeitraum UND Gedächtnis (13.10.2026) */
    const warn = R.vorwarnung(S.erfassungen.concat(S.frueher), S.werkstatt, a), offen = R.offeneStoerung(S.erfassungen, a);
    return `<div class="karte st-geraet">
      <div class="st-geraet-zeile"><b>${esc(a)}</b> <span>${esc(g.kuerzel)} · ${esc(g.ortText)} · Tour ${esc(g.tour || "?")} · ${eig.length} ${eig.length === 1 ? "Erfassung" : "Erfassungen"}${S.frueher.some((e) => e.a === a) ? " im laufenden Zeitraum" : ""}${letzte ? ", letzte am " + esc(R.datumKurz(letzte)) : ""}</span></div>
      ${warn ? `<p class="st-warn">${H.ic("info")}<span>${esc(warn)}</span></p>` : ""}
      ${offen && Z.offenGefragt !== offen.id ? `<div class="st-offen"><span>Offene Störung vom ${esc(R.datumKurz(offen.zeit))} – inzwischen behoben?</span>
        <div class="st-zwei"><button class="knopf-klein" data-st="offen-ja" data-id="${esc(offen.id)}">Ja</button><button class="knopf-klein" data-st="offen-nein" data-id="${esc(offen.id)}">Nein</button></div></div>` : ""}
      ${frueherBlock(a, 5)}
    </div>${aktionsKnoepfe(true)}`;
  }
  SEITEN.erfassen = () => `${probeKarte()}
    <div class="karte st-anr">
      <label class="ueberschrift" for="stZiffern">A-Nummer</label>
      <div class="st-anr-feld"><span class="st-a" aria-hidden="true">A</span>
        <input id="stZiffern" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="off" enterkeyhint="done" aria-label="A-Nummer: sechs Ziffern" value="${esc(Z.ziffern)}"></div>
    </div>
    <div id="stGeraet">${geraetTeil()}</div>`;

  EINGABEN.push((el) => {
    if (el.id !== "stZiffern") return false;
    const z = R.ziffernAus(el.value).slice(0, 6);
    if (el.value !== z) el.value = z;
    if (z === Z.ziffern) return true;
    Z.ziffern = z; Z.neu = neuLeer(); Z.offenGefragt = null;
    if (R.aNummerGueltig(z)) {
      /* Entwurf: "Wird vorher die nächste A-Nummer eingegeben, bleibt der Probeverkauf leer." */
      if (Z.probe && Z.probe.a !== R.aNummer(z)) { Z.probe = null; const p = document.querySelector("#s-stoerungen .st-probe"); if (p) p.remove(); }
      el.blur();
    }
    geraetNeu();
    return true;
  });
  /* Tour-Feld: nicht neu zeichnen (sonst verliert das Feld den Fokus), nur die Knöpfe freigeben */
  EINGABEN.push((el) => {
    if (el.id !== "stTour") return false;
    Z.neu.tour = String(el.value || "").trim();
    document.querySelectorAll("#stGeraet .st-knoepfe [data-st]").forEach((b) => { b.disabled = !neuBereit(); });
    return true;
  });

  async function nachErfassung(e, text) {
    Z.ziffern = ""; Z.offenGefragt = null; Z.ansicht = "erfassen";
    Z.probe = R.phase(e.zeit, S.umstellung) === "nachher" ? { id: e.id, a: e.a } : null;
    H.toast(text);
    await neuLaden();
  }
  AKTIONEN["neu-kuerzel"] = (t) => { Z.neu.kuerzel = t.dataset.wert; geraetNeu(); };
  AKTIONEN["neu-ort"] = (t) => { Z.neu.ort = t.dataset.wert; geraetNeu(); };
  AKTIONEN.ok = async () => {
    const a = aktuellesA(); if (!a) return;
    const e = { id: R.neueId("e"), a, zeit: R.lokalIso(new Date()), ergebnis: "ok", geraet: null, mona: null, klemmer: null, paeckchen: null,
      behoben: null, behobenAm: null, probeverkauf: null, werkstattAntwort: null };
    const m = neuerAutomat(a);
    await D.erfassungSpeichern(e, { automat: m });
    await tourMerken(m || S.automaten.find((x) => x.a === a));
    await nachErfassung(e, "In Ordnung gespeichert");
  };
  AKTIONEN["offen-ja"] = async (t) => {
    const e = S.erfassungen.find((x) => x.id === t.dataset.id); if (!e) return;
    await D.schreiben("erfassungen", Object.assign({}, e, { behoben: true, behobenAm: heute() }));
    Z.offenGefragt = e.id; H.toast("Als behoben vermerkt"); Z.haltScroll = true; await neuLaden();
  };
  AKTIONEN["offen-nein"] = (t) => { Z.offenGefragt = t.dataset.id; geraetNeu(); };

  /* Werkstatt war da: Datum, das die Werkstatt hinterlassen hat - oder nur ein
     Hinweis ohne Datum; dann zählt der Fundmoment (genaues Datum später in der Kartei). */
  AKTIONEN.werkstatt = () => {
    const a = aktuellesA(); if (!a) return;
    H.oeffneEbene(H.bogenKopf(esc(a), "Werkstatt war da") + `<div class="st-bogen">
      <label class="feld"><span>Datum, das die Werkstatt hinterlassen hat</span><input type="date" id="stWDatum" max="${heute()}"></label>
      <button class="haupt-knopf" data-st="w-datum" data-a="${esc(a)}">Mit Datum speichern</button>
      <button class="knopf-klein st-breit" data-st="w-unbekannt" data-a="${esc(a)}">Hinweis gefunden, Datum unbekannt</button>
      <p class="st-klein">Ohne Datum zählt der heutige Tag. Das genaue Datum lässt sich in der Kartei nachtragen.</p></div>`);
  };
  async function werkstattSpeichern(a, mitDatum) {
    const datum = mitDatum ? wert("stWDatum") : null;
    if (mitDatum && !/^\d{4}-\d{2}-\d{2}$/.test(datum)) { H.toast("Bitte ein Datum wählen"); return; }
    if (mitDatum && datum > heute()) { H.toast("Datum liegt in der Zukunft"); return; }
    const m = neuerAutomat(a); if (m) await D.schreiben("automaten", m);
    await tourMerken(m || S.automaten.find((x) => x.a === a));
    await D.schreiben("werkstatt", { id: R.neueId("w"), a, datum, erfasstUm: R.lokalIso(new Date()) });
    H.schliesseEbene(); H.toast("Werkstattbesuch gespeichert"); Z.haltScroll = true; await neuLaden();
  }
  AKTIONEN["w-datum"] = (t) => werkstattSpeichern(t.dataset.a, true);
  AKTIONEN["w-unbekannt"] = (t) => werkstattSpeichern(t.dataset.a, false);

  /* Probeverkauf (ab dem Umstellungstag) */
  async function probeSpeichern(ergebnis, schacht) {
    if (!Z.probe) return;
    const e = S.erfassungen.find((x) => x.id === Z.probe.id);
    if (e) await D.schreiben("erfassungen", Object.assign({}, e, { probeverkauf: { ergebnis, schacht: String(schacht || "").trim() } }));
    Z.probe = null; H.schliesseEbene(); H.toast("Probeverkauf gespeichert"); Z.haltScroll = true; await neuLaden();
  }
  AKTIONEN["probe-ok"] = () => probeSpeichern("ok", "");
  AKTIONEN["probe-klemmer"] = () => {
    if (!Z.probe) return;
    H.oeffneEbene(H.bogenKopf(esc(Z.probe.a), "Probeverkauf: Klemmer") + `<div class="st-bogen">
      <label class="feld"><span>Schacht (freiwillig)</span><input id="stProbeSchacht" autocomplete="off"></label>
      <button class="haupt-knopf" data-st="probe-klemmer-ok">Speichern</button></div>`);
  };
  AKTIONEN["probe-klemmer-ok"] = () => probeSpeichern("klemmer", wert("stProbeSchacht"));

  /* Neues Kürzel (auch aus der Kartei, Task 8) */
  async function kuerzelHinzufuegen(kuerzel, hersteller) {
    kuerzel = String(kuerzel || "").trim(); hersteller = String(hersteller || "").trim();
    if (!kuerzel || !hersteller) { H.toast("Bitte Kürzel und Hersteller eintragen"); return false; }
    if (S.kuerzel.some((k) => k.kuerzel.toLowerCase() === kuerzel.toLowerCase())) { H.toast("Dieses Kürzel gibt es schon"); return false; }
    await D.schreiben("kuerzel", { kuerzel, hersteller, reihe: S.kuerzel.reduce((m, k) => Math.max(m, k.reihe || 0), 0) + 1 });
    S = await D.stand();
    return kuerzel;
  }
  const herstellerListe = () => `<datalist id="stHerstellerListe">${Array.from(new Set(S.kuerzel.map((k) => k.hersteller).concat(S.werkstattModelle.map((w) => w.hersteller))))
    .map((h) => `<option value="${esc(h)}">`).join("")}</datalist>`;
  AKTIONEN["kuerzel-neu"] = () => {
    H.oeffneEbene(H.bogenKopf("Neuer Automat", "Neues Kürzel") + `<div class="st-bogen">${herstellerListe()}
      <label class="feld"><span>Kürzel wie auf dem Verkaufsbericht</span><input id="stNkK" autocomplete="off"></label>
      <label class="feld"><span>Hersteller</span><input id="stNkH" list="stHerstellerListe" autocomplete="off"></label>
      <button class="haupt-knopf" data-st="kuerzel-anlegen">Hinzufügen und wählen</button></div>`);
  };
  AKTIONEN["kuerzel-anlegen"] = async () => {
    const k = await kuerzelHinzufuegen(wert("stNkK"), wert("stNkH")); if (!k) return;
    Z.neu.kuerzel = k; H.schliesseEbene(); geraetNeu();
  };

  /* ================= Teil 2: Störung (Bildschirm 2) ================= */
  /* Die gefundenen Päckchen sind ein eigener Teil jeder Störung (e.paeckchen, 12.10.2026). */
  const leereZeile = () => ({ sorte: "", anzahl: "", schacht: "" });
  /* Päckchen-Zeilen im Entwurf: immer mindestens eine (leere) Zeile. Ein Entwurf aus der älteren Fassung hat das Feld nicht –
     seine Päckchen stecken noch im Klemmer und gehen dann mit der Sorte des Klemmers in die Karte über (nichts geht verloren). */
  function paeckchenZeilen(e) {
    if (!Array.isArray(e.paeckchen) || !e.paeckchen.length) {
      const alt = [];
      (e.klemmer || []).forEach((k) => (k && Array.isArray(k.paeckchen) ? k.paeckchen : []).forEach((p) => {
        const schacht = String(p.schacht == null ? "" : p.schacht), anzahl = String(p.anzahl == null ? "" : p.anzahl);
        if (schacht.trim() || anzahl.trim()) alt.push({ sorte: String(k.sorte || ""), anzahl, schacht });
      }));
      e.paeckchen = alt.length ? alt : [leereZeile()];
      (e.klemmer || []).forEach((k) => { if (k) delete k.paeckchen; });
    }
    return e.paeckchen;
  }
  /* ---- Sorte: Kürzel · Name · Packungspreis – nie die interne Sortennummer (Mirko 15.10.2026: „das ist eine interne nummer die soll
     raus bleiben“ – „überall weg“). Namen und Preise aus der Sortentabelle im Konto (+ eigene Namen der Testseite). ---- */
  const nameSchoen = (n) => String(n || "").split(" ").map((w) => (w === "und" ? w : w.length === 1 || !/[aeiouäöüy]/.test(w) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1))).join(" ");
  function sorteInfo(eingabe) {
    const s = R.sorteNorm(eingabe), nr = s ? R.sorteNummer(s) : "";
    const z = nr && sortenListe().find((x) => x.nr === nr);
    if (!z) return null;
    const namen = sprachWissen().namen, name = String(namen[nr] || "").split("|")[0];
    return { nr, kuerzel: z.kuerzel, name: nameSchoen(name), preis: Math.round((z.preis / (z.ps || 1)) * 100) / 100 };
  }
  const sorteZeile = (k) => [k.kuerzel, k.name, euroText(k.preis)].filter(Boolean).join(" · ");
  /* Was im Feld steht: eine alte Nummer wird als Kürzel gezeigt */
  const sorteFeldWert = (eingabe) => { const s = R.sorteNorm(eingabe); return /^\d+$/.test(s) ? (R.sorteKuerzel(s) || String(eingabe || "")) : String(eingabe || ""); };
  function sorteText(eingabe) {
    const s = R.sorteNorm(eingabe);
    if (!s) return "";
    const k = sorteInfo(s);
    if (k) return sorteZeile(k);
    const kz = R.sorteKuerzel(s);
    return kz && R.sorteNummer(s) ? kz : (kz || s) + " – nicht in der Sortentabelle";
  }
  /* Beim Tippen passende Sorten zum Antippen (Mirko 15.10.2026: „wenn man das kürzel eingibt oder lucky zb schreibt sollen alle lucky
     sorten erscheinen, genau so für alle anderen sorten“) – nach Kürzel und Name, höchstens 8 */
  function sortenSuche(eingabe) {
    const q = String(eingabe || "").trim().toLowerCase();
    if (q.length < 2 || /^\d+$/.test(q)) return { treffer: [], mehr: 0 };
    const namen = sprachWissen().namen, liste = sortenListe();
    if (liste.some((x) => x.kuerzel.toLowerCase() === q)) return { treffer: [], mehr: 0 };   // schon ein ganzes Kürzel – die Zeile darunter zeigt es
    const qo = q.replace(/\s+/g, "");
    const rang = (x) => {
      const kz = x.kuerzel.toLowerCase(), n = String(namen[x.nr] || "").toLowerCase().split("|");
      if (kz.startsWith(q)) return 1;
      if (n.some((y) => y.startsWith(q) || y.replace(/\s+/g, "").startsWith(qo))) return 2;
      if (n.some((y) => y.split(" ").some((w) => w.startsWith(q)))) return 3;
      if (kz.includes(q) || n.some((y) => y.includes(q))) return 4;
      return 0;
    };
    const alle = liste.map((x) => ({ x, r: rang(x) })).filter((t) => t.r).sort((a, b) => a.r - b.r || a.x.kuerzel.localeCompare(b.x.kuerzel)).map((t) => sorteInfo(t.x.nr));
    return { treffer: alle.slice(0, 8), mehr: Math.max(0, alle.length - 8) };
  }
  /* Zeile unter dem Feld beim Tippen: gibt es Vorschläge, kein „nicht in der Sortentabelle“ (15.10.2026 auf dem Prüfbild: „LUCKY – nicht in der Sortentabelle“ über den Lucky-Sorten) */
  const sorteHinweis = (wert) => (sortenSuche(wert).treffer.length ? "Passende Sorten – bitte antippen:" : sorteText(wert));
  function sortenWahlHTML(eingabe, ziel, i) {
    const { treffer, mehr } = sortenSuche(eingabe);
    if (!treffer.length) return "";
    return `<div class="st-chips">${treffer.map((k) => `<button class="st-chip" data-st="sorte-wahl" data-sfeld="${ziel}" data-i="${i}" data-wert="${esc(k.kuerzel)}">${esc(sorteZeile(k))}</button>`).join("")}</div>`
      + (mehr ? `<p class="st-klein">… und ${mehr} weitere – genauer tippen</p>` : "");
  }
  AKTIONEN["sorte-wahl"] = (t) => {
    const e = Z.entwurf; if (!e) return;
    const i = Number(t.dataset.i), w = t.dataset.wert;
    /* data-sfeld, nicht data-ziel: das benutzt die Navigation von rieb.js für ihre Kacheln (15.10.2026 gefunden: „RENDER[ziel] is not a function“) */
    if (t.dataset.sfeld === "k") { const p = e.geraet && e.geraet.punkte[i]; if (p) p.sorte = w; }
    else { const z = paeckchenZeilen(e)[i]; if (z) z.sorte = w; }
    entwurfSichern(); zeichneHalten();
  };
  /* ---- Feste Auswahl bei Gerätestörung und Mona-App-Störung (Mirko 12.10.2026) ----
     Draft = gespeichertes Format (regeln.js): e.geraet / e.mona = { punkte: [{ art, nr, sorte, abstreifer, um }], text, textUm, sonstiges }.
     Jeder Punkt bekommt beim Antippen seinen Zeitstempel (um, mit Sekunden); „Sonstiges (in eigenen Worten)“ ist der Text (textUm = Moment des Antippens). */
  const leererTeil = () => ({ punkte: [], text: "", textUm: "", sonstiges: false });
  function neuerPunkt(art) {
    const um = R.lokalIso(new Date());
    if (art === "klemmer") return { art, nr: [], sorte: "", abstreifer: "", um };
    return R.GERAET_ARTEN.some((x) => x.id === art) ? { art, nr: [], um } : { art, um };
  }
  /* Zahlenraster 1-30: Knöpfe wie die übrigen Auswahlknöpfe (gewählt: hell dunkle Fläche, dunkel blauer Schimmer - nie weiß) */
  const raster = (teil, i, gewaehlt, wort) => `<div class="st-raster" role="group" aria-label="${esc(wort)}">${Array.from({ length: R.NUMMERN_MAX }, (_, k) => {
    const n = String(k + 1), an = gewaehlt.includes(n);
    return `<button class="st-nr${an ? " an" : ""}" data-st="nr" data-t="${teil}" data-p="${i}" data-wert="${n}" aria-pressed="${an}">${n}</button>`;
  }).join("")}</div>`;
  const punktKnopf = (teil, wert, text, an) => `<button class="st-punkt${an ? " an" : ""}" data-st="punkt" data-t="${teil}" data-wert="${wert}" aria-pressed="${an}"><span class="st-haken" aria-hidden="true"></span><span>${esc(text)}</span></button>`;
  function klemmerBlock(p, i, mehrere, nr) {
    return `<div class="st-klemmer">
      ${mehrere ? `<div class="st-klemmer-kopf"><span class="ueberschrift">Päckchenklemmer ${nr}</span><button class="knopf-klein" data-st="k-weg" data-p="${i}">Entfernen</button></div>` : ""}
      <span class="ueberschrift">Schacht/Modul/Motor – eine Nummer wählen</span>
      ${raster("geraet", i, p.nr, "Schacht/Modul/Motor")}
      <label class="feld"><span>Sorte (was im Schacht sitzt, freiwillig)</span><input data-kf="sorte" data-p="${i}" value="${esc(sorteFeldWert(p.sorte))}" placeholder="Kürzel oder Name" autocapitalize="characters" autocorrect="off" spellcheck="false" autocomplete="off"></label>
      <p class="st-sorte" id="stSorte${i}">${esc(sorteText(p.sorte))}</p>
      <div class="st-sorten-wahl" id="stSorteWahl${i}"></div>
      <span class="ueberschrift">Abstreifer in diesem Schacht</span>
      <div class="st-chips">${R.ABSTREIFER.map((x) => `<button class="st-chip${p.abstreifer === x.wert ? " an" : ""}" data-st="abstreifer" data-p="${i}" data-wert="${x.wert}" aria-pressed="${p.abstreifer === x.wert}">${esc(x.text)}</button>`).join("")}</div>
    </div>`;
  }
  /* Die Punkte einer Art (teil = "geraet" | "mona") als Knopfliste; unter einem gewählten Punkt steht, was er braucht (Nummern, Sorte, Abstreifer, Text) */
  function auswahlTeil(teil, arten, t) {
    const teile = arten.map((a) => {
      const meine = t.punkte.map((p, i) => [p, i]).filter(([p]) => p.art === a.id), an = meine.length > 0;
      let detail = "";
      if (an && a.id === "klemmer") detail = `<div class="st-klemmer-liste">${meine.map(([p, i], k) => klemmerBlock(p, i, meine.length > 1, k + 1)).join("")}<button class="knopf-klein" data-st="k-neu">+ weiterer Päckchenklemmer</button></div>`;
      else if (an && a.nr) detail = meine.map(([p, i]) => `<div class="st-nummern"><span class="ueberschrift">${esc(a.nrWort)} – eine oder mehrere Nummern wählen</span>${raster(teil, i, p.nr, a.nrWort)}</div>`).join("");
      return punktKnopf(teil, a.id, a.text, an) + detail;
    });
    teile.push(punktKnopf(teil, "sonstiges", R.SONSTIGES_TEXT, !!t.sonstiges)
      + (t.sonstiges ? `<textarea id="${teil === "geraet" ? "stGeraetText" : "stMonaText"}" rows="3" placeholder="In eigenen Worten …">${esc(t.text)}</textarea>` : ""));
    return `<div class="st-auswahl">${teile.join("")}</div>`;
  }
  /* Gefundene Päckchen: eigene Karte unter „Art der Störung“, immer da – egal welche Art gewählt ist */
  function paeckchenKarte(e) {
    return `<div class="karte st-paeckchen"><span class="ueberschrift">Gefundene Päckchen</span>
      <p class="st-klein">Päckchen, die wegen dieser Störung hängen geblieben sind. Schacht nur, wenn eindeutig.</p>
      ${paeckchenZeilen(e).map((p, i) => `<div class="st-gp-zeile"><div class="st-reihe-gp">
        <label class="feld"><span>Sorte</span><input data-gp="sorte" data-i="${i}" value="${esc(sorteFeldWert(p.sorte))}" placeholder="Kürzel oder Name" autocapitalize="characters" autocorrect="off" spellcheck="false" autocomplete="off"></label>
        <label class="feld"><span>Anzahl</span><input data-gp="anzahl" data-i="${i}" value="${esc(p.anzahl)}" inputmode="numeric" autocomplete="off"></label>
        <label class="feld st-gp-schacht"><span>Schacht (wenn klar)</span><input data-gp="schacht" data-i="${i}" value="${esc(p.schacht)}" autocomplete="off"></label>
        <button class="st-weg" data-st="gp-weg" data-i="${i}" aria-label="Zeile entfernen">×</button></div>
        <p class="st-sorte" id="stGpSorte${i}">${esc(sorteText(p.sorte))}</p>
        <div class="st-sorten-wahl" id="stGpSorteWahl${i}"></div></div>`).join("")}
      <button class="knopf-klein" data-st="gp-neu">+ weitere Sorte</button></div>`;
  }
  /* Vorschaubilder einer Sorte; data-i ist die Stelle in Z.fotos (Großansicht und Löschen arbeiten damit), die Nummer im Namen zählt je Sorte */
  const fotoKnoepfe = (zu) => { let k = 0; return Z.fotos.map((f, i) => (f.zu !== zu ? "" : `<button class="st-bild" data-st="foto-gross" data-i="${i}" aria-label="${zu === "mona" ? "Mona-Foto " : "Foto "}${++k} ansehen"><img src="${esc(f.url)}" alt=""></button>`)).join(""); };
  /* Videos (13.10.2026): Vorschau wie ein Foto (72 x 72), mit Abspiel-Zeichen und den Sekunden; nr zählt je Sorte (Video 1, Video 2 / Mona-Video 1 …).
     Ohne Standbild (url leer) bleibt die Fläche mit dem Abspiel-Zeichen. Antippen öffnet den Bogen mit dem Video (video-gross). */
  const videoKachel = (v, nr, url) => `<button class="st-bild st-videobild" data-st="video-gross" data-video="${esc(v.id)}" aria-label="${v.zu === "mona" ? "Mona-Video" : "Video"} ${nr} ansehen">${url ? `<img src="${esc(url)}" alt="">` : ""}<span class="st-play-kreis" aria-hidden="true">${PLAY}</span>${v.dauer ? `<span class="st-dauer">${v.dauer} s</span>` : ""}</button>`;
  const videoKnoepfe = (zu) => { let k = 0; return Z.videos.map((v) => (v.zu !== zu ? "" : videoKachel(v, ++k, v.url))).join(""); };
  /* Unter dem Video-Knopf: „Video wird gelesen …“ solange gelesen wird, und der Hinweis, wenn das Video zu lang war (bleibt stehen, bis das nächste aufgenommen wird) */
  const videoHinweisHTML = (zu) => (Z.videoBusy === zu ? `<p class="st-klein st-video-busy">Video wird gelesen …</p>` : "")
    + (Z.videoHinweis && Z.videoHinweis.zu === zu ? `<p class="st-fehler st-video-hinweis" role="alert">${esc(Z.videoHinweis.text)}</p>` : "");
  /* ---- Spracheingabe (14.10.2026, stoerungen/sprache.js) - freiwillig, oben auf der Seite "Störung" ----
     Mirko: "am besten so, dass man es verwenden kann aber nicht muss, das man die wahl hat zwischen schreiben und sprechen".
     Gesprochen wird über das Mikrofon der iPhone-Tastatur (Apple erkennt; für Störungsmeldungen von Mirko freigegeben, CLAUDE.md).
     Erst "Übernehmen" trägt etwas ein - danach steht alles in den gewohnten Knöpfen und Feldern und kann vor dem Speichern geändert werden.
     Der Zustand hängt am Entwurf (fuer): eine neue Störung beginnt mit leerem Feld; er wird nie mit der Störung gespeichert.
     Lernliste und Sortennamen: dieselben Schlüssel wie die Testseite (Schrägstrich = nicht im Geräte-Abgleich). */
  const SPRACH_KEY = { gelernt: "sprachtest/gelernt", namen: "sprachtest/sorten-namen", varianten: "sprachtest/sorten-varianten" };
  const ladeJson = (k) => { try { return JSON.parse(localStorage.getItem(k) || "{}") || {}; } catch (e) { return {}; } };
  /* Sortentabelle: nur über bestellung/sorten-konto.js (Gerätespeicher bzw. Konto, 15.10.2026) */
  const sortenListe = () => (window.RiebSorten ? window.RiebSorten.liste() : []);
  const spracheDa = () => !!(window.Verstehen && window.StoerSprache && sortenListe().length);
  function sprache() {
    if (!Z.sprache || Z.sprache.fuer !== Z.entwurf) Z.sprache = { fuer: Z.entwurf, text: "", bestaetigt: {}, ergebnis: null };
    return Z.sprache;
  }
  function sprachWissen() {
    const RS = window.RiebSorten;
    const namen = Object.assign({}, RS ? RS.namenEntwurf() : {}, RS ? RS.namenMirko() : {}, ladeJson(SPRACH_KEY.namen));
    Object.keys(namen).forEach((k) => { if (!namen[k]) delete namen[k]; });   // "" = Name gestrichen
    return { liste: sortenListe(), namen, varianten: ladeJson(SPRACH_KEY.varianten) };
  }
  const sprachMeldung = (sp) => window.Verstehen.verstehen(sp.text, ladeJson(SPRACH_KEY.gelernt), sprachWissen());
  const sorteName = (k) => [k.kuerzel, nameSchoen(k.name), k.preis != null ? euroText(k.preis) : ""].filter(Boolean).join(" · ");   // nie die interne Nummer (15.10.2026)
  const euroText = (v) => v.toLocaleString("de-DE", { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 }) + " €";
  const sprachHinweis = (h) => `<p class="st-warn">${H.ic("info")}<span>${esc(h)}</span></p>`;
  function sprachVorschau() {
    const sp = sprache(), e = Z.entwurf;
    if (!sp.text.trim()) return sp.ergebnis ? (sp.ergebnis.neu ? `<p class="st-klein st-sprache-ok">Übernommen – bitte unten prüfen, dann speichern.</p>` : "") + sp.ergebnis.hinweise.map(sprachHinweis).join("") : "";
    const m = sprachMeldung(sp);
    m.sorten.forEach((s) => { s.wahl.kandidaten.forEach((x) => { x.name = nameSchoen(x.name); }); });   // „Gauloises Rot“ statt „gauloises rot“
    m.sorten.forEach((s) => { const nr = sp.bestaetigt[s.text]; const k = nr && s.wahl.kandidaten.find((x) => x.nr === nr); if (k) s.bestaetigt = k; });
    /* Die A-Nummer steht schon fest - sie nur zeigen, wenn etwas anderes gesprochen wurde */
    const zeilen = window.Verstehen.alsZeilen(m, (s) => R.sorteKuerzel(s)).filter(([a]) => a !== "Automat");
    const hinweise = m.hinweise.filter((h) => !/Automatennummer|^Sorte/.test(h));
    if (m.automat && m.automat !== e.a) hinweise.unshift(`Gesprochen wurde ${m.automat} – erfasst wird ${e.a}. Die A-Nummer bleibt ${e.a}.`);
    /* Sorten nach dem Klang, die gewählte immer dabei; Vorschlag = vorgewählt. Mit Vorschlag nur vier (meist stimmt er -
       „Übernehmen“ bleibt nah), ohne Vorschlag acht */
    const wahl = m.sorten.map((s) => {
      const gewaehlt = sp.bestaetigt[s.text] || (s.wahl.vorschlag ? s.wahl.vorschlag.nr : ""), anzahl = gewaehlt ? 4 : 8;
      let k = s.wahl.kandidaten.slice(0, anzahl);
      if (gewaehlt && !k.some((x) => x.nr === gewaehlt)) k = [s.wahl.kandidaten.find((x) => x.nr === gewaehlt)].concat(k.slice(0, anzahl - 1));
      return `<div class="st-sprache-sorte"><span class="ueberschrift">Sorte „${esc(s.text || "?")}“${s.preis != null ? " · " + esc(euroText(s.preis)) : ""}</span>
        ${k.length ? `<div class="st-chips">${k.map((x) => `<button class="st-chip${x.nr === gewaehlt ? " an" : ""}" data-st="sprache-sorte" data-text="${esc(s.text)}" data-wert="${esc(x.nr)}" aria-pressed="${x.nr === gewaehlt}">${esc(sorteName(x))}</button>`).join("")}</div>` : ""}
        <p class="st-klein">${!k.length ? "Keine Sorte zu diesem Preis in der Sortentabelle." : sp.bestaetigt[s.text] ? "Gewählt." : gewaehlt ? "Vorschlag – gilt beim Übernehmen. Andere Sorte? Antippen." : "Bitte die richtige Sorte antippen."} Nicht dabei? Nach dem Übernehmen unten im Feld „Sorte“ eintragen.</p></div>`;
    });
    return (zeilen.length ? `<div class="st-sprache-zeilen">${zeilen.map(([a, b]) => `<div class="st-sprache-zeile"><span>${esc(a)}</span><b>${esc(b)}</b></div>`).join("")}</div>` : "")
      + hinweise.map(sprachHinweis).join("") + wahl.join("")
      + `<div class="st-knoepfe st-sprache-knoepfe"><button class="haupt-knopf" data-st="sprache-uebernehmen">Übernehmen</button><button class="knopf-klein" data-st="sprache-leeren">Leeren</button></div>`;
  }
  function sprechKarte() {
    if (!spracheDa()) return "";
    return `<div class="karte st-sprechen"><span class="ueberschrift">Sprechen (freiwillig)</span>
      <textarea id="stSprache" rows="2" autocomplete="off" placeholder="Antippen, Mikrofon der Tastatur, Störung sprechen – oder unten auswählen.">${esc(sprache().text)}</textarea>
      <div id="stSpracheVorschau">${sprachVorschau()}</div></div>`;
  }
  const vorschauNeu = () => { const v = document.getElementById("stSpracheVorschau"); if (v) v.innerHTML = sprachVorschau(); };
  /* Tippen/Diktieren: nur die Vorschau neu - die Seite NICHT neu zeichnen, sonst endet das Diktat */
  EINGABEN.push((el) => {
    if (el.id !== "stSprache" || !Z.entwurf) return false;
    const sp = sprache(); sp.text = el.value; sp.ergebnis = null;
    vorschauNeu();
    return true;
  });
  /* Sorte antippen: gilt für diese Meldung und wird gemerkt ("so hört Apple diese Sorte") */
  AKTIONEN["sprache-sorte"] = (t) => {
    const sp = sprache(), text = t.dataset.text || "", nr = t.dataset.wert;
    sp.bestaetigt[text] = nr;
    if (text) { const v = ladeJson(SPRACH_KEY.varianten); v[text] = nr; try { localStorage.setItem(SPRACH_KEY.varianten, JSON.stringify(v)); } catch (e) { /* egal */ } }
    vorschauNeu();
  };
  AKTIONEN["sprache-uebernehmen"] = () => {
    const sp = sprache(), e = Z.entwurf; if (!e || !sp.text.trim()) return;
    paeckchenZeilen(e);
    sp.ergebnis = window.StoerSprache.anwenden(e, sprachMeldung(sp), R, R.lokalIso(new Date()), sp.bestaetigt);
    sp.text = ""; sp.bestaetigt = {};
    entwurfSichern(); zeichne();
    /* An den Anfang des Sprechfelds: oben „Übernommen“ und die Hinweise, direkt darunter die angekreuzten Punkte.
       Den alten Scroll-Stand halten hieße: mitten im Zahlenraster landen (die Vorschau ist weg, alles rutscht hoch). */
    const s = sek(), k = s && s.querySelector(".st-sprechen");
    if (k) { s.scrollTop = Math.max(0, s.scrollTop + k.getBoundingClientRect().top - s.getBoundingClientRect().top - 76); H.kopfScroll(s); }
  };
  AKTIONEN["sprache-leeren"] = () => { const sp = sprache(); sp.text = ""; sp.bestaetigt = {}; sp.ergebnis = null; zeichneHalten(); };

  SEITEN.stoerung = () => {
    const e = Z.entwurf; if (!e) return SEITEN.erfassen();
    const g = e.neuerAutomat ? { kuerzel: e.neuerAutomat.kuerzel, ortText: e.neuerAutomat.ort === "innen" ? "innen" : "außen" } : R.geraetInfo(S, e.a);
    const art = (k, titel, inhalt, hinweis) => `<button class="st-schalter${e[k] ? " an" : ""}" data-st="art" data-wert="${k}" aria-pressed="${!!e[k]}"><span class="st-haken" aria-hidden="true"></span>${titel}</button>${e[k] ? inhalt() : (hinweis || "")}`;
    /* Mona-App-Störung: die Punkte, der Text („Sonstiges“), die Kamera und die Mona-Fotos gehören zusammen (Mirko 12.10.2026: „mona fotos bei störung, dann an mona problem anheften nicht an automaten störungen“) */
    const monaTeil = () => auswahlTeil("mona", R.MONA_ARTEN, e.mona) + `
      <div class="st-mona-fotos"><div class="st-aufnahmen"><label class="haupt-knopf st-kamera" for="stKameraMona">${KAMERA}Mona-Problem festhalten</label>
        <label class="haupt-knopf st-kamera" for="stVideoMona">${VIDEO}Mona-Video aufnehmen</label></div>
        <input type="file" id="stKameraMona" class="st-unsichtbar" accept="image/*" capture="environment">
        <input type="file" id="stVideoMona" class="st-unsichtbar" accept="video/*" capture="environment">
        ${videoHinweisHTML("mona")}
        <div class="st-vorschau">${fotoKnoepfe("mona")}${videoKnoepfe("mona")}</div></div>`;
    /* Mona abgewählt, aber Mona-Fotos oder Mona-Videos da: sie bleiben bis zum Speichern (Mona wieder wählen = behalten), dann fallen sie weg – nicht stillschweigend */
    const monaFotos = Z.fotos.some((f) => f.zu === "mona"), monaVideos = Z.videos.some((v) => v.zu === "mona");
    const monaHinweis = monaFotos || monaVideos ? `<p class="st-warn st-mona-hinweis">${H.ic("info")}<span>${monaFotos && monaVideos ? "Mona-Fotos und Mona-Videos werden" : monaVideos ? "Mona-Videos werden" : "Mona-Fotos werden"} beim Speichern entfernt. Mona wieder wählen, um sie zu behalten.</span></p>` : "";
    const kopfKarte = `<div class="karte st-geraet"><div class="st-geraet-zeile"><b>${esc(e.a)}</b> <span>${esc(g.kuerzel)} · ${esc(g.ortText)}${Z.bearbeite ? " · ändern" : ""}</span></div></div>
    ${Z.bearbeite ? bearbeitenKarte(e) : ""}`;
    const schluss = `<div class="karte"><label class="feld"><span>Datum</span><input type="date" id="stDatum" value="${esc(e.tag)}" max="${heute()}"></label></div>
    <p class="st-fehler" id="stFehler" role="alert"></p>
    <div class="st-knoepfe"><button class="haupt-knopf" data-st="speichern">Speichern</button><button class="knopf-klein" data-st="abbrechen">Abbrechen</button></div>`;
    /* Beim Ändern auf "in Ordnung" gestellt: Arten, Klemmer, Fotos fallen beim Speichern weg - vorher sagen */
    if (e.ergebnis === "ok") return kopfKarte + `<p class="st-warn st-ok-hinweis">${H.ic("info")}<span>Als „in Ordnung“ gespeichert, fallen Arten, Punkte, gefundene Päckchen und ${Z.videos.length ? "Fotos und Videos" : "Fotos"} dieser Erfassung weg.</span></p>` + schluss;
    return kopfKarte + sprechKarte() + `
    <div class="karte st-arten"><span class="ueberschrift">Art der Störung</span>
      ${art("geraet", "Gerätestörung", () => auswahlTeil("geraet", R.GERAET_ARTEN, e.geraet))}
      ${art("mona", "Mona-App-Störung", monaTeil, monaHinweis)}
    </div>
    ${paeckchenKarte(e)}
    <div class="karte st-fotos"><span class="ueberschrift">Fotos</span>
      <div class="st-vorschau">${fotoKnoepfe("automat")}${videoKnoepfe("automat")}</div>
      <div class="st-aufnahmen"><label class="haupt-knopf st-kamera" for="stKamera">${KAMERA}Störung festhalten</label>
        <label class="haupt-knopf st-kamera" for="stVideo">${VIDEO}Video aufnehmen</label></div>
      <input type="file" id="stKamera" class="st-unsichtbar" accept="image/*" capture="environment">
      <input type="file" id="stVideo" class="st-unsichtbar" accept="video/*" capture="environment">
      ${videoHinweisHTML("automat")}
    </div>
    <div class="karte"><span class="ueberschrift">Behoben?</span>
      <div class="st-zwei">${[["ja", "Ja", true], ["nein", "Nein", false]].map(([w, t, b]) =>
        `<button class="st-wahl${e.behoben === b ? " an" : ""}" data-st="behoben" data-wert="${w}" aria-pressed="${e.behoben === b}">${t}</button>`).join("")}</div>
    </div>
    ${schluss}`;
  };
  /* Nur beim Ändern (Mirko: "alle Eintragungen müssen bearbeitbar sein"):
     Ergebnis, Uhrzeit, Probeverkauf, Werkstatt-Antwort */
  function bearbeitenKarte(e) {
    const wahl = (st, w, text, an) => `<button class="st-wahl${an ? " an" : ""}" data-st="${st}" data-wert="${w}" aria-pressed="${an}">${text}</button>`;
    const p = e.probeverkauf ? e.probeverkauf.ergebnis : "";
    return `<div class="karte st-bearbeiten"><span class="ueberschrift">Ergebnis</span>
      <div class="st-zwei">${wahl("ergebnis", "ok", "In Ordnung", e.ergebnis === "ok")}${wahl("ergebnis", "stoerung", "Störung", e.ergebnis !== "ok")}</div>
      <label class="feld"><span>Uhrzeit</span><input type="time" id="stUhrzeit" value="${esc(e.uhrzeit)}"></label>
      <span class="ueberschrift">Probeverkauf</span>
      <div class="st-drei">${wahl("probe-wahl", "", "keiner", !p)}${wahl("probe-wahl", "ok", "ok", p === "ok")}${wahl("probe-wahl", "klemmer", "Klemmer", p === "klemmer")}</div>
      ${p === "klemmer" ? `<label class="feld"><span>Schacht (freiwillig)</span><input id="stProbeSchachtE" value="${esc(e.probeverkauf.schacht)}" autocomplete="off"></label>` : ""}
      <span class="ueberschrift">Werkstatt-Antwort</span>
      <div class="st-drei">${wahl("antwort-wahl", "", "keine", !e.werkstattAntwort)}${wahl("antwort-wahl", "bestellt", "bestellt", e.werkstattAntwort === "bestellt")}${wahl("antwort-wahl", "noch_nicht", "noch nicht", e.werkstattAntwort === "noch_nicht")}</div>
    </div>`;
  }
  AKTIONEN.ergebnis = (t) => { Z.entwurf.ergebnis = t.dataset.wert; zeichneHalten(); };
  AKTIONEN["probe-wahl"] = (t) => {
    const w = t.dataset.wert, alt = Z.entwurf.probeverkauf;
    Z.entwurf.probeverkauf = w ? { ergebnis: w, schacht: (alt && alt.schacht) || "" } : null; zeichneHalten();
  };
  AKTIONEN["antwort-wahl"] = (t) => { Z.entwurf.werkstattAntwort = t.dataset.wert || null; zeichneHalten(); };

  AKTIONEN.stoerung = () => {
    const a = aktuellesA(); if (!a) return;
    if (Z.entwurf) {
      /* Dieselbe A-Nummer, neu angefangen: einfach zurück zur angefangenen Störung */
      if (!Z.bearbeite && Z.entwurf.a === a) { Z.ansicht = "stoerung"; zeichne(); return; }
      entwurfFrage(); return;
    }
    fotosFreigeben();
    Z.entwurf = { id: null, a, tag: heute(), uhrzeit: "", ergebnis: "stoerung", geraet: null, mona: null, paeckchen: [leereZeile()], behoben: null,
      probeverkauf: null, werkstattAntwort: null, neuerAutomat: neuerAutomat(a) };
    Z.bearbeite = null; Z.ansicht = "stoerung"; zeichne();
    /* Gleich diktieren (Mirko 15.10.2026: nach „Störung erfassen“ „direkt in ein fenster …, wo ich alles mit der diktierfunktion erfassen
       kann“): Sprechfeld antippen – noch im selben Tipp, sonst öffnet das iPhone die Tastatur nicht. Nur bei einer neuen Störung. */
    const ta = document.getElementById("stSprache"); if (ta) ta.focus({ preventScroll: true });
  };
  /* Art ein/aus: Abwählen verwirft die Punkte, den Text und (beim Speichern) bei Mona die Mona-Fotos */
  AKTIONEN.art = (t) => {
    const e = Z.entwurf, k = t.dataset.wert;
    e[k] = e[k] ? null : leererTeil();
    zeichneHalten();
  };
  /* Punkt ein/aus: Antippen wählt (der Zeitstempel ist dieser Moment), nochmal Antippen nimmt ihn samt Nummern wieder heraus.
     Beim Päckchenklemmer nimmt es alle Klemmer-Blöcke heraus. „Sonstiges“: der Text mit seinem Zeitstempel. */
  AKTIONEN.punkt = (t) => {
    const teil = Z.entwurf[t.dataset.t], art = t.dataset.wert; if (!teil) return;
    if (art === "sonstiges") {
      teil.sonstiges = !teil.sonstiges;
      if (teil.sonstiges) teil.textUm = R.lokalIso(new Date()); else { teil.text = ""; teil.textUm = ""; }
    } else if (teil.punkte.some((p) => p.art === art)) teil.punkte = teil.punkte.filter((p) => p.art !== art);
    else teil.punkte.push(neuerPunkt(art));
    zeichneHalten();
  };
  /* Schacht/Modul-Nummer: Päckchenklemmer genau eine (nochmal Antippen hebt auf), Modul defekt / Motor beliebig viele. Der Punkt behält seinen Zeitstempel. */
  AKTIONEN.nr = (t) => {
    const p = Z.entwurf[t.dataset.t].punkte[Number(t.dataset.p)]; if (!p) return;
    const n = t.dataset.wert, art = R.GERAET_ARTEN.find((x) => x.id === p.art);
    if (art && art.nr === "eine") p.nr = p.nr.includes(n) ? [] : [n];
    else p.nr = (p.nr.includes(n) ? p.nr.filter((x) => x !== n) : p.nr.concat(n)).sort((x, y) => Number(x) - Number(y));
    zeichneHalten();
  };
  AKTIONEN["k-neu"] = () => { Z.entwurf.geraet.punkte.push(neuerPunkt("klemmer")); zeichneHalten(); };
  AKTIONEN["k-weg"] = (t) => { Z.entwurf.geraet.punkte.splice(Number(t.dataset.p), 1); zeichneHalten(); };
  /* Gefundene Päckchen: „+ weitere Sorte“ hängt eine leere Zeile an; „×“ nimmt eine weg – die letzte Zeile wird nur geleert, die Karte behält immer eine */
  AKTIONEN["gp-neu"] = () => { paeckchenZeilen(Z.entwurf).push(leereZeile()); zeichneHalten(); };
  AKTIONEN["gp-weg"] = (t) => {
    const z = paeckchenZeilen(Z.entwurf); z.splice(Number(t.dataset.i), 1);
    if (!z.length) z.push(leereZeile());
    zeichneHalten();
  };
  AKTIONEN.behoben = (t) => { Z.entwurf.behoben = t.dataset.wert === "ja"; zeichneHalten(); };
  /* Abstreifer: ein Tipp wählt, derselbe Tipp nochmal hebt die Wahl auf */
  AKTIONEN.abstreifer = (t) => {
    const k = Z.entwurf.geraet.punkte[Number(t.dataset.p)];
    k.abstreifer = k.abstreifer === t.dataset.wert ? "" : t.dataset.wert;
    zeichneHalten();
  };

  /* Eingaben gehen sofort in den Entwurf - so überlebt alles ein Neuzeichnen.
     Eingaben zeichnen nicht neu, deshalb hier selbst sichern (IndexedDB). */
  EINGABEN.push((el) => {
    const e = Z.entwurf; if (!e) return false;
    const genommen = entwurfEingabe(el, e);
    if (genommen) entwurfSichern();
    return genommen;
  });
  function entwurfEingabe(el, e) {
    if (el.id === "stGeraetText" && e.geraet) { e.geraet.text = el.value; return true; }
    if (el.id === "stMonaText" && e.mona) { e.mona.text = el.value; return true; }
    if (el.id === "stDatum") { e.tag = el.value; return true; }
    if (el.id === "stUhrzeit") { e.uhrzeit = el.value; return true; }
    if (el.id === "stProbeSchachtE" && e.probeverkauf) { e.probeverkauf.schacht = el.value; return true; }
    if (el.dataset.kf !== undefined && e.geraet) {
      const punkt = e.geraet.punkte[Number(el.dataset.p)]; if (!punkt) return false;
      punkt[el.dataset.kf] = el.value;
      if (el.dataset.kf === "sorte") {
        const p = document.getElementById("stSorte" + el.dataset.p); if (p) p.textContent = sorteHinweis(el.value);
        const w = document.getElementById("stSorteWahl" + el.dataset.p); if (w) w.innerHTML = sortenWahlHTML(el.value, "k", el.dataset.p);
      }
      return true;
    }
    if (el.dataset.gp !== undefined) {
      const zeile = paeckchenZeilen(e)[Number(el.dataset.i)]; if (!zeile) return false;
      zeile[el.dataset.gp] = el.value;
      if (el.dataset.gp === "sorte") {
        const p = document.getElementById("stGpSorte" + el.dataset.i); if (p) p.textContent = sorteHinweis(el.value);
        const w = document.getElementById("stGpSorteWahl" + el.dataset.i); if (w) w.innerHTML = sortenWahlHTML(el.value, "gp", el.dataset.i);
      }
      return true;
    }
    return false;
  }

  /* ---- Fotos: verkleinert auf max. 1600 px, JPEG 0,8 ---- */
  function bildUeberImg(datei) {
    return new Promise((res, rej) => { const url = URL.createObjectURL(datei), img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); res(img); }; img.onerror = () => { URL.revokeObjectURL(url); rej(new Error("Bild nicht lesbar")); }; img.src = url; });
  }
  function bildLaden(datei) {
    if (window.createImageBitmap) return createImageBitmap(datei, { imageOrientation: "from-image" }).catch(() => bildUeberImg(datei));
    return bildUeberImg(datei);
  }
  async function verkleinern(datei) {
    const bild = await bildLaden(datei);
    const f = Math.min(1, 1600 / Math.max(bild.width, bild.height));
    const w = Math.round(bild.width * f), h = Math.round(bild.height * f);
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    c.getContext("2d").drawImage(bild, 0, 0, w, h);
    if (bild.close) bild.close();
    return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("Foto nicht speicherbar"))), "image/jpeg", 0.8));
  }
  /* Eine Aufnahme (Kamera oder Auswahl): verkleinern, dem Entwurf anhängen – zu sagt, wohin das Foto gehört. „Störung festhalten“ → „automat“,
     „Mona-Problem festhalten“ → „mona“. Wird der Entwurf während des Verkleinerns gespeichert oder verworfen, wird nichts mehr angehängt
     (die Adresse des Bildes entsteht erst nach dieser Prüfung, es bleibt also keine übrig). */
  async function kameraAufnahme(input, zu) {
    const dateien = Array.from(input.files || []); input.value = "";
    const ent = Z.entwurf; if (!ent) return;
    for (const f of dateien) {
      let blob;
      try { blob = await verkleinern(f); }
      catch (e) { console.error(e); H.toast("Foto konnte nicht gelesen werden"); continue; }
      if (Z.entwurf !== ent) return;
      Z.fotos.push({ id: null, blob, url: URL.createObjectURL(blob), zu, zg: null });
    }
    zeichneHalten();
  }
  AENDERUNGEN.stKamera = (input) => kameraAufnahme(input, "automat");
  AENDERUNGEN.stKameraMona = (input) => kameraAufnahme(input, "mona");
  AKTIONEN["foto-gross"] = (t) => {
    const i = Number(t.dataset.i), f = Z.fotos[i]; if (!f) return;
    const mona = f.zu === "mona", nr = Z.fotos.slice(0, i + 1).filter((x) => x.zu === f.zu).length, name = (mona ? "Mona-Foto " : "Foto ") + nr;
    H.oeffneEbene(H.bogenKopf(name, mona ? "Mona-Problem festhalten" : "Störung festhalten") + `<div class="st-bogen"><img class="st-gross" src="${esc(f.url)}" alt="${name}">
      <button class="knopf-klein st-breit" data-st="foto-weg" data-i="${i}">Foto löschen</button></div>`);
  };
  AKTIONEN["foto-weg"] = (t) => {
    const i = Number(t.dataset.i), f = Z.fotos[i]; if (!f) return;
    if (f.id) Z.wegFotos.push(f.id);
    URL.revokeObjectURL(f.url); Z.fotos.splice(i, 1); H.schliesseEbene(); zeichneHalten();
  };

  /* ---- Videos aufnehmen (13.10.2026) ----
     Länge und Standbild lesen (bericht.js videoLesen, mit Zeitgrenze): über 30 s (+ 1 s Toleranz) wird das Video NICHT übernommen und der Hinweis steht unter dem Knopf;
     lässt sich die Länge nicht lesen, wird übernommen. Das Video kommt sofort in den Speicher „videos“ (erfassung null, entwurf true); der Entwurf merkt sich nur die Id.
     Wird der Entwurf währenddessen gespeichert oder verworfen, bleibt nichts liegen (ein schon abgelegtes Video wird wieder gelöscht). */
  async function videoAufnahme(input, zu) {
    const dateien = Array.from(input.files || []); input.value = "";
    const ent = Z.entwurf; if (!ent || !dateien.length) return;
    Z.videoHinweis = null;
    for (const f of dateien) {
      Z.videoBusy = zu; zeichneHalten();
      const typ = R.videoTyp(f.type, f.name), blob = new Blob([f], { type: typ });
      let gelesen = { dauer: null, standbild: null };
      try { gelesen = await B.videoLesen(blob); } catch (e) { console.error(e); }
      if (Z.entwurf !== ent) return;
      Z.videoBusy = null;
      if (gelesen.dauer != null && gelesen.dauer > R.VIDEO_MAX + R.VIDEO_TOLERANZ) { Z.videoHinweis = { zu, text: R.VIDEO_HINWEIS }; continue; }
      const rec = { id: R.neueId("v"), erfassung: null, entwurf: true, zu, video: blob, typ, dauer: gelesen.dauer == null ? null : Math.max(1, Math.round(gelesen.dauer)),
        standbild: gelesen.standbild || null, erstellt: R.lokalIso(new Date()) };
      try { await D.schreiben("videos", rec); }
      catch (e) { console.error(e); H.toast("Video konnte nicht gespeichert werden: " + (e && e.message ? e.message : String(e))); continue; }
      if (Z.entwurf !== ent) { D.loeschen("videos", rec.id).catch((e) => console.error(e)); return; }
      Z.videos.push(videoEintrag(rec));
    }
    Z.videoBusy = null; zeichneHalten();
    entwurfJetzt();   // sofort sichern: Ein Neuladen vor dem verzögerten Sichern ließe das Video ohne Entwurf zurück (und das Aufräumen löschte es)
  }
  AENDERUNGEN.stVideo = (input) => videoAufnahme(input, "automat");
  AENDERUNGEN.stVideoMona = (input) => videoAufnahme(input, "mona");
  function videoAnhalten() { document.querySelectorAll("#bogenInhalt video").forEach((v) => { try { v.pause(); } catch (e) { /* egal */ } }); }
  document.addEventListener("keydown", (ev) => { if (ev.key === "Escape") videoAnhalten(); });

  /* Das Video als Datei zum Teilen (Name aus regeln.js videosBenannt) - für ein einzelnes Video und für „PDF mit Videos teilen“ */
  const videoDatei = (name, rec) => new File([rec.video], name, { type: rec.typ || rec.video.type || "video/mp4" });

  /* Antippen einer Video-Vorschau. Im Entwurf: Bogen mit Video und „Video löschen“ (Teilen gibt es erst nach dem Speichern - die Daten der Störung stehen vorher nicht fest).
     In der Vorgeschichte: Bogen mit Video, dem Text und „Video teilen“. WICHTIG: Die Datei (File) wird HIER schon fertig gemacht, bevor der Bogen aufgeht - der Tipp auf
     „Video teilen“ ruft dann navigator.share ohne jedes await davor auf (sonst wäre der frische Fingertipp verbraucht, iOS lehnt das Teilen ab). */
  AKTIONEN["video-gross"] = async (t) => {
    const id = t.dataset.video, imEntwurf = !!Z.entwurf && Z.ansicht === "stoerung" && Z.videos.some((v) => v.id === id);
    const rec = await D.holen("videos", id);
    if (!rec) { H.toast("Video nicht gefunden"); return; }
    const url = URL.createObjectURL(rec.video); Z.urls.push(url);
    const mona = R.videoZu(rec) === "mona", art = mona ? "Mona-Video" : "Video";
    const player = `<video class="st-gross st-video-gross" controls playsinline preload="metadata" src="${esc(url)}"></video>`;
    const loeschen = `<button class="knopf-klein st-breit" data-st="video-loeschen" data-video="${esc(id)}">Video löschen</button>`;
    if (imEntwurf) {
      const nr = Z.videos.filter((v) => v.zu === rec.zu).findIndex((v) => v.id === id) + 1;
      H.oeffneEbene(H.bogenKopf(art + " " + nr, mona ? "Mona-Problem festhalten" : "Störung festhalten") + `<div class="st-bogen">${player}
        <p class="st-klein">Teilen geht nach dem Speichern: in der Kartei beim Automaten, in der Vorgeschichte.</p>${loeschen}</div>`);
      return;
    }
    const e = S.erfassungen.find((x) => x.id === rec.erfassung);
    if (!e) { H.oeffneEbene(H.bogenKopf(art, "Vorgeschichte") + `<div class="st-bogen">${player}${loeschen}</div>`); return; }
    const benannt = (await B.videosBenannt(S.erfassungen, e, R.videoZu(rec))).find((b) => b.v.id === id);   // Nummer und Dateiname wie in der Beschriftung im PDF (Zählung je Automat und Tag)
    const datei = videoDatei(benannt.name, rec);
    const text = R.videoText(e, R.geraetInfo(S, e.a), rec);
    Z.datei = { datei, art: "video", text };
    H.oeffneEbene(H.bogenKopf(esc(datei.name), art) + `<div class="st-bogen">${player}
      <p class="st-teiltext">${esc(text)}</p>
      <button class="haupt-knopf" data-st="teilen">Video teilen</button>
      <button class="knopf-klein st-breit" data-st="laden">Als Datei laden</button>${loeschen}</div>`);
  };
  AKTIONEN["video-loeschen"] = (t) => {
    Z.datei = null;
    H.oeffneEbene(H.bogenKopf("Video", "Video löschen?") + `<div class="st-bogen"><p>Dieses Video löschen? Das lässt sich nicht rückgängig machen.</p>
      <div class="st-zwei"><button class="haupt-knopf st-gefahr" data-st="video-loeschen-ok" data-video="${esc(t.dataset.video)}">Löschen</button><button class="knopf-klein" data-zu>Abbrechen</button></div></div>`);
  };
  AKTIONEN["video-loeschen-ok"] = async (t) => {
    const id = t.dataset.video, v = Z.entwurf && Z.ansicht === "stoerung" ? Z.videos.find((x) => x.id === id) : null;
    if (v) {   // im Entwurf: ein neu aufgenommenes Video ist sofort weg, ein schon gespeichertes erst beim Speichern (Abbrechen lässt es stehen) - wie bei den Fotos
      if (v.url) URL.revokeObjectURL(v.url);
      Z.videos = Z.videos.filter((x) => x !== v);
      if (v.gespeichert) Z.wegVideos.push(id); else await D.loeschen("videos", id);
      H.schliesseEbene(); zeichneHalten(); entwurfJetzt();
      return;
    }
    await D.loeschen("videos", id);
    H.schliesseEbene(); H.toast("Video gelöscht"); Z.haltScroll = true; await neuLaden();
  };

  /* ---- Speichern ---- */
  function fotosFreigeben() { Z.fotos.forEach((f) => URL.revokeObjectURL(f.url)); Z.fotos = []; Z.wegFotos = []; videosFreigeben(); }
  /* Nur die Entwurfs-Angaben zu den Videos loslassen (Standbild-Adressen) - gelöscht wird hier nichts (das tun Abbrechen/Verwerfen über neueVideoIds, Speichern über erfassungSpeichern) */
  function videosFreigeben() { Z.videos.forEach((v) => { if (v.url) URL.revokeObjectURL(v.url); }); Z.videos = []; Z.wegVideos = []; Z.videoHinweis = null; Z.videoBusy = null; }
  AKTIONEN.speichern = async () => {
    const e = Z.entwurf; if (!e) return;
    const alt = Z.bearbeite ? S.erfassungen.find((x) => x.id === Z.bearbeite) : null;
    const jetzt = R.lokalIso(new Date());
    const tag = /^\d{4}-\d{2}-\d{2}$/.test(e.tag || "") ? e.tag : heute();
    if (tag > heute()) { H.toast("Datum liegt in der Zukunft"); return; }
    const uhr = /^\d{2}:\d{2}$/.test(e.uhrzeit || "") ? "T" + e.uhrzeit + ":00" : "";   // nur beim Ändern gesetzt
    /* Beim Ändern bleibt die Zeit der Erfassung samt Sekunden stehen, solange Tag und Uhrzeit nicht geändert wurden (die Punkte tragen Sekunden, die Erfassung soll nicht auf :00 rutschen) */
    const zeit = uhr && alt && tag === R.tagVon(alt.zeit) && e.uhrzeit === alt.zeit.slice(11, 16) ? alt.zeit : uhr ? tag + uhr : alt ? (tag === R.tagVon(alt.zeit) ? alt.zeit : tag + alt.zeit.slice(10)) : (tag === heute() ? jetzt : tag + jetzt.slice(10));
    const ok = e.ergebnis === "ok";
    /* Gerätestörung und Mona-App-Störung im neuen Format (regeln.js teilBauen: Klemmer genau eine Nummer, Sorte normiert, Text getrimmt, jeder Punkt mit seinem
       Zeitstempel). Das alte Feld klemmer wird nicht mehr geschrieben - auch eine alte Erfassung verliert es beim Ändern (ihre Klemmer sind dann Punkte). */
    /* „Sonstiges“ zählt nur MIT Text: ein angetipptes, aber leer gelassenes „Sonstiges“ ist weder Punkt noch Text (Brief: dann der Hinweis „… bitte mindestens einen
       Punkt wählen oder in eigenen Worten beschreiben“) und wird nie als „Sonstiges: –“ gespeichert. Nur der Speicherweg: ein unberührter alter Eintrag zählt weiter wie früher. */
    const nurMitText = (t) => Object.assign({}, t, { sonstiges: !!String(t.text || "").trim() });
    const geraet = !ok && e.geraet ? R.teilBauen(R.geraetPunkte({ zeit, geraet: nurMitText(e.geraet) })) : null;
    const mona = !ok && e.mona ? R.teilBauen(R.monaPunkte({ zeit, mona: nurMitText(e.mona) })) : null;
    /* Gefundene Päckchen: Sorte normiert, Anzahl nur als ganze Zahl (alles andere wird NaN und von pruefeErfassung abgewiesen, nie geraten),
       Schacht getrimmt. Völlig leere Zeilen fallen weg; bleibt nichts übrig, steht null da. */
    const gp = ok ? [] : paeckchenZeilen(e).map((p) => {
      const roh = String(p.anzahl == null ? "" : p.anzahl).trim();
      return { sorte: R.sorteNorm(p.sorte), anzahl: /^\d+$/.test(roh) ? Number(roh) : (roh === "" ? 0 : NaN), schacht: String(p.schacht == null ? "" : p.schacht).trim() };
    }).filter((p) => p.sorte || p.schacht || p.anzahl !== 0);
    const paeckchen = gp.length ? gp : null;
    /* behoben am: neue Erfassung -> ihr Tag; beim Ändern erst jetzt auf „behoben“ gestellt -> heute;
       war sie schon behoben -> der alte Tag bleibt */
    const behobenAm = ok || e.behoben !== true ? null : !alt ? tag : alt.behoben === true ? (alt.behobenAm || tag) : heute();
    const erf = Object.assign({}, alt || { probeverkauf: null, werkstattAntwort: null }, {
      id: alt ? alt.id : R.neueId("e"), a: e.a, zeit, ergebnis: ok ? "ok" : "stoerung",
      geraet, mona, klemmer: null, paeckchen,
      behoben: ok ? null : e.behoben, behobenAm },
      /* Beim Ändern gelten auch Probeverkauf und Werkstatt-Antwort aus dem Entwurf */
      alt ? { probeverkauf: e.probeverkauf ? { ergebnis: e.probeverkauf.ergebnis, schacht: String(e.probeverkauf.schacht || "").trim() } : null,
        werkstattAntwort: e.werkstattAntwort || null } : {});
    const fehler = R.pruefeErfassung(erf);
    if (fehler.length) { const p = document.getElementById("stFehler"); if (p) p.textContent = fehler.join(" · "); return; }
    /* Fotos: "in Ordnung" hat keine – die gespeicherten fallen mit weg. Mona-Fotos gehören zum Mona-Problem: ist Mona nicht (mehr) gewählt, fallen sie
       ebenfalls weg (der Hinweis „Mona-Fotos werden beim Speichern entfernt“ stand die ganze Zeit unter dem Schalter). Neue Fotos bekommen ihr zu;
       ein schon gespeichertes Foto, dessen Zuordnung noch nicht gespeichert ist (altes Foto: sie wurde nur aus der Erfassung gelesen), wird mit der
       angezeigten Zuordnung neu geschrieben - so verrutscht es später nicht, wenn sich die Erfassung ändert. */
    const bleibt = (f) => !ok && (f.zu !== "mona" || R.hatMona(erf));
    const neueFotos = Z.fotos.filter((f) => bleibt(f) && (!f.id || f.zg !== f.zu)).map((f) => ({ id: f.id || R.neueId("f"), erfassung: erf.id, bild: f.blob, zu: f.zu }));
    const wegFotos = Z.wegFotos.concat(Z.fotos.filter((f) => f.id && !bleibt(f)).map((f) => f.id));
    /* Videos genauso: Mona-Videos bleiben nur mit Mona, „in Ordnung“ hat keine. Neu aufgenommene (Entwurfs-)Videos werden mit der Erfassung verknüpft; die, die nicht bleiben,
       und die im Entwurf gelöschten, gespeicherten gehen im selben Vorgang weg. */
    const bleibtV = (v) => !ok && (v.zu !== "mona" || R.hatMona(erf));
    const videosVerknuepfen = Z.videos.filter((v) => bleibtV(v) && !v.gespeichert).map((v) => v.id);
    const wegVideos = Z.wegVideos.concat(Z.videos.filter((v) => !bleibtV(v)).map((v) => v.id));
    await D.erfassungSpeichern(erf, { automat: e.neuerAutomat, neueFotos, wegFotos, videosVerknuepfen, wegVideos });
    if (!alt) await tourMerken(e.neuerAutomat || S.automaten.find((x) => x.a === e.a));
    fotosFreigeben(); Z.entwurf = null;
    await entwurfLoeschen();
    if (alt) { Z.bearbeite = null; Z.karteiA = erf.a; Z.ansicht = "automat"; H.toast("Änderung gespeichert"); await neuLaden(); return; }
    S = await D.stand();
    /* über laufenden Zeitraum UND Gedächtnis gezählt; ist die Werkstatt schon bestellt, nur der Hinweis „Werkstatt ist seit … bestellt“ statt der Frage (13.10.2026) */
    const hinweis = R.werkstattHinweis(S.erfassungen.concat(S.frueher), S.werkstatt, erf);
    await nachErfassung(erf, hinweis && !hinweis.frage ? "Störung gespeichert · " + hinweis.text : "Störung gespeichert");
    if (hinweis && hinweis.frage) H.oeffneEbene(H.bogenKopf(esc(erf.a), "Werkstatt bestellen?") + `<div class="st-bogen"><p class="st-hinweis-text">${esc(hinweis.text)}</p>
      <div class="st-zwei"><button class="haupt-knopf" data-st="werkstatt-antwort" data-id="${esc(erf.id)}" data-wert="bestellt">Werkstatt bestellt</button>
      <button class="knopf-klein" data-st="werkstatt-antwort" data-id="${esc(erf.id)}" data-wert="noch_nicht">Noch nicht</button></div></div>`);
  };
  AKTIONEN.abbrechen = async () => {
    const a = Z.entwurf ? Z.entwurf.a : null, weg = neueVideoIds();   // aufgenommene, noch nicht gespeicherte Videos gehen mit dem Abbrechen weg
    fotosFreigeben(); Z.entwurf = null;
    if (Z.bearbeite) { Z.ansicht = "automat"; Z.karteiA = a; } else Z.ansicht = "erfassen";   // A-Nummer bleibt stehen
    Z.bearbeite = null;
    zeichne();
    await entwurfLoeschen();
    await D.videosLoeschen(weg);
  };
  AKTIONEN["werkstatt-antwort"] = async (t) => {
    const e = S.erfassungen.find((x) => x.id === t.dataset.id) || await D.holen("erfassungen", t.dataset.id); if (!e) return;
    const bestellt = t.dataset.wert === "bestellt";
    await D.schreiben("erfassungen", Object.assign({}, e, { werkstattAntwort: bestellt ? "bestellt" : "noch_nicht" }));
    H.schliesseEbene(); H.toast(bestellt ? "Vermerkt: Werkstatt bestellt" : "Vermerkt: noch nicht bestellt"); Z.haltScroll = true; await neuLaden();
  };

  /* ================= Teil 3: Kartei, Vorgeschichte, Listen ================= */
  SEITEN.kartei = () => {
    const touren = Array.from(new Set(S.automaten.map((m) => m.tour || ""))).filter(Boolean).sort((x, y) => Number(x) - Number(y) || (x < y ? -1 : 1));
    if (Z.tourFilter && !touren.includes(Z.tourFilter)) Z.tourFilter = "";
    const k = R.kartei(S).filter((z) => !Z.tourFilter || z.tour === Z.tourFilter);
    /* Automaten, die nur noch im Gedächtnis stehen (13.10.2026): aufklappbar unter der Kartei, grau – die Kartei selbst zeigt nur den laufenden Zeitraum */
    const fr = R.karteiFrueher(S).filter((z) => !Z.tourFilter || z.tour === Z.tourFilter);
    const filter = `<label class="feld st-tourfilter"><span>Tour</span><select id="stTourFilter"><option value="">Alle Touren</option>${touren.map((t) =>
      `<option value="${esc(t)}"${Z.tourFilter === t ? " selected" : ""}>Tour ${esc(t)}</option>`).join("")}</select></label>`;
    const frueherTeil = !fr.length ? "" : `<button class="knopf-klein st-breit st-frueher-knopf" data-st="frueher-zeigen">${Z.frueherOffen ? "Frühere ausblenden" : "Nur aus früheren Zeiträumen: " + mz(fr.length, "Automat", "Automaten")}</button>`
      + (Z.frueherOffen ? `<div class="st-liste st-frueher-liste">${fr.map((z) => `
      <button class="karte st-zeile st-frueher-zeile-karte" data-st="automat" data-a="${esc(z.a)}">
        <span class="st-zeile-kopf"><b>${esc(z.a)}</b> <span>Tour ${esc(z.tour || "?")} · ${esc(z.kuerzel)}${z.werkstattModell ? " · " + esc(z.werkstattModell) : ""} · ${esc(z.ortText)}</span></span>
        <span class="st-klein">Früher: ${mz(z.frueherStoerungen, "Störung", "Störungen")} · zuletzt ${esc(R.datumLang(z.letzte))}</span>
      </button>`).join("")}</div>` : "");
    return `<div class="st-leiste">${filter}<button class="knopf-klein" data-st="listen">Listen pflegen</button></div>` + (k.length ? `<div class="st-liste">${k.map((z) => `
      <button class="karte st-zeile" data-st="automat" data-a="${esc(z.a)}">
        <span class="st-zeile-kopf"><b>${esc(z.a)}</b> <span>Tour ${esc(z.tour || "?")} · ${esc(z.kuerzel)}${z.werkstattModell ? " · " + esc(z.werkstattModell) : ""} · ${esc(z.ortText)}</span></span>
        <span class="st-zahlen"><span class="${z.stoerungen ? "st-rot" : ""}">${z.stoerungen} ${z.stoerungen === 1 ? "Störung" : "Störungen"}</span> <span>${z.klemmer} Klemmer</span> <span>${z.paeckchen} Päckchen</span> <span>${z.mona} Mona</span> <span>${z.erfassungen} erfasst</span></span>
        <span class="st-klein">${z.letzteWerkstatt ? "Werkstatt zuletzt " + esc(R.datumLang(z.letzteWerkstatt)) : "Noch kein Werkstattbesuch"}</span>
      </button>`).join("")}</div>` : `<p class="st-tipp">${Z.tourFilter ? "Auf dieser Tour noch keine Automaten." : S.frueher.length ? "Im laufenden Zeitraum noch nichts erfasst." : "Noch keine Automaten erfasst."}</p>`) + frueherTeil;
  };
  AKTIONEN["frueher-zeigen"] = () => { Z.frueherOffen = !Z.frueherOffen; zeichneHalten(); };
  AENDERUNGEN.stTourFilter = (el) => { Z.tourFilter = el.value; zeichneHalten(); };
  /* Jeder Punkt (auch ein alter Klemmer oder der alte Text) steht als eigene Zeile mit Uhrzeit (Sekunden) und ×: Antippen fragt nach und löscht nur diesen Punkt */
  /* nurLesen (13.10.2026): Besuche aus abgeschlossenen Zeiträumen stehen nur zum Ansehen da – ohne × */
  function eintragText(e, nurLesen) {
    const z = [];
    const punkte = (titel, wo, liste) => {
      if (!liste.length) return;
      z.push(`<div class="st-punkte"><b>${titel}</b>` + liste.map((p, i) => {
        const einz = R.punktEinzelheiten(p), text = R.punktText(p) + (einz.length ? ", " + einz.join(", ") : "");
        return `<div class="st-punkt-zeile"><span class="st-punkt-text"><span class="st-uhr">${esc(R.punktZeit(p, e))}</span> <span>${esc(text)}</span></span>
          ${nurLesen ? "" : `<button class="st-weg" data-st="punkt-weg" data-id="${esc(e.id)}" data-wo="${wo}" data-i="${i}" aria-label="Störung löschen: ${esc(R.punktText(p))}">×</button>`}</div>`;
      }).join("") + `</div>`);
    };
    punkte("Gerätestörung", "geraet", R.geraetPunkte(e));
    punkte("Mona-App-Störung", "mona", R.monaPunkte(e));
    /* Gefundene Päckchen – neue Zeilen der Erfassung und alte aus dem Klemmer (mit dessen Sorte) */
    const summe = R.paeckchenSumme(e);
    if (summe > 0) z.push("<div><b>Gefundene Päckchen:</b> " + esc(R.paeckchenText(R.gefundenePaeckchen(e))) + " · zusammen " + summe + "</div>");
    if (e.ergebnis === "stoerung") z.push("<div><b>Behoben:</b> " + (e.behoben ? "ja" + (e.behobenAm ? " (" + esc(R.datumLang(e.behobenAm)) + ")" : "") : "nein") + "</div>");
    if (e.probeverkauf) z.push("<div><b>Probeverkauf:</b> " + (e.probeverkauf.ergebnis === "ok" ? "ok" : "Klemmer" + (e.probeverkauf.schacht ? " Schacht " + esc(e.probeverkauf.schacht) : "")) + "</div>");
    if (e.werkstattAntwort) z.push("<div><b>Werkstatt:</b> " + (e.werkstattAntwort === "bestellt" ? "bestellt" : "noch nicht bestellt") + "</div>");
    return z.length ? `<div class="st-text">${z.join("\n")}</div>` : "";
  }
  SEITEN.automat = () => {
    const a = Z.karteiA; if (!a) return SEITEN.kartei();
    const g = R.geraetInfo(S, a);
    const eig = S.erfassungen.filter((e) => e.a === a).sort((x, y) => (x.zeit < y.zeit ? 1 : -1));
    const frueher = S.frueher.filter((e) => e.a === a).sort((x, y) => (x.zeit < y.zeit ? 1 : -1));   // Gedächtnis (13.10.2026): alle abgeschlossenen Besuche, nur ansehen
    const werk = S.werkstatt.filter((w) => w.a === a).sort((x, y) => (x.erfasstUm < y.erfasstUm ? 1 : -1));
    return `<div class="st-leiste"><button class="knopf-klein" data-st="ansicht" data-wert="kartei">${H.ic("zurueck")}Kartei</button><span></span></div>
    <div class="karte st-geraet"><div class="st-geraet-zeile"><b>${esc(a)}</b> <span>Tour ${esc(g.tour || "?")} · ${esc(g.kuerzel)} · ${esc(g.hersteller)} · ${esc(g.ortText)}</span></div>
      <p class="st-klein">Werkstatt-Modell: ${g.werkstattModell ? esc(g.werkstattModell) : "nicht eingetragen"}</p>
      <div class="st-eintrag-knoepfe"><button class="knopf-klein" data-st="automat-aendern" data-a="${esc(a)}">Ändern / Werkstatt-Modell nachtragen</button>
        <button class="knopf-klein" data-st="automat-pdf" data-a="${esc(a)}">PDF für diesen Automaten</button>
        <button class="knopf-klein" data-st="automat-loeschen" data-a="${esc(a)}">Automat löschen</button></div></div>
    ${werk.length ? `<div class="karte"><span class="ueberschrift">Werkstatt</span>${werk.map((w) => `<div class="st-werk-zeile">
      <span>${w.datum ? "Besuch am " + esc(R.datumLang(w.datum)) : "Hinweis gefunden am " + esc(R.datumLang(w.erfasstUm)) + " (Datum unbekannt)"}</span>
      <span class="st-eintrag-knoepfe"><button class="knopf-klein" data-st="w-aendern" data-id="${esc(w.id)}">Ändern</button>
        <button class="knopf-klein" data-st="w-loeschen" data-id="${esc(w.id)}">Löschen</button></span></div>`).join("")}</div>` : ""}
    <span class="ueberschrift st-abstand">Vorgeschichte</span>
    ${eig.map((e) => `<div class="karte st-eintrag" data-erf="${esc(e.id)}">
      <div class="st-eintrag-kopf"><b>${esc(R.datumLang(e.zeit))} · ${esc(e.zeit.slice(11, 16))}</b><span class="st-marke ${esc(e.ergebnis)}">${e.ergebnis === "ok" ? "in Ordnung" : "Störung"}</span></div>
      ${eintragText(e)}
      <div class="st-vorschau" data-fotos="${esc(e.id)}" data-zu="automat"></div>
      <div class="st-vorschau" data-videos="${esc(e.id)}" data-zu="automat"></div>
      <div class="st-foto-gruppe"></div>
      <div class="st-eintrag-knoepfe"><button class="knopf-klein" data-st="erf-aendern" data-id="${esc(e.id)}">Ändern</button>
        <button class="knopf-klein" data-st="erf-anr" data-id="${esc(e.id)}">A-Nummer</button>
        <button class="knopf-klein" data-st="erf-loeschen" data-id="${esc(e.id)}">Löschen</button></div>
    </div>`).join("") || `<p class="st-tipp">${frueher.length ? "Im laufenden Zeitraum keine Erfassungen." : "Keine Erfassungen."}</p>`}
    ${frueher.length ? `<span class="ueberschrift st-abstand st-frueher-titel">Früher (abgeschlossene Zeiträume)</span>
    ${frueher.map((e) => `<div class="karte st-eintrag st-frueher-eintrag" data-erf="${esc(e.id)}">
      <div class="st-eintrag-kopf"><b>${esc(R.datumLang(e.zeit))} · ${esc(e.zeit.slice(11, 16))}</b><span class="st-marke ${esc(e.ergebnis)}">${e.ergebnis === "ok" ? "in Ordnung" : "Störung"}</span></div>
      ${eintragText(e, true)}
      <p class="st-klein">Zeitraum abgeschlossen am ${esc(R.datumLang(e.abgeschlossen))}</p>
      <div class="st-vorschau" data-fotos="${esc(e.id)}" data-zu="automat"></div>
      <div class="st-vorschau" data-videos="${esc(e.id)}" data-zu="automat"></div>
      <div class="st-foto-gruppe"></div>
    </div>`).join("")}` : ""}`;
  };
  /* Fotos der Vorgeschichte: Automaten-Fotos wie bisher unter dem Text; Mona-Fotos darunter mit der kleinen Beschriftung „Mona“ – nur wenn es welche gibt
     (Mirko 12.10.2026: Mona-Fotos an das Mona-Problem heften, nicht an die Automatenstörung). Die Zuordnung kommt aus regeln.js fotoZu.
     Videos (13.10.2026) stehen direkt unter den Fotos: Automaten-Videos in einer eigenen Reihe unter den Automaten-Fotos, Mona-Videos in der Mona-Gruppe unter den Mona-Fotos
     (die Beschriftung „Mona“ steht auch, wenn es nur ein Mona-Video gibt). Die Nummer („Video 2 ansehen“) zählt je Sorte in der Reihenfolge der Aufnahme. */
  const bildKnopf = (f, u) => `<button class="st-bild" data-st="bild-gross" data-url="${esc(u)}" data-foto="${esc(f.id)}" aria-label="Foto ansehen"><img src="${esc(u)}" alt=""></button>`;
  NACH_ZEICHNEN.push(async () => {
    if (Z.ansicht !== "automat") return;
    const nr = Z.zeichnung, ziel = Z.scrollZiel;
    for (const box of document.querySelectorAll("#s-stoerungen [data-fotos]")) {
      const id = box.dataset.fotos, erf = S.erfassungen.find((x) => x.id === id) || S.frueher.find((x) => x.id === id);
      const fotos = await D.fotosZu(id);
      if (nr !== Z.zeichnung) return;   // inzwischen neu gezeichnet - diese Kästen hängen nicht mehr im Bild
      const bild = (f) => { const u = URL.createObjectURL(f.bild); Z.urls.push(u); return bildKnopf(f, u); };
      const mona = fotos.filter((f) => R.fotoZu(f, erf) === "mona");
      box.innerHTML = fotos.filter((f) => R.fotoZu(f, erf) !== "mona").map(bild).join("");
      const videos = R.videosGeordnet(await D.videosZu(id));
      if (nr !== Z.zeichnung) return;
      const kachel = (zu) => { let k = 0; return videos.filter((v) => R.videoZu(v) === zu).map((v) => { const u = v.standbild ? URL.createObjectURL(v.standbild) : null; if (u) Z.urls.push(u); return videoKachel({ id: v.id, zu, dauer: v.dauer }, ++k, u); }).join(""); };
      const autoVideos = box.parentElement.querySelector('[data-videos][data-zu="automat"]'), monaVideos = kachel("mona");   // kein id im Selektor: eine Id mit Sonderzeichen würde ihn ungültig machen
      if (autoVideos) autoVideos.innerHTML = kachel("automat");
      const gruppe = box.parentElement.querySelector(".st-foto-gruppe");
      if (gruppe) gruppe.innerHTML = mona.length || monaVideos ? `<span class="st-klein">Mona</span>` + (mona.length ? `<div class="st-vorschau" data-fotos="${esc(id)}" data-zu="mona">${mona.map(bild).join("")}</div>` : "")
        + (monaVideos ? `<div class="st-vorschau" data-videos="${esc(id)}" data-zu="mona">${monaVideos}</div>` : "") : "";
    }
    /* Erst mit den Fotos ist die Seite so lang wie vorher: den gehaltenen Scroll-Stand jetzt setzen */
    const s = sek();
    if (ziel && s) { s.scrollTop = ziel; H.kopfScroll(s); }
  });
  AKTIONEN.automat = (t) => { Z.karteiA = t.dataset.a; Z.ansicht = "automat"; zeichne(); };
  /* Foto groß - und einzeln löschbar (mit Rückfrage) */
  AKTIONEN["bild-gross"] = (t) => H.oeffneEbene(H.bogenKopf("Foto", "Vorgeschichte") + `<div class="st-bogen"><img class="st-gross" src="${esc(t.dataset.url)}" alt="Foto">
    <button class="knopf-klein st-breit" data-st="foto-loeschen" data-foto="${esc(t.dataset.foto)}">Foto löschen</button></div>`);
  AKTIONEN["foto-loeschen"] = (t) => H.oeffneEbene(H.bogenKopf("Foto", "Foto löschen?") + `<div class="st-bogen"><p>Dieses Foto löschen? Das lässt sich nicht rückgängig machen.</p>
    <div class="st-zwei"><button class="haupt-knopf st-gefahr" data-st="foto-loeschen-ok" data-foto="${esc(t.dataset.foto)}">Löschen</button><button class="knopf-klein" data-zu>Abbrechen</button></div></div>`);
  AKTIONEN["foto-loeschen-ok"] = async (t) => { await D.loeschen("fotos", t.dataset.foto); H.schliesseEbene(); H.toast("Foto gelöscht"); Z.haltScroll = true; await neuLaden(); };
  /* Automat löschen - samt allem, was zu ihm gehört (Rückfrage nennt die Anzahl) */
  AKTIONEN["automat-loeschen"] = (t) => {
    const a = t.dataset.a, n = S.erfassungen.concat(S.frueher).filter((e) => e.a === a).length, w = S.werkstatt.filter((x) => x.a === a).length;   // samt Gedächtnis (daten.js automatLoeschen nimmt alles)
    H.oeffneEbene(H.bogenKopf(esc(a), "Automat löschen?") + `<div class="st-bogen">
      <p>${esc(a)} mit <b>${n} ${n === 1 ? "Erfassung" : "Erfassungen"}</b>, ${w} ${w === 1 ? "Werkstatt-Eintrag" : "Werkstatt-Einträgen"} und allen Fotos und Videos löschen? Das lässt sich nicht rückgängig machen.</p>
      <div class="st-zwei"><button class="haupt-knopf st-gefahr" data-st="automat-loeschen-ok" data-a="${esc(a)}">Löschen</button><button class="knopf-klein" data-zu>Abbrechen</button></div></div>`);
  };
  AKTIONEN["automat-loeschen-ok"] = async (t) => {
    await D.automatLoeschen(t.dataset.a); H.schliesseEbene(); H.toast("Automat gelöscht");
    Z.karteiA = null; Z.ansicht = "kartei"; await neuLaden();
  };

  /* Automat ändern: Kürzel, Standort, Werkstatt-Modell (freiwillig) */
  AKTIONEN["automat-aendern"] = (t) => {
    const m = S.automaten.find((x) => x.a === t.dataset.a); if (!m) return;
    const gruppen = {};
    S.werkstattModelle.forEach((w) => { (gruppen[w.hersteller] = gruppen[w.hersteller] || []).push(w); });
    H.oeffneEbene(H.bogenKopf(esc(m.a), "Automat ändern") + `<div class="st-bogen">
      <label class="feld"><span>Kürzel vom Verkaufsbericht</span><select id="stAeKuerzel">${S.kuerzel.map((k) => `<option value="${esc(k.kuerzel)}"${k.kuerzel === m.kuerzel ? " selected" : ""}>${esc(k.kuerzel)} (${esc(k.hersteller)})</option>`).join("")}</select></label>
      <label class="feld"><span>Standort</span><select id="stAeOrt"><option value="innen"${m.ort === "innen" ? " selected" : ""}>Innengerät</option><option value="aussen"${m.ort === "aussen" ? " selected" : ""}>Außengerät</option></select></label>
      <label class="feld"><span>Tour-Nr.</span><input id="stAeTour" inputmode="numeric" autocomplete="off" value="${esc(m.tour || "")}"></label>
      <label class="feld"><span>Modell laut Werkstatt (freiwillig)</span><select id="stAeWerkstatt"><option value="">weiß nicht</option>
        ${Object.entries(gruppen).map(([h, l]) => `<optgroup label="${esc(h)}">${l.map((w) => `<option value="${esc(w.id)}"${w.id === m.werkstattModell ? " selected" : ""}>${esc(w.modell)}</option>`).join("")}</optgroup>`).join("")}</select></label>
      <button class="haupt-knopf" data-st="automat-aendern-ok" data-a="${esc(m.a)}">Speichern</button></div>`);
  };
  AKTIONEN["automat-aendern-ok"] = async (t) => {
    const m = S.automaten.find((x) => x.a === t.dataset.a); if (!m) return;
    await D.schreiben("automaten", Object.assign({}, m, { kuerzel: wert("stAeKuerzel") || m.kuerzel, ort: wert("stAeOrt") || m.ort,
      tour: wert("stAeTour") || m.tour || "", werkstattModell: wert("stAeWerkstatt") || null }));
    H.schliesseEbene(); H.toast("Automat gespeichert"); Z.haltScroll = true; await neuLaden();
  };

  /* Erfassung ändern -> Bildschirm Störung mit den alten Werten */
  AKTIONEN["erf-aendern"] = async (t) => {
    const e = S.erfassungen.find((x) => x.id === t.dataset.id); if (!e) return;
    if (Z.entwurf) { entwurfFrage(); return; }   // angefangene Störung nicht stillschweigend ersetzen
    const fotos = await D.fotosZu(e.id), videos = R.videosGeordnet(await D.videosZu(e.id));
    if (Z.entwurf) return;
    fotosFreigeben();
    /* Gerät und Mona als Punkte (regeln.js teileNeu): ein alter Eintrag wird hier schon als Punkte gezeigt, jeder Punkt behält seinen Zeitstempel */
    const teile = R.teileNeu(e);
    Z.entwurf = { id: e.id, a: e.a, tag: R.tagVon(e.zeit), uhrzeit: e.zeit.slice(11, 16), ergebnis: e.ergebnis,
      geraet: teile.geraet, mona: teile.mona,
      /* gefundene Päckchen: die neuen Zeilen der Erfassung, dazu die alten aus dem Klemmer (mit der Sorte des Klemmers) – beim Speichern liegen alle im neuen Teil */
      paeckchen: (() => { const l = R.gefundenePaeckchen(e).map((p) => ({ sorte: p.sorte, anzahl: String(p.anzahl), schacht: p.schacht })); return l.length ? l : [leereZeile()]; })(),
      behoben: e.behoben, probeverkauf: e.probeverkauf ? { ergebnis: e.probeverkauf.ergebnis, schacht: e.probeverkauf.schacht || "" } : null,
      werkstattAntwort: e.werkstattAntwort || null, neuerAutomat: null };
    /* zu: gespeicherte Zuordnung, bei alten Fotos ohne Zuordnung die Lesart aus der Erfassung (regeln.js fotoZu); zg: was wirklich gespeichert ist */
    Z.fotos = fotos.map((f) => ({ id: f.id, blob: f.bild, url: URL.createObjectURL(f.bild), zu: R.fotoZu(f, e), zg: f.zu === "automat" || f.zu === "mona" ? f.zu : null })); Z.wegFotos = [];
    Z.videos = videos.map(videoEintrag); Z.wegVideos = [];   // die schon gespeicherten Videos der Erfassung (gespeichert: true) - nur Angaben, nie das Video selbst
    Z.bearbeite = e.id; Z.ansicht = "stoerung"; zeichne();
  };
  /* Vertippte A-Nummer korrigieren */
  AKTIONEN["erf-anr"] = (t) => {
    const e = S.erfassungen.find((x) => x.id === t.dataset.id); if (!e) return;
    H.oeffneEbene(H.bogenKopf(esc(R.datumLang(e.zeit)), "A-Nummer korrigieren") + `<div class="st-bogen">
      <label class="feld"><span>Richtige A-Nummer (sechs Ziffern nach dem A)</span><input id="stNeuANr" inputmode="numeric" maxlength="6" autocomplete="off" value="${esc(e.a.slice(1))}"></label>
      <p class="st-klein">Ist die Nummer noch nicht in der Kartei, wird sie mit Kürzel und Standort von ${esc(e.a)} angelegt.</p>
      <button class="haupt-knopf" data-st="erf-anr-ok" data-id="${esc(e.id)}">Übernehmen</button></div>`);
  };
  AKTIONEN["erf-anr-ok"] = async (t) => {
    const z = R.ziffernAus(wert("stNeuANr"));
    if (!R.aNummerGueltig(z)) { H.toast("Bitte genau sechs Ziffern"); return; }
    const e = S.erfassungen.find((x) => x.id === t.dataset.id); if (!e) return;
    const neuA = R.aNummer(z);
    if (neuA !== e.a) await D.aNummerUmziehen(e.id, neuA, S.automaten.find((m) => m.a === e.a));
    H.schliesseEbene(); H.toast("A-Nummer geändert"); Z.karteiA = neuA; await neuLaden();
  };
  /* Knöpfe unter „Besuch / Erfassung löschen?“. Ist es der LETZTE Besuch des Automaten, verschwindet der Automat mit aus der Kartei – das steht in der Frage.
     Mirko 13.10.2026: gelöschte Beispiele standen sonst als leere Karte (A-Nummer ohne Werte) weiter in der Kartei; „nur den besuch löschen bringt nichts …
     jeder automat hat eine eigene nummer, ich will ja nicht alle einpflegen, sondern über ein gewisses zeitfenster sammeln, auswerten, neu anfangen“.
     Derselbe Weg wie „Automat löschen“ auf der Karte (automat-loeschen-ok: samt Werkstatt-Einträgen, zurück in die Kartei). */
  function besuchLoeschenKnoepfe(e) {
    /* „letzter Besuch“ zählt das Gedächtnis mit: Hat der Automat frühere Besuche, bleibt er (mit seinem Gedächtnis) stehen */
    const letzter = !S.erfassungen.concat(S.frueher).some((x) => x.a === e.a && x.id !== e.id), w = S.werkstatt.filter((x) => x.a === e.a).length;
    const hinweis = letzter ? `<p class="st-letzter-besuch">Das ist der letzte Besuch von <b>${esc(e.a)}</b>. Der Automat verschwindet damit auch aus der Kartei${w ? ` (samt ${w} ${w === 1 ? "Werkstatt-Eintrag" : "Werkstatt-Einträgen"})` : ""}.</p>` : "";
    const knopf = letzter ? `data-st="automat-loeschen-ok" data-a="${esc(e.a)}"` : `data-st="erf-loeschen-ok" data-id="${esc(e.id)}"`;
    return `${hinweis}<div class="st-zwei"><button class="haupt-knopf st-gefahr" ${knopf}>Löschen</button><button class="knopf-klein" data-zu>Abbrechen</button></div>`;
  }
  AKTIONEN["erf-loeschen"] = (t) => {
    const e = S.erfassungen.find((x) => x.id === t.dataset.id); if (!e) return;
    H.oeffneEbene(H.bogenKopf(esc(e.a), "Erfassung löschen?") + `<div class="st-bogen">
      <p>Erfassung vom ${esc(R.datumLang(e.zeit))}, ${esc(e.zeit.slice(11, 16))} Uhr, mit allen Fotos und Videos löschen? Das lässt sich nicht rückgängig machen.</p>
      ${besuchLoeschenKnoepfe(e)}</div>`);
  };
  AKTIONEN["erf-loeschen-ok"] = async (t) => { await D.erfassungLoeschen(t.dataset.id); H.schliesseEbene(); H.toast("Erfassung gelöscht"); Z.haltScroll = true; await neuLaden(); };

  /* Einzelne Störung löschen (Mirko 12.10.2026: „einzelne störungen auch einzeln löschen können“): × an einem Punkt -> Rückfrage -> nur dieser Punkt fällt weg,
     die Erfassung wird gespeichert (eine ALTE Erfassung dabei im neuen Format, regeln.js punktEntfernen). Bliebe weder Geräte- noch Mona-Angabe übrig, wird
     stattdessen der ganze Besuch angeboten. Fällt der letzte Mona-Punkt weg, gehen die Mona-Fotos des Besuchs mit (sie gehören zum Mona-Problem) - das steht in der Frage. */
  AKTIONEN["punkt-weg"] = async (t) => {
    const e = S.erfassungen.find((x) => x.id === t.dataset.id); if (!e) return;
    const wo = t.dataset.wo, i = Number(t.dataset.i), neu = R.punktEntfernen(e, wo, i); if (!neu) return;
    const p = (wo === "mona" ? R.monaPunkte(e) : R.geraetPunkte(e))[i];
    if (!R.geraetPunkte(neu).length && !R.monaPunkte(neu).length) {
      const pk = R.paeckchenSumme(e);
      H.oeffneEbene(H.bogenKopf(esc(e.a), "Besuch löschen?") + `<div class="st-bogen"><p>Das ist die letzte Störung dieses Besuchs. Ganzen Besuch mit allen Fotos und Videos löschen?</p>
        ${pk > 0 ? `<p>Die gefundenen Päckchen dieses Besuchs (${pk}) gehen dabei mit verloren.</p>` : ""}
        ${besuchLoeschenKnoepfe(e)}</div>`);
      return;
    }
    const letzterMona = wo === "mona" && !R.hatMona(neu);
    const monaFotos = letzterMona ? (await D.fotosZu(e.id)).filter((f) => f.zu === "mona").length : 0;
    const monaVideos = letzterMona ? (await D.videosZu(e.id)).filter((v) => R.videoZu(v) === "mona").length : 0;
    const mitgeloescht = [monaFotos ? monaFotos + " Mona-Foto" + (monaFotos === 1 ? "" : "s") : "", monaVideos ? monaVideos + " Mona-Video" + (monaVideos === 1 ? "" : "s") : ""].filter(Boolean), nMit = monaFotos + monaVideos;
    H.oeffneEbene(H.bogenKopf(esc(e.a), "Störung löschen?") + `<div class="st-bogen"><p>Diese Störung löschen? <b>${esc(R.punktText(p))}</b></p>
      ${nMit ? `<p>Dazu ${nMit === 1 ? "gehört" : "gehören"} ${mitgeloescht.join(" und ")} – ${nMit === 1 ? "es wird" : "sie werden"} mit gelöscht.</p>` : ""}
      <div class="st-zwei"><button class="haupt-knopf st-gefahr" data-st="punkt-weg-ok" data-id="${esc(e.id)}" data-wo="${esc(wo)}" data-i="${i}">Löschen</button><button class="knopf-klein" data-zu>Abbrechen</button></div></div>`);
  };
  AKTIONEN["punkt-weg-ok"] = async (t) => {
    const e = S.erfassungen.find((x) => x.id === t.dataset.id); if (!e) { H.schliesseEbene(); return; }
    const wo = t.dataset.wo, neu = R.punktEntfernen(e, wo, Number(t.dataset.i));
    if (!neu || (!R.geraetPunkte(neu).length && !R.monaPunkte(neu).length)) { H.schliesseEbene(); return; }
    /* Fotos: Mona-Fotos des Besuchs fallen mit dem letzten Mona-Punkt weg. Alte Fotos ohne Zuordnung bekommen jetzt ihre Zuordnung nach dem Stand VOR dem Löschen
       ausdrücklich eingetragen - sonst sprängen sie um, wenn der Besuch dadurch zu einem reinen Mona-Besuch wird. */
    const fotos = await D.fotosZu(e.id), wegFotos = [], neueFotos = [];
    for (const f of fotos) {
      if (f.zu === "mona" && wo === "mona" && !R.hatMona(neu)) wegFotos.push(f.id);
      else if (f.zu !== "automat" && f.zu !== "mona") neueFotos.push({ id: f.id, erfassung: f.erfassung, bild: f.bild, zu: R.fotoZu(f, e) });
    }
    /* Mona-Videos gehören zum Mona-Problem wie die Mona-Fotos: fällt der letzte Mona-Punkt weg, gehen sie mit */
    const wegVideos = wo === "mona" && !R.hatMona(neu) ? (await D.videosZu(e.id)).filter((v) => R.videoZu(v) === "mona").map((v) => v.id) : [];
    await D.erfassungSpeichern(neu, { neueFotos, wegFotos, wegVideos });
    H.schliesseEbene(); H.toast("Störung gelöscht"); Z.haltScroll = true; await neuLaden();
  };

  /* Werkstatt-Eintrag: Datum setzen/ändern, auf "unbekannt" stellen, löschen */
  AKTIONEN["w-aendern"] = (t) => {
    const w = S.werkstatt.find((x) => x.id === t.dataset.id); if (!w) return;
    H.oeffneEbene(H.bogenKopf(esc(w.a), "Werkstatt-Eintrag ändern") + `<div class="st-bogen">
      <label class="feld"><span>Tag des Werkstattbesuchs</span><input type="date" id="stWNach" value="${esc(w.datum || "")}" max="${esc(R.tagVon(w.erfasstUm))}"></label>
      <button class="haupt-knopf" data-st="w-aendern-ok" data-id="${esc(w.id)}">Speichern</button>
      <button class="knopf-klein st-breit" data-st="w-unbekannt-ok" data-id="${esc(w.id)}">Datum unbekannt</button></div>`);
  };
  async function werkstattDatum(id, datum) {
    const w = S.werkstatt.find((x) => x.id === id); if (!w) return;
    await D.schreiben("werkstatt", Object.assign({}, w, { datum }));
    H.schliesseEbene(); H.toast(datum ? "Datum gespeichert" : "Datum auf „unbekannt“ gestellt"); Z.haltScroll = true; await neuLaden();
  }
  AKTIONEN["w-aendern-ok"] = (t) => {
    const d = wert("stWNach");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) { H.toast("Bitte ein Datum wählen"); return; }
    if (d > heute()) { H.toast("Datum liegt in der Zukunft"); return; }
    return werkstattDatum(t.dataset.id, d);
  };
  AKTIONEN["w-unbekannt-ok"] = (t) => werkstattDatum(t.dataset.id, null);
  AKTIONEN["w-loeschen"] = (t) => {
    const w = S.werkstatt.find((x) => x.id === t.dataset.id); if (!w) return;
    H.oeffneEbene(H.bogenKopf(esc(w.a), "Werkstatt-Eintrag löschen?") + `<div class="st-bogen">
      <p>${w.datum ? "Besuch am " + esc(R.datumLang(w.datum)) : "Hinweis vom " + esc(R.datumLang(w.erfasstUm))} löschen? Der Werkstatt-Hinweis zählt danach wieder ab dem vorherigen Besuch.</p>
      <div class="st-zwei"><button class="haupt-knopf st-gefahr" data-st="w-loeschen-ok" data-id="${esc(w.id)}">Löschen</button><button class="knopf-klein" data-zu>Abbrechen</button></div></div>`);
  };
  AKTIONEN["w-loeschen-ok"] = async (t) => { await D.loeschen("werkstatt", t.dataset.id); H.schliesseEbene(); H.toast("Werkstatt-Eintrag gelöscht"); Z.haltScroll = true; await neuLaden(); };

  /* Listen pflegen: Kürzel und Werkstatt-Modelle */
  AKTIONEN.listen = () => {
    const benutztK = new Set(S.automaten.map((m) => m.kuerzel)), benutztW = new Set(S.automaten.map((m) => m.werkstattModell));
    const zeile = (titel, unter, benutzt, liste, id) => `<div class="st-listen-zeile"><span><b>${esc(titel)}</b> ${esc(unter)}</span><span class="st-eintrag-knoepfe">
      <button class="knopf-klein" data-st="liste-umbenennen" data-liste="${liste}" data-id="${esc(id)}">Umbenennen</button>${benutzt
      ? `<span class="st-klein">in Benutzung</span>` : `<button class="knopf-klein" data-st="liste-weg" data-liste="${liste}" data-id="${esc(id)}">Entfernen</button>`}</span></div>`;
    H.oeffneEbene(H.bogenKopf("Kartei", "Listen pflegen") + `<div class="st-bogen">${herstellerListe()}
      <span class="ueberschrift">Kürzel vom Verkaufsbericht</span>
      ${S.kuerzel.map((k) => zeile(k.kuerzel, k.hersteller, benutztK.has(k.kuerzel), "kuerzel", k.kuerzel)).join("")}
      <div class="st-reihe2"><input id="stLkK" placeholder="Kürzel" autocomplete="off"><input id="stLkH" placeholder="Hersteller" list="stHerstellerListe" autocomplete="off"><span></span></div>
      <button class="knopf-klein st-breit" data-st="liste-kuerzel-neu">Kürzel hinzufügen</button>
      <span class="ueberschrift st-abstand">Modelle laut Werkstatt</span>
      ${S.werkstattModelle.map((w) => zeile(w.modell, w.hersteller, benutztW.has(w.id), "werkstattModelle", w.id)).join("")}
      <div class="st-reihe2"><input id="stLwM" placeholder="Modell" autocomplete="off"><input id="stLwH" placeholder="Hersteller" list="stHerstellerListe" autocomplete="off"><span></span></div>
      <button class="knopf-klein st-breit" data-st="liste-werkstatt-neu">Modell hinzufügen</button></div>`);
  };
  AKTIONEN["liste-kuerzel-neu"] = async () => { if (await kuerzelHinzufuegen(wert("stLkK"), wert("stLkH"))) { AKTIONEN.listen(); H.toast("Kürzel hinzugefügt"); } };
  AKTIONEN["liste-werkstatt-neu"] = async () => {
    const modell = wert("stLwM"), hersteller = wert("stLwH");
    if (!modell || !hersteller) { H.toast("Bitte Modell und Hersteller eintragen"); return; }
    const id = hersteller + "|" + modell;
    if (S.werkstattModelle.some((w) => w.id.toLowerCase() === id.toLowerCase())) { H.toast("Dieses Modell gibt es schon"); return; }
    await D.schreiben("werkstattModelle", { id, hersteller, modell, reihe: S.werkstattModelle.reduce((m, w) => Math.max(m, w.reihe || 0), 0) + 1 });
    S = await D.stand(); AKTIONEN.listen(); H.toast("Modell hinzugefügt");
  };
  /* Entfernen aus den Listen: erst Rückfrage, dann löschen */
  AKTIONEN["liste-weg"] = (t) => {
    const liste = t.dataset.liste, id = t.dataset.id;
    if (S.automaten.some((m) => (liste === "kuerzel" ? m.kuerzel : m.werkstattModell) === id)) { H.toast("Wird noch benutzt"); return; }
    const x = liste === "kuerzel" ? null : S.werkstattModelle.find((y) => y.id === id);
    const name = liste === "kuerzel" ? id : (x ? x.modell : id);
    H.oeffneEbene(H.bogenKopf("Listen pflegen", "Eintrag entfernen?") + `<div class="st-bogen"><p>„${esc(name)}“ aus der Liste entfernen?</p>
      <div class="st-zwei"><button class="haupt-knopf st-gefahr" data-st="liste-weg-ok" data-liste="${esc(liste)}" data-id="${esc(id)}">Entfernen</button><button class="knopf-klein" data-st="listen">Abbrechen</button></div></div>`);
  };
  AKTIONEN["liste-weg-ok"] = async (t) => {
    const liste = t.dataset.liste, id = t.dataset.id;
    if (S.automaten.some((m) => (liste === "kuerzel" ? m.kuerzel : m.werkstattModell) === id)) { H.toast("Wird noch benutzt"); return; }
    await D.loeschen(liste, id); S = await D.stand(); AKTIONEN.listen(); H.toast("Entfernt");
  };
  /* Umbenennen - Automaten, die den Eintrag benutzen, ziehen mit (daten.js) */
  AKTIONEN["liste-umbenennen"] = (t) => {
    const liste = t.dataset.liste, id = t.dataset.id, k = liste === "kuerzel";
    const x = k ? S.kuerzel.find((y) => y.kuerzel === id) : S.werkstattModelle.find((y) => y.id === id); if (!x) return;
    H.oeffneEbene(H.bogenKopf("Listen pflegen", "Umbenennen") + `<div class="st-bogen">${herstellerListe()}
      <label class="feld"><span>${k ? "Kürzel" : "Modell"}</span><input id="stUmName" value="${esc(k ? x.kuerzel : x.modell)}" autocomplete="off"></label>
      <label class="feld"><span>Hersteller</span><input id="stUmHersteller" value="${esc(x.hersteller)}" list="stHerstellerListe" autocomplete="off"></label>
      <button class="haupt-knopf" data-st="liste-umbenennen-ok" data-liste="${esc(liste)}" data-id="${esc(id)}">Speichern</button></div>`);
  };
  AKTIONEN["liste-umbenennen-ok"] = async (t) => {
    const liste = t.dataset.liste, altId = t.dataset.id, k = liste === "kuerzel", name = wert("stUmName"), hersteller = wert("stUmHersteller");
    if (!name || !hersteller) { H.toast("Bitte beide Felder ausfüllen"); return; }
    const neuId = k ? name : hersteller + "|" + name;
    const vorhanden = (k ? S.kuerzel.map((y) => y.kuerzel) : S.werkstattModelle.map((y) => y.id)).some((y) => y !== altId && y.toLowerCase() === neuId.toLowerCase());
    if (vorhanden) { H.toast("Diesen Namen gibt es schon"); return; }
    await D.listeUmbenennen(liste, altId, k ? { kuerzel: name, hersteller } : { hersteller, modell: name });
    S = await D.stand(); zeichneHalten(); AKTIONEN.listen(); H.toast("Umbenannt");
  };

  /* ================= Teil 4: Daten (Umstellung, Excel, Sicherung) ================= */
  /* Woher die Sortentabelle kommt (15.10.2026, Schritt 1 von 2): Mirko sieht hier, ob sie schon in seinem Konto liegt -
     erst dann fällt sie in Schritt 2 aus dem Programm. */
  function sortenQuelleHTML() {
    const RS = window.RiebSorten;
    const q = RS ? RS.quelle() : "keine", n = RS ? RS.liste().length : 0, stand = RS && RS.stand() ? " · Stand " + esc(R.datumLang(RS.stand())) : "";
    const text = q === "konto" ? `<b>In Ihrem Konto ✓</b> – ${n} Sorten${stand}. Kommt über „Geräte abgleichen“ auf Ihre anderen Geräte.`
      : q === "geraet" ? `<b>Auf diesem Gerät abgelegt</b> (${n} Sorten${stand}), aber noch nicht im Konto. Unter „Mehr“ → „Geräte abgleichen“ mit Ihrem Konto anmelden.`
      : `<b>Keine Sortentabelle auf diesem Gerät.</b> Unter „Mehr“ → „Geräte abgleichen“ mit Ihrem Konto anmelden – dann kommt sie aus dem Konto.`;
    return `<div class="karte"><span class="ueberschrift">Sortentabelle</span><p class="st-klein" id="stSortenQuelle" data-quelle="${q}">${text}</p></div>`;
  }
  SEITEN.daten = () => `<div class="karte"><span class="ueberschrift">Umstellung (Klemmer-Versuch)</span>
      <label class="feld"><span>Umstellung ab</span><input type="date" id="stUmstellung" value="${esc(S.umstellung || "")}"></label>
      <p class="st-klein">Davor zählt alles als <b>vorher</b>, ab diesem Tag als <b>nachher</b>. Ab diesem Tag fragt das Werkzeug nach dem Probeverkauf.</p>
      <div class="st-zwei"><button class="knopf-klein" data-st="umstellung">Speichern</button>${S.umstellung ? `<button class="knopf-klein" data-st="umstellung-weg">Entfernen</button>` : ""}</div></div>
    <div class="karte"><span class="ueberschrift">Auswertung für die Chefs</span>
      <div class="st-zwei"><label class="feld"><span>von</span><input type="date" id="stVon"></label><label class="feld"><span>bis</span><input type="date" id="stBis"></label></div>
      <p class="st-klein">Leer lassen = alles. Excel: sieben Blätter (Übersicht, Erfassungen, Klemmer, Gerätestörungen, Mona-Probleme, Automaten, Frühere Störungen), ohne Fotos.</p>
      <button class="haupt-knopf" data-st="excel">Excel erstellen</button>
      <button class="haupt-knopf" data-st="bericht">PDF-Bericht erstellen</button>
      <p class="st-klein">PDF: Automatenliste auf Seite 1, jeder Automat mit Störungen auf eigener Seite, danach die Mona-Probleme – mit Fotos, zum Ausdrucken.</p></div>
    <div class="karte"><span class="ueberschrift">Sicherung</span>
      <p class="st-klein">Letzte Sicherung: <b>${S.letzteSicherung ? esc(R.datumLang(S.letzteSicherung)) : "noch keine"}</b>. Alles liegt nur auf diesem Gerät. Videos sind nicht in der Sicherung und bleiben beim Einspielen unberührt.</p>
      <button class="haupt-knopf" data-st="sicherung">Sicherung speichern</button>
      <label class="knopf-klein st-breit st-einspielen" for="stEinspielen">Sicherung einspielen</label>
      <input type="file" id="stEinspielen" class="st-unsichtbar" accept=".json,application/json">
      <p class="st-klein">Beim Speichern „Auf meinem iPhone“ oder AirDrop zum Mac wählen – <b>nicht iCloud Drive</b>.</p></div>
    ${sortenQuelleHTML()}
    <div class="karte"><span class="ueberschrift">Neu anfangen</span>
      <p class="st-klein">Nach dem Auswerten den Zeitraum abschließen: Die Besuche verschwinden aus Kartei, Excel und PDF und bleiben beim Automaten unter „Früher“ – mit Fotos. Videos werden gelöscht, offene Störungen laufen weiter.</p>
      <button class="knopf-klein st-breit" data-st="neu-anfangen">Zeitraum abschließen</button></div>`;

  async function umstellungSetzen(tag) {
    await D.setzeEinstellung("umstellung", tag);
    H.toast(tag ? "Umstellung ab " + R.datumLang(tag) : "Umstellung entfernt"); Z.haltScroll = true; await neuLaden();
  }
  AKTIONEN.umstellung = () => { const d = wert("stUmstellung"); if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) { H.toast("Bitte ein Datum wählen"); return; } return umstellungSetzen(d); };
  /* Entfernen ändert die Auswertung (alles zählt wieder als „vorher“) - erst fragen */
  AKTIONEN["umstellung-weg"] = () => {
    if (!S.umstellung) return;
    H.oeffneEbene(H.bogenKopf("Umstellung ab " + esc(R.datumLang(S.umstellung)), "Umstellungstag entfernen?") + `<div class="st-bogen">
      <p>Umstellungstag entfernen? Danach zählt alles als <b>vorher</b>.</p>
      <div class="st-zwei"><button class="haupt-knopf st-gefahr" data-st="umstellung-weg-ok">Entfernen</button><button class="knopf-klein" data-zu>Abbrechen</button></div></div>`);
  };
  AKTIONEN["umstellung-weg-ok"] = async () => { H.schliesseEbene(); await umstellungSetzen(null); };

  /* Datei fertig -> Bogen mit eigenem Knopf: navigator.share braucht einen frischen Tipp.
     Daneben „Als Datei laden“: lädt immer herunter (App und Browser gleich). */
  function bogenTeilen(titel, text) {
    /* „PDF mit Videos teilen“ nur, wenn Z.datei.mitVideos gesetzt ist (PDF für einen Automaten mit Automaten-Videos); „Teilen / Speichern“ und „Als Datei laden“ gelten immer nur dem PDF */
    const mitVideos = Z.datei.mitVideos ? `\n      <button class="haupt-knopf" data-st="teilen-videos">PDF mit Videos teilen</button>` : "";
    H.oeffneEbene(H.bogenKopf(esc(Z.datei.datei.name), titel) + `<div class="st-bogen"><p>${esc(text)}</p>
      <button class="haupt-knopf" data-st="teilen">Teilen / Speichern</button>${mitVideos}
      <button class="knopf-klein st-breit" data-st="laden">Als Datei laden</button></div>`);
  }
  AKTIONEN.excel = async () => {
    const von = wert("stVon") || null, bis = wert("stBis") || null;
    if (von && bis && von > bis) { H.toast("„von“ liegt nach „bis“"); return; }
    const blaetter = A.blaetter(S, { von, bis }, await D.fotoAnzahl(), await D.videoAnzahl());
    Z.datei = { datei: new File([X.erzeuge(blaetter)], A.dateiname(heute()), { type: X.MIME }), art: "excel" };
    bogenTeilen("Excel ist fertig", (blaetter[1].zeilen.length - 1) + " Erfassungen im Zeitraum.");
  };
  /* Solange ein PDF entsteht (mit vielen Fotos eine Weile), zeigt der gedrückte Knopf „PDF wird erstellt …“ und ist gesperrt – bis der Bogen zum Teilen
     erscheint (oder etwas schiefgeht: dann ebenfalls wieder frei). Ein kurzer Hinweis (Toast) verschwindet nach Sekunden und sagt zu wenig. */
  async function mitFortschritt(knopf, arbeit) {
    const alt = knopf.innerHTML;
    knopf.disabled = true; knopf.textContent = "PDF wird erstellt …";
    await new Promise((r) => setTimeout(r, 40));   // der Knopf soll gezeichnet sein, bevor die Rechenarbeit die Seite beschäftigt
    try { return await arbeit(); }
    finally { knopf.disabled = false; knopf.innerHTML = alt; }
  }
  /* PDF-Bericht für die Chefs: dieselben von/bis-Felder wie beim Excel. Ohne Störung im Zeitraum gäbe es nur ein leeres Blatt - dann Hinweis.
     Automatenstörungen und Mona-Probleme sind getrennt (bericht.js); es genügt eins von beiden. */
  AKTIONEN.bericht = async (knopf) => {
    const von = wert("stVon") || null, bis = wert("stBis") || null;
    if (von && bis && von > bis) { H.toast("„von“ liegt nach „bis“"); return; }
    const m = B.automaten(S, { von, bis }), na = m.liste.length, nm = m.mona.length;
    if (!na && !nm) { H.toast("Keine Störung im Zeitraum"); return; }
    await mitFortschritt(knopf, async () => {
      const pdf = await B.chefBericht(S, { von, bis });
      Z.datei = { datei: new File([pdf], B.dateiname("bericht", heute()), { type: "application/pdf" }), art: "pdf" };
      bogenTeilen("PDF-Bericht ist fertig", na + (na === 1 ? " Automat" : " Automaten") + " mit Automatenstörungen" + (nm ? ", " + nm + (nm === 1 ? " Mona-Problem" : " Mona-Probleme") : "") + ", mit Fotos.");
    });
  };
  /* PDF für diesen Automaten (13.10.2026, statt „PDF für die Werkstatt“): alle Automatenstörungen dieses Automaten, offen und behoben, ohne Mona (auch ohne Mona-Fotos und -Videos).
     Hat der Automat Automaten-Videos, werden die Dateien (PDF + Videos) HIER aus dem Speicher geholt, bevor der Bogen aufgeht: „PDF mit Videos teilen“ ruft navigator.share dann
     ohne jedes await davor auf (sonst wäre der frische Fingertipp verbraucht, iOS lehnt das Teilen ab) - wie beim Teilen eines einzelnen Videos. */
  const KEINE_AUTOMATENSTOERUNG = "Für diesen Automaten gibt es keine Automatenstörung";
  AKTIONEN["automat-pdf"] = async (knopf) => {
    const a = knopf.dataset.a, liste = B.stoerungenVon(S, a), n = liste.length, nf = R.frueherVon(S.frueher, a).length;   // nf: Gedächtnis (13.10.2026)
    if (!n && !nf) { H.toast(KEINE_AUTOMATENSTOERUNG); return; }
    await mitFortschritt(knopf, async () => {
      const pdf = await B.automatBericht(S, a);
      if (!pdf) { H.toast(KEINE_AUTOMATENSTOERUNG); return; }
      const videos = await B.automatVideos(S, a), nv = videos.length;
      Z.datei = { datei: new File([pdf], B.dateiname("automat", heute(), a), { type: "application/pdf" }), art: "pdf" };
      if (nv) Z.datei.mitVideos = { dateien: videos.map((x) => videoDatei(x.name, x.v)), text: "Störungsliste – " + R.automatZeile(R.geraetInfo(S, a)) + "\nPDF und " + nv + (nv === 1 ? " Video" : " Videos") };
      const offen = liste.filter((e) => e.behoben === false).length;
      bogenTeilen("PDF für diesen Automaten ist fertig", n + (n === 1 ? " Automatenstörung" : " Automatenstörungen") + " (" + offen + " offen), ohne Mona" + (nv ? ", mit " + nv + (nv === 1 ? " Video" : " Videos") + " dazu" : "")
        + (nf ? "; dazu " + nf + (nf === 1 ? " frühere Störung" : " frühere Störungen") + " als Text." : "."));
    });
  };
  AKTIONEN.sicherung = async () => {
    const obj = await D.sicherungErstellen();
    Z.datei = { datei: new File([JSON.stringify(obj)], "Stoerungsliste-Sicherung-" + heute() + ".json", { type: "application/json" }), art: "sicherung" };
    bogenTeilen("Sicherung ist fertig", obj.daten.erfassungen.length + " Erfassungen, " + obj.daten.fotos.length
      + " Fotos. Bitte „Auf meinem iPhone“ oder AirDrop zum Mac wählen – nicht iCloud Drive.");
  };
  /* KEIN await vor navigator.share - sonst ist der Fingertipp verbraucht. text (nur beim Video): geht mit der Datei mit, damit die Daten des Automaten beim Empfänger
     ankommen; nimmt ein Ziel keinen Text zur Datei an, steht das Wichtigste im Dateinamen. */
  async function teilen(datei, text) {
    if (navigator.canShare && navigator.share && navigator.canShare({ files: [datei] })) {
      try { await navigator.share(text ? { files: [datei], title: datei.name, text } : { files: [datei], title: datei.name }); return true; }
      catch (e) { if (e && e.name === "AbortError") return false; }
    }
    herunterladen(datei);
    return true;
  }
  /* Download über einen Link; die URL lebt 60 s (langsame Geräte holen die Datei verzögert ab) */
  function herunterladen(datei) {
    const url = URL.createObjectURL(datei), a = document.createElement("a");
    a.href = url; a.download = datei.name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
  /* Wie die fertige Datei im Hinweis heißt: „Excel übergeben“, „Sicherung geladen“, „PDF geladen“ */
  const DATEI_NAME = { excel: "Excel", sicherung: "Sicherung", pdf: "PDF", video: "Video" };
  async function dateiFertig(z, text) {
    if (z.art === "sicherung") await D.setzeEinstellung("letzteSicherung", heute());
    videoAnhalten(); Z.datei = null; H.schliesseEbene(); H.toast(text);
    Z.haltScroll = true; await neuLaden();
  }
  AKTIONEN.teilen = async () => {
    const z = Z.datei; if (!z) return;
    if (!(await teilen(z.datei, z.text))) return;            // im Teilen-Menü abgebrochen
    await dateiFertig(z, DATEI_NAME[z.art] + " übergeben");
  };
  /* „PDF mit Videos teilen“: das PDF und die Automaten-Videos in einem Teilen-Menü, PDF zuerst, dann die Videos in der Reihenfolge des PDFs (Dateien liegen seit dem Öffnen des
     Bogens bereit - KEIN await vor navigator.share). Kann das Gerät die Dateien nicht zusammen teilen (kein canShare für alle, z. B. am Mac im Browser), lädt es nur das PDF. */
  AKTIONEN["teilen-videos"] = async () => {
    const z = Z.datei; if (!z || !z.mitVideos) return;
    const m = z.mitVideos, nv = m.dateien.length, dateien = [z.datei].concat(m.dateien);
    let geteilt = false;
    if (navigator.canShare && navigator.share && navigator.canShare({ files: dateien })) {
      try { await navigator.share({ files: dateien, title: z.datei.name, text: m.text }); geteilt = true; }
      catch (e) { if (e && e.name === "AbortError") return; }   // im Teilen-Menü abgebrochen: Bogen bleibt offen; anderer Fehler: Rückfall wie unten
    }
    if (geteilt) { await dateiFertig(z, "PDF und " + nv + (nv === 1 ? " Video" : " Videos") + " übergeben"); return; }
    herunterladen(z.datei);
    await dateiFertig(z, "PDF geladen. Videos einzeln über die Vorgeschichte teilen");
  };
  /* Als Datei laden: zählt bei der Sicherung genauso als Sicherung */
  AKTIONEN.laden = async () => {
    const z = Z.datei; if (!z) return;
    herunterladen(z.datei);
    await dateiFertig(z, DATEI_NAME[z.art] + " geladen");
  };

  AENDERUNGEN.stEinspielen = async (input) => {
    const f = input.files && input.files[0]; input.value = ""; if (!f) return;
    let obj = null;
    try { obj = JSON.parse(await f.text()); } catch (e) { obj = null; }
    const fehler = D.sicherungPruefen(obj); if (fehler) { H.toast(fehler); return; }
    Z.einspielen = obj;
    H.oeffneEbene(H.bogenKopf(esc(f.name), "Sicherung einspielen?") + `<div class="st-bogen">
      <p>Die Sicherung vom <b>${esc(R.datumLang(obj.erstellt))}</b> (${obj.daten.erfassungen.length} Erfassungen, ${obj.daten.fotos.length} Fotos) <b>ersetzt den kompletten Stand</b> auf diesem Gerät (${S.erfassungen.length} Erfassungen).</p>
      <div class="st-zwei"><button class="haupt-knopf st-gefahr" data-st="einspielen-ok">Einspielen</button><button class="knopf-klein" data-zu>Abbrechen</button></div></div>`);
  };
  /* „Neu anfangen“ = Zeitraum abschließen (13.10.2026, daten.js zeitraumAbschliessen). Mirko: „über ein gewisses zeitfenster sammeln, auswerten, neu
     anfangen“, das Gedächtnis je Automat bleibt, „fotos behalten videos fliegen dann raus“, offene Störungen laufen weiter. Zwei Schritte:
     1. Bogen mit den Zahlen (Besuche, Automaten, Videos, weiterlaufende offene Störungen), Stand der Sicherung (nicht von heute -> rot);
        „Erst Sicherung speichern“ / „Zeitraum abschließen“ / „Abbrechen“.  2. „Wirklich abschließen?“ -> „Endgültig abschließen“.
     Ist eine Störung angefangen, kommt zuerst die bekannte Frage „weitermachen oder verwerfen“. */
  const mz = (n, eins, viele) => n + " " + (n === 1 ? eins : viele);
  const offenGeblieben = (e) => e.ergebnis === "stoerung" && e.behoben === false;
  async function abschlussZahlen() {
    const zu = S.erfassungen.filter((e) => !offenGeblieben(e)), ids = new Set(zu.map((e) => e.id)), va = await D.videoAnzahl();
    return { besuche: zu.length, automaten: new Set(zu.map((e) => e.a)).size, offen: S.erfassungen.length - zu.length,
      videos: Object.entries(va || {}).reduce((s, [id, n]) => s + (ids.has(id) ? n : 0), 0) };
  }
  AKTIONEN["neu-anfangen"] = async () => {
    if (Z.entwurf) { entwurfFrage(); return; }
    const z = await abschlussZahlen();
    if (!z.besuche) { H.toast(z.offen ? "Nur offene Störungen – die laufen im neuen Zeitraum weiter" : "Im laufenden Zeitraum gibt es nichts abzuschließen"); return; }
    const heuteGesichert = S.letzteSicherung === heute();
    H.oeffneEbene(H.bogenKopf("Neu anfangen", "Zeitraum abschließen?") + `<div class="st-bogen">
      <p>Abgeschlossen werden <b>${mz(z.besuche, "Besuch", "Besuche")}</b> an <b>${mz(z.automaten, "Automat", "Automaten")}</b>. Sie verschwinden aus Kartei, Excel und PDF und stehen danach beim Automaten unter „Früher“ – mit Fotos.</p>
      ${z.videos ? `<p>Gelöscht werden <b>${mz(z.videos, "Video", "Videos")}</b>. Das lässt sich nicht rückgängig machen – wer sie behalten will, teilt sie vorher (Videos sind nicht in der Sicherung).</p>` : ""}
      ${z.offen ? `<p>${z.offen === 1 ? "1 offene Störung läuft" : z.offen + " offene Störungen laufen"} im neuen Zeitraum weiter.</p>` : ""}
      <p>Vorher auswerten (Excel, PDF-Bericht) und eine Sicherung speichern. Letzte Sicherung: <b class="${heuteGesichert ? "" : "st-rot"}">${S.letzteSicherung ? esc(R.datumLang(S.letzteSicherung)) : "noch keine"}</b>.</p>
      <button class="haupt-knopf" data-st="sicherung">Erst Sicherung speichern</button>
      <button class="haupt-knopf st-gefahr" data-st="neu-anfangen-ok">Zeitraum abschließen</button>
      <button class="knopf-klein st-breit" data-zu>Abbrechen</button></div>`);
  };
  AKTIONEN["neu-anfangen-ok"] = async () => {
    const z = await abschlussZahlen();
    H.oeffneEbene(H.bogenKopf("Neu anfangen", "Wirklich abschließen?") + `<div class="st-bogen">
      <p>${mz(z.besuche, "Besuch geht", "Besuche gehen")} ins Gedächtnis${z.videos ? ", " + mz(z.videos, "Video wird", "Videos werden") + " gelöscht" : ""}. Das lässt sich nicht rückgängig machen.</p>
      <div class="st-zwei"><button class="haupt-knopf st-gefahr" data-st="neu-anfangen-endgueltig">Endgültig abschließen</button><button class="knopf-klein" data-zu>Abbrechen</button></div></div>`);
  };
  AKTIONEN["neu-anfangen-endgueltig"] = async () => {
    if (Z.entwurf) { entwurfFrage(); return; }
    const r = await D.zeitraumAbschliessen(heute());
    H.schliesseEbene(); H.toast("Zeitraum abgeschlossen – " + mz(r.abgeschlossen, "Besuch", "Besuche") + " im Gedächtnis");
    Z.karteiA = null; Z.ziffern = ""; Z.probe = null; Z.frueherOffen = false; Z.ansicht = "daten"; await neuLaden();
  };
  AKTIONEN["einspielen-ok"] = async () => {
    if (!Z.einspielen) return;
    const tag = R.tagVon(Z.einspielen.erstellt);
    await D.sicherungEinspielen(Z.einspielen); Z.einspielen = null;
    /* Die eingespielte Datei IST eine Sicherung - sonst mahnte der Kopf sofort wieder */
    await D.setzeEinstellung("letzteSicherung", tag);
    H.schliesseEbene(); H.toast("Sicherung eingespielt");
    Z.ansicht = "daten"; Z.ziffern = ""; Z.probe = null; await neuLaden();
  };

  /* ==== ENDE DER TEILE ==== */

  /* ---------------- Ereignisse ---------------- */
  /* Eine Aktion nach der anderen: ein Doppeltipp legt nichts doppelt an.
     „teilen“ ist ausgenommen - am iPhone endet das Teilen-Versprechen evtl. nie,
     und es braucht den frischen Fingertipp (kein await davor). */
  let laeuft = false;
  async function klick(ev) {
    if (!ev.target.closest) return;
    /* Bogen über ×, „Abbrechen“ oder den dunklen Rand zu: rieb.js schließt ihn selbst,
       hier nur fertige Datei / geprüfte Sicherung aus dem Speicher nehmen */
    const zu = ev.target.closest("[data-zu]");
    if (zu && zu.closest("#ebene")) { videoAnhalten(); Z.datei = null; Z.einspielen = null; return; }   // ein laufendes Video im Bogen nicht unsichtbar weiterspielen lassen
    const t = ev.target.closest("[data-st]"); if (!t || t.disabled) return;
    if (!(t.closest("#s-stoerungen") || t.closest("#bogenInhalt"))) return;
    const f = AKTIONEN[t.dataset.st]; if (!f || !H) return;
    const frei = t.dataset.st === "teilen" || t.dataset.st === "teilen-videos";
    if (laeuft && !frei) return;
    if (!frei) laeuft = true;
    try { await f(t); } catch (e) { console.error(e); H.toast("Fehler: " + (e && e.message ? e.message : String(e))); }
    finally { if (!frei) laeuft = false; }
  }
  function eingabe(ev) {
    const el = ev.target; if (!el.closest || !el.closest("#s-stoerungen, #bogenInhalt")) return;
    for (const f of EINGABEN) if (f(el)) return;
  }
  function aenderung(ev) { const f = AENDERUNGEN[ev.target.id]; if (f && H) f(ev.target); }
  document.addEventListener("click", klick);
  document.addEventListener("input", eingabe);
  document.addEventListener("change", aenderung);

  window.Stoerungsliste = { render };
})();
