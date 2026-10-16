/* =====================================================================
   stoerungen/daten.js - Störungsliste: Gerätespeicher (11.10.2026)

   ⛔ NUR IndexedDB, NIE localStorage: sync/firebase-sync.js lädt bei
   Mirkos Konto JEDEN localStorage-Schlüssel zu Firebase hoch (Z. 96-118,
   386). Automatennummern und Fotos dürfen nie an fremde Dienste
   (Regel vom 29.09.2026). Von IndexedDB liest firebase-sync.js nur die
   PDF-Ablage (spesen-pdf-archiv), nie diese Datenbank.
   Auch Spesen-Sicherung und "Alles zurücksetzen" berühren diese
   Datenbank nicht - und umgekehrt.
   ===================================================================== */
(function () {
  "use strict";
  const R = window.StoerRegeln;
  /* Version 2 (13.10.2026): neuer Speicher „videos“. Zwei Listen mit Absicht getrennt:
     SPEICHER = was in der Sicherung steht (und beim Einspielen ersetzt wird) - NAMEN leitet sich daraus ab;
     ANGELEGT = alle Speicher, die onupgradeneeded anlegt - SPEICHER plus „videos“.
     Videos sind NICHT in der Sicherung (Mirko 12.10.2026: „beim sichern muss video nicht mit rein“) und bleiben beim Einspielen unberührt. */
  const DB_NAME = "stoerungsliste", DB_VERSION = 2, FORMAT = "stoerungsliste-sicherung";
  const SPEICHER = { automaten: "a", erfassungen: "id", werkstatt: "id", fotos: "id", kuerzel: "kuerzel", werkstattModelle: "id", einstellungen: "k" };
  const NAMEN = Object.keys(SPEICHER);
  const ANGELEGT = Object.assign({}, SPEICHER, { videos: "id" });

  let offen = null;
  function oeffnen() {
    if (offen) return offen;
    const p = new Promise((res, rej) => {
      let r;
      try {
        r = indexedDB.open(DB_NAME, DB_VERSION);
        r.onupgradeneeded = () => {
          const db = r.result;
          /* Nur fehlende Speicher anlegen - vorhandene (und ihre Daten) bleiben, auch beim Sprung von Version 1 auf 2 */
          for (const [name, key] of Object.entries(ANGELEGT)) {
            if (db.objectStoreNames.contains(name)) continue;
            const s = db.createObjectStore(name, { keyPath: key });
            if (name === "erfassungen" || name === "werkstatt") s.createIndex("a", "a");
            if (name === "fotos" || name === "videos") s.createIndex("erfassung", "erfassung");
          }
        };
        r.onsuccess = () => {
          const db = r.result;
          db.onversionchange = () => { db.close(); offen = null; };
          db.onclose = () => { offen = null; };
          res(db);
        };
        r.onerror = () => { rej(r.error); };
      } catch (e) { rej(e); }
    });
    offen = p;
    p.catch(() => { if (offen === p) offen = null; });
    return p;
  }
  const anfrage = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  /* Ein Vorgang über mehrere Speicher: alles oder nichts. */
  async function vorgang(stores, arbeit) {
    const db = await oeffnen();
    return new Promise((res, rej) => {
      const t = db.transaction(stores, "readwrite"); let ergebnis;
      try { ergebnis = arbeit(t); } catch (e) { try { t.abort(); } catch (_) { /* schon zu */ } rej(e); return; }
      t.oncomplete = () => res(ergebnis);
      t.onabort = () => rej(t.error || new Error("Vorgang abgebrochen"));
    });
  }
  async function alle(store) { const db = await oeffnen(); return anfrage(db.transaction(store).objectStore(store).getAll()); }
  async function holen(store, key) { const db = await oeffnen(); return anfrage(db.transaction(store).objectStore(store).get(key)); }
  const schreiben = (store, obj) => vorgang([store], (t) => { t.objectStore(store).put(obj); return obj; });
  const loeschen = (store, key) => vorgang([store], (t) => { t.objectStore(store).delete(key); });
  async function einstellung(k) { const x = await holen("einstellungen", k); return x ? x.v : null; }
  const setzeEinstellung = (k, v) => schreiben("einstellungen", { k, v });

  /* Kürzel und Werkstatt-Modelle genau EINMAL vorbelegen - danach gehört
     die Liste Mirko (ergänzen, entfernen). */
  async function vorbelegen() {
    if (await einstellung("vorbelegt")) return;
    await vorgang(["kuerzel", "werkstattModelle", "einstellungen"], (t) => {
      R.KUERZEL_START.forEach((x) => t.objectStore("kuerzel").put(x));
      R.WERKSTATT_START.forEach((x) => t.objectStore("werkstattModelle").put(x));
      t.objectStore("einstellungen").put({ k: "vorbelegt", v: true });
    });
  }
  /* erfassungen = der LAUFENDE Zeitraum (alles, was Kartei, Excel und PDF zählen); frueher = abgeschlossene Besuche (Feld abgeschlossen = Tag des
     Abschließens) - das Gedächtnis je Automat (13.10.2026, siehe zeitraumAbschliessen). Wer früher und laufend zusammen braucht (Werkstatt-Erinnerung,
     „letzter Besuch“), hängt beide ausdrücklich aneinander. */
  async function stand() {
    await vorbelegen();
    const [automaten, alleErfassungen, werkstatt, kuerzel, werkstattModelle, umstellung, letzteSicherung, letzteTour] = await Promise.all([
      alle("automaten"), alle("erfassungen"), alle("werkstatt"), alle("kuerzel"), alle("werkstattModelle"),
      einstellung("umstellung"), einstellung("letzteSicherung"), einstellung("letzteTour")]);
    const nachReihe = (x, y) => (x.reihe || 0) - (y.reihe || 0);
    return { automaten, erfassungen: alleErfassungen.filter((e) => !e.abgeschlossen), frueher: alleErfassungen.filter((e) => !!e.abgeschlossen), werkstatt,
      kuerzel: kuerzel.sort(nachReihe), werkstattModelle: werkstattModelle.sort(nachReihe), umstellung, letzteSicherung, letzteTour: letzteTour || "" };
  }

  async function fotosZu(erfassungId) { const db = await oeffnen(); return anfrage(db.transaction("fotos").objectStore("fotos").index("erfassung").getAll(erfassungId)); }
  /* Zählt über die Schlüssel - die Bilder selbst werden nicht geladen. */
  async function fotoAnzahl() {
    const db = await oeffnen();
    return new Promise((res, rej) => {
      const n = {}, r = db.transaction("fotos").objectStore("fotos").index("erfassung").openKeyCursor();
      r.onsuccess = () => { const c = r.result; if (!c) { res(n); return; } n[c.key] = (n[c.key] || 0) + 1; c.continue(); };
      r.onerror = () => rej(r.error);
    });
  }
  /* ---- Videos (13.10.2026): Speicher „videos“, Index „erfassung“ ----
     Ein aufgenommenes Video wird SOFORT mit erfassung: null, entwurf: true abgelegt (der Entwurf merkt sich nur die Id - er wird oft neu geschrieben, ein Video
     nie mit). Speichern verknüpft es (erfassung = Id der Erfassung, entwurf fällt weg), Abbrechen/Verwerfen löscht es. Videos mit erfassung null stehen nicht im
     Index (null ist kein Schlüssel) - sie tauchen also in keiner Zählung und keiner Liste einer Erfassung auf. */
  async function videosZu(erfassungId) { const db = await oeffnen(); return anfrage(db.transaction("videos").objectStore("videos").index("erfassung").getAll(erfassungId)); }
  async function videoIdsZu(erfassungId) { const db = await oeffnen(); return anfrage(db.transaction("videos").objectStore("videos").index("erfassung").getAllKeys(erfassungId)); }
  /* Zählt über die Schlüssel - die Videos selbst werden nicht geladen. { erfassungsId: Anzahl } */
  async function videoAnzahl() {
    const db = await oeffnen();
    return new Promise((res, rej) => {
      const n = {}, r = db.transaction("videos").objectStore("videos").index("erfassung").openKeyCursor();
      r.onsuccess = () => { const c = r.result; if (!c) { res(n); return; } n[c.key] = (n[c.key] || 0) + 1; c.continue(); };
      r.onerror = () => rej(r.error);
    });
  }
  const videosLoeschen = (ids) => ((ids || []).length ? vorgang(["videos"], (t) => { ids.forEach((id) => t.objectStore("videos").delete(id)); }) : Promise.resolve());
  /* Aufnahmen, die ein Entwurf angelegt hat, aber kein Entwurf mehr nennt (Absturz, Neuladen mitten im Aufnehmen): weg. behalten = Ids, die ein Entwurf noch braucht.
     Videos mit erfassung (auch zu einer Erfassung, die es gerade nicht gibt, z. B. nach dem Einspielen einer Sicherung) bleiben immer. */
  function videoWaisenLoeschen(behalten) {
    const halte = new Set(behalten || []);
    return vorgang(["videos"], (t) => {
      const r = t.objectStore("videos").openCursor();
      r.onsuccess = () => { const c = r.result; if (!c) return; if (c.value && c.value.entwurf === true && !halte.has(c.value.id)) c.delete(); c.continue(); };
    });
  }
  /* Erfassung, ggf. neuer Automat, neue und gelöschte Fotos, verknüpfte und gelöschte Videos in EINEM Vorgang.
     o.videosVerknuepfen = Ids aufgenommener Entwurfs-Videos, die jetzt zu dieser Erfassung gehören; o.wegVideos = Ids gelöschter Videos. */
  function erfassungSpeichern(erfassung, opt) {
    const o = opt || {};
    return vorgang(["automaten", "erfassungen", "fotos", "videos"], (t) => {
      if (o.automat) t.objectStore("automaten").put(o.automat);
      t.objectStore("erfassungen").put(erfassung);
      (o.neueFotos || []).forEach((f) => t.objectStore("fotos").put(f));
      (o.wegFotos || []).forEach((id) => t.objectStore("fotos").delete(id));
      const vs = t.objectStore("videos");
      (o.videosVerknuepfen || []).forEach((id) => {
        const r = vs.get(id);
        r.onsuccess = () => { const v = r.result; if (!v) return; const neu = Object.assign({}, v, { erfassung: erfassung.id }); delete neu.entwurf; vs.put(neu); };
      });
      (o.wegVideos || []).forEach((id) => vs.delete(id));
      return erfassung;
    });
  }
  async function erfassungLoeschen(id) {
    const fotoIds = await fotoIdsZu(id), videoIds = await videoIdsZu(id);
    return vorgang(["erfassungen", "fotos", "videos"], (t) => {
      t.objectStore("erfassungen").delete(id);
      fotoIds.forEach((fid) => t.objectStore("fotos").delete(fid));
      videoIds.forEach((vid) => t.objectStore("videos").delete(vid));
    });
  }
  /* Vertippte A-Nummer korrigieren. Unbekannte neue Nummer -> Automat mit
     Kürzel/Ort der Vorlage anlegen. Hat der alte Automat danach keine
     Erfassung und keinen Werkstatt-Eintrag mehr, war er der Tippfehler -> weg. */
  async function aNummerUmziehen(erfassungId, neuA, vorlage) {
    const [e, ziel, alleE, werk] = await Promise.all([holen("erfassungen", erfassungId), holen("automaten", neuA), alle("erfassungen"), alle("werkstatt")]);
    if (!e || e.a === neuA) return;
    const altA = e.a;
    const altLeer = !alleE.some((x) => x.a === altA && x.id !== erfassungId) && !werk.some((w) => w.a === altA);
    return vorgang(["automaten", "erfassungen"], (t) => {
      if (!ziel) t.objectStore("automaten").put(Object.assign({}, vorlage || { kuerzel: "", ort: "", werkstattModell: null }, { a: neuA, angelegt: R.lokalIso(new Date()) }));
      t.objectStore("erfassungen").put(Object.assign({}, e, { a: neuA }));
      if (altLeer) t.objectStore("automaten").delete(altA);
    });
  }

  /* Nur die Schlüssel der Fotos - ohne die Bilder in den Speicher zu laden */
  async function fotoIdsZu(erfassungId) { const db = await oeffnen(); return anfrage(db.transaction("fotos").objectStore("fotos").index("erfassung").getAllKeys(erfassungId)); }
  /* Automat samt allen Erfassungen, Fotos, Videos und Werkstatt-Einträgen - ein Vorgang */
  async function automatLoeschen(a) {
    const [erf, werk] = await Promise.all([alle("erfassungen"), alle("werkstatt")]);
    const ids = erf.filter((e) => e.a === a).map((e) => e.id);
    const fotoIds = [], videoIds = [];
    for (const id of ids) { fotoIds.push(...(await fotoIdsZu(id))); videoIds.push(...(await videoIdsZu(id))); }
    return vorgang(["automaten", "erfassungen", "werkstatt", "fotos", "videos"], (t) => {
      t.objectStore("automaten").delete(a);
      ids.forEach((id) => t.objectStore("erfassungen").delete(id));
      werk.filter((w) => w.a === a).forEach((w) => t.objectStore("werkstatt").delete(w.id));
      fotoIds.forEach((id) => t.objectStore("fotos").delete(id));
      videoIds.forEach((id) => t.objectStore("videos").delete(id));
    });
  }
  /* Kürzel oder Werkstatt-Modell umbenennen; Automaten, die es benutzen, ziehen mit.
     neu = { kuerzel, hersteller } bzw. { hersteller, modell }. Liefert die neue id. */
  async function listeUmbenennen(liste, altId, neu) {
    const [alt, automaten] = await Promise.all([holen(liste, altId), alle("automaten")]);
    if (!alt) return null;
    const istKuerzel = liste === "kuerzel";
    const eintrag = istKuerzel ? { kuerzel: neu.kuerzel, hersteller: neu.hersteller, reihe: alt.reihe }
      : { id: neu.hersteller + "|" + neu.modell, hersteller: neu.hersteller, modell: neu.modell, reihe: alt.reihe };
    const neuId = istKuerzel ? eintrag.kuerzel : eintrag.id, feld = istKuerzel ? "kuerzel" : "werkstattModell";
    await vorgang([liste, "automaten"], (t) => {
      if (neuId !== altId) t.objectStore(liste).delete(altId);
      t.objectStore(liste).put(eintrag);
      automaten.filter((m) => m[feld] === altId).forEach((m) => t.objectStore("automaten").put(Object.assign({}, m, { [feld]: neuId })));
    });
    return neuId;
  }

  /* ---- Sicherung: eine Datei mit allem, Fotos als Base64 ----
     Der Speicher „videos“ gehört NICHT dazu (NAMEN kennt ihn nicht): weder wird er gesichert noch beim Einspielen geleert oder ersetzt. */
  function blobZuBase64(blob) {
    return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1] || ""); r.onerror = () => rej(r.error); r.readAsDataURL(blob); });
  }
  function base64ZuBlob(b64, typ) {
    const bin = atob(b64), u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return new Blob([u], { type: typ || "image/jpeg" });
  }
  async function sicherungErstellen() {
    const daten = {};
    for (const s of NAMEN) if (s !== "fotos") daten[s] = await alle(s);
    /* Die angefangene Störung (Einstellung "entwurf", mit Foto-Blobs) ist Zustand dieses Geräts - nicht Teil der Sicherung */
    daten.einstellungen = daten.einstellungen.filter((x) => x.k !== "entwurf");
    const fotos = await alle("fotos");
    daten.fotos = [];
    /* zu: "automat" | "mona" (12.10.2026) geht mit; ein altes Foto ohne Zuordnung bleibt ohne (die Lesart „altes Foto“ steht in regeln.js fotoZu) */
    for (const f of fotos) daten.fotos.push(Object.assign({ id: f.id, erfassung: f.erfassung, typ: f.bild.type, base64: await blobZuBase64(f.bild) }, f.zu === "automat" || f.zu === "mona" ? { zu: f.zu } : {}));
    return { format: FORMAT, version: 1, erstellt: R.lokalIso(new Date()), daten };
  }
  function sicherungPruefen(obj) {
    if (!obj || obj.format !== FORMAT || obj.version !== 1 || !obj.daten) return "Das ist keine Sicherung der Störungsliste.";
    for (const s of NAMEN) if (!Array.isArray(obj.daten[s])) return "Die Sicherung ist unvollständig (" + s + ").";
    if (obj.daten.automaten.some((m) => !m || !/^A\d{6}$/.test(m.a || ""))) return "Die Sicherung enthält ungültige A-Nummern.";
    if (obj.daten.erfassungen.some((e) => !e || !e.id || !/^A\d{6}$/.test(e.a || ""))) return "Die Sicherung enthält ungültige Erfassungen.";
    if (obj.daten.fotos.some((f) => !f || !f.id || !f.erfassung || typeof f.base64 !== "string")) return "Die Sicherung enthält ungültige Fotos.";
    return null;
  }
  /* Ersetzt den GESAMTEN Stand - in einem Vorgang: scheitert etwas,
     bleibt der alte Stand vollständig erhalten. */
  async function sicherungEinspielen(obj) {
    const fehler = sicherungPruefen(obj); if (fehler) throw new Error(fehler);
    let fotos;
    try { fotos = obj.daten.fotos.map((f) => Object.assign({ id: f.id, erfassung: f.erfassung, bild: base64ZuBlob(f.base64, f.typ) }, f.zu === "automat" || f.zu === "mona" ? { zu: f.zu } : {})); }   // alte Sicherungen haben kein zu
    catch (e) { throw new Error("Die Fotos in der Sicherung sind beschädigt."); }
    await vorgang(NAMEN, (t) => {
      for (const s of NAMEN) t.objectStore(s).clear();
      for (const s of NAMEN) for (const x of (s === "fotos" ? fotos : obj.daten[s])) t.objectStore(s).put(x);
    });
  }

  /* „Neu anfangen“ = Zeitraum abschließen (13.10.2026). Mirko: „über ein gewisses zeitfenster sammeln, auswerten, neu anfangen“ – und das Gedächtnis je
     Automat soll bleiben („weis er das der bereits mal wegen dem und dem störung hatte … klar getrennt zwischen behobenen und neuen störungen“),
     „fotos behalten videos fliegen dann raus“, offene Störungen laufen weiter („ja beheben“).
     Ein Vorgang: Jeder laufende Besuch AUSSER einer offenen Störung bekommt abgeschlossen = tag (er verschwindet aus Kartei, Excel und PDF des laufenden
     Zeitraums und steht ab dann unter „Früher“); seine Videos werden gelöscht, seine Fotos bleiben. Automaten ganz ohne Besuch und ohne Werkstatt-Eintrag
     (alte leere Karten) gehen mit weg. Kürzel-Liste, Werkstatt-Modelle, Werkstatt-Einträge und Einstellungen bleiben.
     -> { abgeschlossen: Zahl der Besuche, offen: Zahl der weiterlaufenden offenen Störungen, videos: Zahl der gelöschten Videos, automatenWeg } */
  const offeneStoerung = (e) => e.ergebnis === "stoerung" && e.behoben === false;
  async function zeitraumAbschliessen(tag) {
    const [erf, autos, werk] = await Promise.all([alle("erfassungen"), alle("automaten"), alle("werkstatt")]);
    const laufend = erf.filter((e) => !e.abgeschlossen), zu = laufend.filter((e) => !offeneStoerung(e));
    const videoIds = [];
    for (const e of zu) videoIds.push(...(await videoIdsZu(e.id)));
    const mitBesuch = new Set(erf.map((e) => e.a).concat(werk.map((w) => w.a)));
    const weg = autos.filter((m) => !mitBesuch.has(m.a)).map((m) => m.a);
    return vorgang(["erfassungen", "videos", "automaten"], (t) => {
      zu.forEach((e) => t.objectStore("erfassungen").put(Object.assign({}, e, { abgeschlossen: tag })));
      videoIds.forEach((id) => t.objectStore("videos").delete(id));
      weg.forEach((a) => t.objectStore("automaten").delete(a));
      return { abgeschlossen: zu.length, offen: laufend.length - zu.length, videos: videoIds.length, automatenWeg: weg.length };
    });
  }

  window.StoerDaten = { DB_NAME, alle, holen, schreiben, loeschen, einstellung, setzeEinstellung, stand, fotosZu, fotoAnzahl, videosZu, videoAnzahl, videosLoeschen, videoWaisenLoeschen,
    erfassungSpeichern, erfassungLoeschen, aNummerUmziehen, automatLoeschen, listeUmbenennen, sicherungErstellen, sicherungPruefen, sicherungEinspielen, zeitraumAbschliessen };
})();
