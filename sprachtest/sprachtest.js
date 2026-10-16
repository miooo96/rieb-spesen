/* sprachtest/sprachtest.js - Testseite Spracheingabe Störungsliste (13.10.2026)
   Mirko: "ja darfst du" (Testseite), "man soll frei reinsprechen können, die
   spracherkennung soll stichwörter erkennen die wir im geschäft benutzen", "die
   spracherkennung muss halt auch die einzelnen sorten erkennen" und zum Vergleich
   nach dem Klang: "das wäre ne idee mit dem vergleichen".

   Vosk (vosk-browser 0.0.8, Apache-2.0) mit vosk-model-small-de-0.15
   (Apache-2.0, Alpha Cephei) läuft komplett im Gerät. Zwei Erkenner hören zu:
   frei (daraus wird die Meldung) und mit Stichwortliste (prüft nur die
   Automatennummer gegen - sie erfindet sonst Stichwörter, gemessen 13.10.2026).

   Sorten: die Sortentabelle aus Mirkos Konto (bestellung/sorten-konto.js,
   EINE Quelle; seit 16.10.2026 nicht mehr im Programm). Bestätigte Sorten
   merkt sich die Seite ("so hört die Erkennung diese Sorte").

   Gespeichert NUR auf diesem Gerät, Schlüssel mit Schrägstrich ("sprachtest/…") -
   der hält sie aus dem Geräte-Abgleich der App heraus (firebase-sync.js istIntern).
   Sonst wird nichts gespeichert oder verschickt (CSP connect-src 'self'). */
(function () {
  "use strict";
  /* Wörter, die das Modell kennt (gemessen 13.10.2026, Sprachtest/wortschatz-pruefen.py) */
  const WORTLISTE = `automat automaten schacht modul motor päckchen klemmer klemmt geklemmt zunge zungen schmal breit
    blech tube tuben nicht grundstellung auslesbar auslesen schließt öffnet schlecht defekt kaputt sorte sonstiges störung
    mona app gefunden stück stange stangen kein keine null eins ein eine zwei drei vier fünf sechs sieben acht neun zehn
    elf zwölf dreizehn vierzehn fünfzehn sechzehn siebzehn achtzehn neunzehn zwanzig einundzwanzig zweiundzwanzig
    dreiundzwanzig vierundzwanzig fünfundzwanzig sechsundzwanzig siebenundzwanzig achtundzwanzig neunundzwanzig dreißig
    vierzig fünfzig sechzig siebzig achtzig neunzig hundert verbindung verloren vor dem beim während der zweiten preise
    gegenlesen neustart umbau umbauten abgestürzt abstürzt stürzt absturz ab hängt gerät ohne funktion zwischen und in
    im am an auf zu geht harting poth touch xl modell alles ordnung`.split(/\s+/).filter(Boolean);
  const KEY = { gelernt: "sprachtest/gelernt", namen: "sprachtest/sorten-namen", varianten: "sprachtest/sorten-varianten" };

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const V = () => window.Verstehen;
  const laden = (k) => { try { return JSON.parse(localStorage.getItem(k) || "{}") || {}; } catch (e) { return {}; } };
  const sichern = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* egal */ } };
  const euro = (v) => v.toLocaleString("de-DE", { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 }) + " €";

  let modell = null, kontext = null, strom = null, quelle = null, prozessor = null, laeuft = false, startZeit = 0;
  const erkenner = {}, text = { liste: "", frei: "" }, teil = { liste: "", frei: "" };
  const wertung = { meldung: { ja: 0, nein: 0 }, tastatur: { ja: 0, nein: 0 } };
  const bewertet = { meldung: false, tastatur: false };
  let gelernt = laden(KEY.gelernt);
  /* Namen: Entwurf aus den Kürzeln + die 18, die Mirko am 14.10.2026 genannt hat (beides im
     Konto-Eintrag der Sortentabelle) + Mirkos eigene Einträge - seine gehen immer vor;
     "" heißt "Entwurf gestrichen". Gelesen nur über bestellung/sorten-konto.js. */
  const RS = window.RiebSorten;
  const ENTWURF = RS ? RS.namenEntwurf() : {}, MIRKO = RS ? RS.namenMirko() : {};
  const eigeneNamen = laden(KEY.namen);
  const wissen = { liste: (RS ? RS.liste() : []).slice(), namen: {}, varianten: laden(KEY.varianten) };
  function namenNeu() {
    const n = Object.assign({}, ENTWURF, MIRKO, eigeneNamen);
    Object.keys(n).forEach((k) => { if (!n[k]) delete n[k]; });
    wissen.namen = n;
  }
  namenNeu();
  const namensQuelle = (nr) => (eigeneNamen[nr] != null ? (eigeneNamen[nr] ? "eigener" : "gestrichen") : MIRKO[nr] ? "Mirko" : ENTWURF[nr] ? "Entwurf" : "");
  const ersterName = (nr) => String(wissen.namen[nr] || "").split("|")[0];
  /* Je Weg (Apple-Mikrofon "tastatur", im Gerät "meldung"): die aktuelle Meldung und die
     bestätigten Sorten { gehörter Text: nr } - nach Text, damit eine Korrektur im Feld die
     Auswahl nicht verschiebt */
  const zustand = { tastatur: { aktuell: null, bestaetigt: {} }, meldung: { aktuell: null, bestaetigt: {} } };
  const bestaetigtLeeren = () => { zustand.tastatur.bestaetigt = {}; zustand.meldung.bestaetigt = {}; };

  /* ---- Anzeige ---- */
  const sorteNach = (nr) => { const s = wissen.liste.find((x) => x.nr === nr); return s ? { nr: s.nr, kuerzel: s.kuerzel, preis: V().packungspreis(s), name: ersterName(s.nr) } : null; };
  /* Nie die interne Sortennummer zeigen (Mirko 15.10.2026: „überall weg“) – Kürzel und Name */
  const sorteKnopf = (k, vorschlag) => `${esc(k.kuerzel)}${k.name ? " · " + esc(k.name) : ""}${vorschlag ? " ✓" : ""}`;
  const kuerzelVon = (nr) => { const s = wissen.liste.find((x) => x.nr === nr); return s ? s.kuerzel : null; };
  /* z = Zustand des Wegs (mit Sortenwahl) */
  function meldungHtml(e, z) {
    const mitWahl = !!z;
    e.sorten.forEach((s) => { if (mitWahl && z.bestaetigt[s.text]) s.bestaetigt = sorteNach(z.bestaetigt[s.text]); });
    const zeilen = V().alsZeilen(e, kuerzelVon);
    let html = (zeilen.length ? `<table>${zeilen.map(([a, b]) => `<tr><td>${esc(a)}</td><td>${esc(b)}</td></tr>`).join("")}</table>` : `<p class="leer">Nichts erkannt.</p>`);
    const hinweise = e.hinweise.filter((h) => !(mitWahl && /^Sorte/.test(h) && e.sorten.every((s) => s.bestaetigt)));
    html += hinweise.map((h) => `<p class="hinweis">${esc(h)}</p>`).join("");
    if (mitWahl) e.sorten.forEach((s, i) => {
      if (s.bestaetigt) return;
      const w = s.wahl || { kandidaten: [] }, k = w.kandidaten.slice(0, 40);
      html += `<div class="sortenwahl" data-sorte="${i}"><p>Welche Sorte ist „<b>${esc(s.text || "?")}</b>“${s.preis != null ? " (" + esc(euro(s.preis)) + ")" : ""}?</p><div class="knoepfe">`
        + (k.length ? k.map((x) => `<button data-nr="${esc(x.nr)}"${w.vorschlag && w.vorschlag.nr === x.nr ? ' class="vorschlag"' : ""}>${sorteKnopf(x, w.vorschlag && w.vorschlag.nr === x.nr)}</button>`).join("") : `<span class="leer">Keine Sorte zu diesem Preis in der Liste.</span>`)
        + `</div></div>`;
    });
    return html;
  }
  function gehoertZeigen() {
    const frei = text.frei.trim();
    const woerter = frei ? frei.split(/\s+/) : [];
    $("gehoert-frei").innerHTML = `<span class="titel">Frei gesprochen – falsches Wort antippen</span>`
      + (woerter.length ? woerter.map((w) => `<button class="wort${gelernt[w] != null ? " gelernt" : ""}" data-wort="${esc(w)}">${esc(w)}${gelernt[w] != null ? " → " + esc(gelernt[w] || "–") : ""}</button>`).join("") : "&nbsp;")
      + (teil.frei ? ` <span class="teil">${esc(teil.frei)}</span>` : "");
    $("gehoert-liste").innerHTML = `<span class="titel">Stichwörter (nur zum Gegenprüfen der Automatennummer)</span>${esc(text.liste.trim()) || "&nbsp;"}${teil.liste ? ` <span class="teil">${esc(teil.liste)}</span>` : ""}`;
  }
  function auswerten() {
    if (!text.frei.trim() && !text.liste.trim()) return;
    const z = zustand.meldung;
    z.aktuell = V().zusammenfuehren(V().verstehen(text.frei, gelernt, wissen), V().verstehen(text.liste, gelernt, wissen));
    $("meldung").innerHTML = meldungHtml(z.aktuell, z);
    bewertet.meldung = false;
    document.querySelectorAll('[data-weg="meldung"] .urteil button').forEach((b) => b.classList.remove("an-ja", "an-nein"));
  }
  /* Wörter aus dem Feld zum Antippen - gleiche Zerlegung wie Verstehen.woerter (Schlüssel der Lernliste) */
  function woerterTastaturZeigen() {
    const roh = $("tastatur").value.toLowerCase().replace(/[^a-z0-9äöüß]+/g, " ").trim();
    const ws = [...new Set(roh ? roh.split(/\s+/).filter((w) => !/^\d+$/.test(w)) : [])];
    $("woerter-tastatur").hidden = !ws.length;
    $("woerter-tastatur").innerHTML = `<span class="titel">Falsch verstanden? Wort antippen</span>`
      + ws.map((w) => `<button class="wort${gelernt[w] != null ? " gelernt" : ""}" data-wort="${esc(w)}">${esc(w)}${gelernt[w] != null ? " → " + esc(gelernt[w] || "–") : ""}</button>`).join("");
  }
  function tastaturAuswerten() {
    const t = $("tastatur").value, z = zustand.tastatur;
    z.aktuell = t.trim() ? V().verstehen(t, gelernt, wissen) : null;
    $("meldung-tastatur").innerHTML = z.aktuell ? meldungHtml(z.aktuell, z) : `<p class="leer">Noch nichts gesprochen.</p>`;
    woerterTastaturZeigen();
    bewertet.tastatur = false;
    document.querySelectorAll('[data-weg="tastatur"] .urteil button').forEach((b) => b.classList.remove("an-ja", "an-nein"));
  }
  function lernlisteZeigen() {
    const woerter = Object.entries(gelernt).map(([w, b]) => `<div class="lern"><span>„${esc(w)}“ → ${b ? "<b>" + esc(b) + "</b>" : "<i>ignorieren</i>"}</span><button data-vergessen="${esc(w)}" aria-label="„${esc(w)}“ vergessen">×</button></div>`);
    const sorten = Object.entries(wissen.varianten).map(([t, nr]) => { const s = sorteNach(nr); return `<div class="lern"><span>„${esc(t)}“ → <b>${s ? sorteKnopf(s) : esc(nr)}</b></span><button data-vergessen-sorte="${esc(t)}" aria-label="„${esc(t)}“ vergessen">×</button></div>`; });
    $("lernliste").innerHTML = woerter.length || sorten.length ? woerter.concat(sorten).join("")
      : `<p class="leer">Noch nichts gelernt. Tippen Sie oben ein falsch verstandenes Wort an und wählen Sie das richtige Stichwort.</p>`;
  }
  function sortenNamenZeigen() {
    const n = wissen.liste.filter((s) => wissen.namen[s.nr]).length;
    const ausEntwurf = wissen.liste.filter((s) => namensQuelle(s.nr) === "Entwurf").length;
    $("sortenZaehler").textContent = `${wissen.liste.length} Sorten anzeigen – ${n} mit Namen${ausEntwurf ? `, davon ${ausEntwurf} noch Entwurf` : ""}`;
    if ($("sortenNamen").dataset.gebaut) return;   // nicht neu bauen, sonst springt der Fokus aus dem Feld
    $("sortenNamen").dataset.gebaut = "1";
    $("sortenNamen").innerHTML = wissen.liste.map((s) => `<label class="sorte-zeile"><span>${esc(s.kuerzel)}<br><small>${esc(euro(V().packungspreis(s)))}${namensQuelle(s.nr) === "Entwurf" ? " · Entwurf" : !wissen.namen[s.nr] ? " · ?" : ""}</small></span>`
      + `<input data-sortenname="${esc(s.nr)}" value="${esc(ersterName(s.nr))}" placeholder="Name, wie Sie ihn sagen" autocomplete="off"></label>`).join("");
  }
  function zaehlerZeigen() {
    const t = (w, name) => (wertung[w].ja + wertung[w].nein ? `${name} ${wertung[w].ja} von ${wertung[w].ja + wertung[w].nein}` : "");
    $("zaehler").textContent = [t("tastatur", "Apple-Mikrofon"), t("meldung", "Im Gerät")].filter(Boolean).join(" · ") || "Noch nichts bewertet.";
  }
  function allesNeu() { gehoertZeigen(); auswerten(); tastaturAuswerten(); lernlisteZeigen(); sortenNamenZeigen(); }

  /* ---- Sorte wählen -> merken, wie die Erkennung sie gehört hat ---- */
  function sorteGewaehlt(weg, ev) {
    const b = ev.target.closest(".sortenwahl [data-nr]"), z = zustand[weg]; if (!b || !z.aktuell) return;
    const s = z.aktuell.sorten[Number(b.closest(".sortenwahl").dataset.sorte)]; if (!s) return;
    z.bestaetigt[s.text] = b.dataset.nr;
    if (s.text) { wissen.varianten[s.text] = b.dataset.nr; sichern(KEY.varianten, wissen.varianten); }
    allesNeu();
  }
  $("meldung").addEventListener("click", (ev) => sorteGewaehlt("meldung", ev));
  $("meldung-tastatur").addEventListener("click", (ev) => sorteGewaehlt("tastatur", ev));

  /* ---- Sortennamen eintragen ---- */
  let namenTakt = null;
  $("sortenNamen").addEventListener("input", (ev) => {
    const el = ev.target.closest("[data-sortenname]"); if (!el) return;
    const v = el.value.trim().toLowerCase(), nr = el.dataset.sortenname;
    const vorgabe = String(MIRKO[nr] || ENTWURF[nr] || "").split("|")[0];
    if (v === vorgabe) delete eigeneNamen[nr]; else eigeneNamen[nr] = v;   // "" = Vorgabe gestrichen
    sichern(KEY.namen, eigeneNamen); namenNeu();
    clearTimeout(namenTakt); namenTakt = setTimeout(() => { auswerten(); tastaturAuswerten(); lernlisteZeigen(); sortenNamenZeigen(); }, 300);
  });
  $("namenKopieren").addEventListener("click", async () => {
    const t = wissen.liste.map((s) => `${s.nr} ${s.kuerzel} → ${ersterName(s.nr) || "?"}${namensQuelle(s.nr) === "Entwurf" ? " (Entwurf)" : namensQuelle(s.nr) === "eigener" ? " (geändert)" : ""}`).join("\n");
    try { await navigator.clipboard.writeText("Sprachtest Sortennamen:\n" + t); $("namenKopieren").textContent = "Kopiert ✓"; setTimeout(() => { $("namenKopieren").textContent = "Namen kopieren"; }, 1800); }
    catch (e) { prompt("Zum Kopieren markieren:", t.replace(/\n/g, " · ")); }
  });

  /* ---- Lernen: Wort antippen -> Stichwort wählen (Apple-Feld und Erkennung im Gerät) ---- */
  function wahlOeffnen(box, w) {
    box.innerHTML = `<div class="wahl"><p>„<b>${esc(w)}</b>“ bedeutet:</p><div class="knoepfe">`
      + V().STICHWOERTER.map((s) => `<button data-stichwort="${esc(s)}">${esc(s)}</button>`).join("")
      + `<button class="neben" data-eigen="1">eigenes Wort …</button><button class="neben" data-stichwort="">ignorieren</button><button class="neben" data-abbruch="1">abbrechen</button></div></div>`;
    box.dataset.wort = w;
    box.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }
  function wahlKlick(ev) {
    const box = ev.currentTarget, b = ev.target.closest("button"); if (!b) return;
    const w = box.dataset.wort;
    if (b.dataset.abbruch) { box.innerHTML = ""; return; }
    let ziel = b.dataset.stichwort;
    if (b.dataset.eigen) { ziel = prompt(`„${w}“ bedeutet (ein Wort, so wie Sie es im Geschäft sagen):`, ""); if (ziel == null) return; ziel = ziel.trim().toLowerCase(); }
    if (ziel === w) { box.innerHTML = ""; return; }
    gelernt[w] = ziel; sichern(KEY.gelernt, gelernt);
    box.innerHTML = "";
    allesNeu();
  }
  $("gehoert-frei").addEventListener("click", (ev) => { const b = ev.target.closest("[data-wort]"); if (b) wahlOeffnen($("wahl"), b.dataset.wort); });
  $("woerter-tastatur").addEventListener("click", (ev) => { const b = ev.target.closest("[data-wort]"); if (b) wahlOeffnen($("wahl-tastatur"), b.dataset.wort); });
  $("wahl").addEventListener("click", wahlKlick);
  $("wahl-tastatur").addEventListener("click", wahlKlick);
  $("lernliste").addEventListener("click", (ev) => {
    const b = ev.target.closest("[data-vergessen]"), bs = ev.target.closest("[data-vergessen-sorte]");
    if (b) { delete gelernt[b.dataset.vergessen]; sichern(KEY.gelernt, gelernt); }
    else if (bs) { delete wissen.varianten[bs.dataset.vergessenSorte]; sichern(KEY.varianten, wissen.varianten); bestaetigtLeeren(); }
    else return;
    allesNeu();
  });
  $("lernKopieren").addEventListener("click", async () => {
    const w = Object.entries(gelernt).map(([x, b]) => `${x} → ${b || "(ignorieren)"}`);
    const s = Object.entries(wissen.varianten).map(([t, nr]) => { const k = sorteNach(nr); return `Sorte: ${t} → ${k ? k.kuerzel : nr}`; });
    const t = w.concat(s).join("\n") || "(leer)";
    try { await navigator.clipboard.writeText("Sprachtest Lernliste:\n" + t); $("lernKopieren").textContent = "Kopiert ✓"; setTimeout(() => { $("lernKopieren").textContent = "Liste kopieren"; }, 1800); }
    catch (e) { prompt("Zum Kopieren markieren:", t.replace(/\n/g, " · ")); }
  });
  $("lernLeeren").addEventListener("click", () => {
    if ((!Object.keys(gelernt).length && !Object.keys(wissen.varianten).length) || !confirm("Lernliste wirklich leeren (Wörter und gelernte Sorten)?")) return;
    gelernt = {}; wissen.varianten = {}; bestaetigtLeeren();
    sichern(KEY.gelernt, gelernt); sichern(KEY.varianten, wissen.varianten); allesNeu();
  });

  /* ---- 1 · Modell laden ---- */
  $("laden").addEventListener("click", async () => {
    if (modell) return;
    $("laden").disabled = true;
    $("ladeStatus").textContent = "Lädt … (kann im Mobilnetz eine Minute dauern)";
    const t0 = performance.now();
    try {
      /* Volle Adresse: der Worker laeuft unter einer blob:-Adresse, dort zeigt ein
         relativer Pfad ins Leere (404, gefunden 13.10.2026) */
      modell = await window.Vosk.createModel(new URL("modell-de.tar.gz", location.href).href);
      $("ladeStatus").textContent = `Bereit – geladen in ${((performance.now() - t0) / 1000).toFixed(1)} s.`;
      $("laden").textContent = "Sprachmodell geladen";
      $("sprechen").disabled = false;
      $("sprechStatus").textContent = "Antippen, frei sprechen, dann „Fertig“.";
    } catch (e) {
      $("laden").disabled = false;
      $("ladeStatus").textContent = "Laden fehlgeschlagen: " + (e && e.message ? e.message : e);
    }
  });

  /* ---- 2 · Aufnahme ---- */
  function erkennerAnlegen(weg, rate) {
    const r = weg === "liste" ? new modell.KaldiRecognizer(rate, JSON.stringify(WORTLISTE.concat("[unk]"))) : new modell.KaldiRecognizer(rate);
    r.on("result", (m) => { const s = m.result && m.result.text; if (s) text[weg] += " " + s.replace(/\[unk\]/g, "").trim(); teil[weg] = ""; gehoertZeigen(); });
    r.on("partialresult", (m) => { teil[weg] = (m.result && m.result.partial || "").replace(/\[unk\]/g, "").trim(); gehoertZeigen(); });
    return r;
  }
  async function starten() {
    try {
      strom = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 }, video: false });
    } catch (e) {
      $("sprechStatus").textContent = "Kein Zugriff aufs Mikrofon: " + (e && e.message ? e.message : e);
      return;
    }
    kontext = new (window.AudioContext || window.webkitAudioContext)();
    const rate = kontext.sampleRate;
    for (const w of ["liste", "frei"]) { text[w] = ""; teil[w] = ""; erkenner[w] = erkennerAnlegen(w, rate); }
    zustand.meldung.bestaetigt = {}; zustand.meldung.aktuell = null;
    $("wahl").innerHTML = ""; gehoertZeigen(); $("meldung").innerHTML = `<p class="leer">Hört zu …</p>`;
    quelle = kontext.createMediaStreamSource(strom);
    prozessor = kontext.createScriptProcessor(4096, 1, 1);
    prozessor.onaudioprocess = (ev) => { if (!laeuft) return; for (const w of ["liste", "frei"]) { try { erkenner[w].acceptWaveform(ev.inputBuffer); } catch (e) { /* weiter */ } } };
    quelle.connect(prozessor); prozessor.connect(kontext.destination);
    laeuft = true; startZeit = performance.now();
    $("sprechen").textContent = "Fertig"; $("sprechen").classList.add("laeuft");
    $("sprechStatus").textContent = "Hört zu …";
  }
  async function stoppen() {
    laeuft = false;
    $("sprechen").disabled = true; $("sprechen").textContent = "Wertet aus …"; $("sprechen").classList.remove("laeuft");
    try { quelle.disconnect(); prozessor.disconnect(); } catch (e) { /* egal */ }
    if (strom) strom.getTracks().forEach((t) => t.stop());
    const t0 = performance.now();
    await Promise.all(["liste", "frei"].map((w) => new Promise((fertig) => {
      const r = erkenner[w]; let erledigt = false;
      const ende = () => { if (erledigt) return; erledigt = true; fertig(); };
      r.on("result", ende); setTimeout(ende, 2500);
      try { r.retrieveFinalResult(); } catch (e) { ende(); }
    })));
    for (const w of ["liste", "frei"]) { try { erkenner[w].remove(); } catch (e) { /* egal */ } teil[w] = ""; }
    gehoertZeigen(); auswerten();
    try { await kontext.close(); } catch (e) { /* egal */ }
    $("sprechen").disabled = false; $("sprechen").textContent = "Aufnahme starten";
    $("sprechStatus").textContent = `Gesprochen ${((t0 - startZeit) / 1000).toFixed(1)} s · ausgewertet in ${((performance.now() - t0) / 1000).toFixed(1)} s. Bitte unten bewerten.`;
  }
  $("sprechen").addEventListener("click", () => (laeuft ? stoppen() : starten()));

  /* ---- Hauptweg: Mikrofon der iPhone-Tastatur ----
     Hier erkennt Apple die Sprache. Mirko 14.10.2026: "von mir aus nummer über mikro" -
     die Automatennummer darf über das Tastatur-Mikrofon gesprochen werden (Ausnahme zur
     Vault-Regel vom 29.09.2026, dort vermerkt) - und "dann nehmen wir apple mikrofon". */
  $("tastatur").addEventListener("input", tastaturAuswerten);
  $("tastaturLeeren").addEventListener("click", () => {
    $("tastatur").value = ""; zustand.tastatur.bestaetigt = {}; $("wahl-tastatur").innerHTML = "";
    tastaturAuswerten(); $("tastatur").focus();
  });

  /* ---- Bewertung ---- */
  document.querySelectorAll(".urteil button").forEach((b) => b.addEventListener("click", () => {
    const weg = b.closest("[data-weg]").dataset.weg;
    const inhalt = $(weg === "meldung" ? "meldung" : "meldung-tastatur").querySelector("table");
    if (!inhalt || bewertet[weg]) return;
    bewertet[weg] = true;
    wertung[weg][b.dataset.urteil]++;
    b.classList.add(b.dataset.urteil === "ja" ? "an-ja" : "an-nein");
    zaehlerZeigen();
  }));

  lernlisteZeigen(); sortenNamenZeigen(); tastaturAuswerten();   // Safari stellt den Feldinhalt beim Zurückgehen wieder her
  /* Für die Prüfung am Mac (Neues Design/sprachtest-pruefen.js) */
  window.__sprachtest = { text, wertung, bereit: () => !!modell, gelernt: () => JSON.parse(JSON.stringify(gelernt)), wissen: () => JSON.parse(JSON.stringify(wissen)) };
})();
