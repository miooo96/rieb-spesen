/* =====================================================================
   Spesen-Rechner – Auto-Sync ueber Firebase (Version 1)
   ---------------------------------------------------------------------
   Aufgabe: Der komplette Stand eines Fahrers liegt auf jedem seiner
   Geraete automatisch vor. Login pro Fahrer, jeder sieht NUR seine
   eigenen Daten, Offline-Betrieb inklusive.

   WICHTIG – Sicherheitsschalter:
   Das Modul tut GAR NICHTS, solange keine echte firebase-config.js
   geladen ist (window.SPESEN_FIREBASE_CONFIG fehlt oder enthaelt noch
   "DEIN_..."). Der Live-Rechner bleibt dann unveraendert.

   Andockpunkt an den bestehenden Code:
   - Jede Eingabe schreibt im Rechner bereits localStorage. Dieses Modul
     haengt sich an localStorage.setItem/removeItem (Monkey-Patch), ohne
     dass eine der ~90 vorhandenen Speicherstellen geaendert werden muss.
   - Welche Schluessel NICHT synchronisiert werden, ist dieselbe Regel
     wie gehoertInsBackup() im index.html: "kfz-kaefig-v1" (Neue Ware
     zaehlen) und "rieb-letzter-bereich" (Merk-Hilfe) bleiben draussen.

   Konflikt-Regel (siehe Sync-Konzept, Abschnitt 5):
   - je Schluessel "neuerer gewinnt" (Last-Write-Wins)
   - der grosse Block spesen_overrides wird vor dem Ueberschreiben lokal
     als Schatten-Sicherung weggeschrieben -> kein Tag geht unwiederbring-
     lich verloren
   - ein eingereichter Monat (spesen_submitted_*) wird per Sync nie
     stillschweigend entfernt
   ===================================================================== */

(async () => {
  "use strict";

  // Konfiguration selbst laden – so genuegt EINE Zeile in der index.html.
  // Fehlt die Datei (z. B. auf einem Geraet ohne Einrichtung), bleibt der
  // Sync einfach aus und der Rechner verhaelt sich wie bisher.
  try { await import("./firebase-config.js"); } catch (e) { /* keine Konfig -> aus */ }

  const cfg = window.SPESEN_FIREBASE_CONFIG;
  const istEcht = cfg && cfg.apiKey && !String(cfg.apiKey).startsWith("DEIN_");
  if (!istEcht) {
    // Kein echtes Projekt hinterlegt -> Sync bleibt aus. Bewusst leise.
    console.info("[Sync] Keine Firebase-Konfiguration – Auto-Sync ist aus.");
    return;
  }

  // ---- Aktivierung: fuer ALLE, freiwillig (09.10.2026) -----------------
  // Bis 09.10.2026 nur fuer Mirko (Name "Mirko Rieb"). Mirko am 09.10.:
  // "wir haben doch die synch funktion ... das mit einbauen?" und "ne brauche
  // kein okey mehr ist mein eigenes tool jetzt" - Entscheidung 42: freiwillig,
  // jeder legt sein Konto selbst an (E-Mail + Passwort).
  //
  // Wer NICHT angemeldet ist, bekommt von Firebase NICHTS: kein Laden der
  // Google-Bausteine, keine Anfrage an Google ("Ohne Anmeldung bleibt alles
  // nur auf diesem Geraet" muss wahr sein). Geladen wird erst, wenn
  //   - auf diesem Geraet schon einmal angemeldet wurde (Merker __sync_uid,
  //     setzt onAuthStateChanged - auch Mirkos bisherige Geraete haben ihn), oder
  //   - jemand unter "Mehr" -> "Geraete abgleichen" auf Anmelden tippt.
  // Die Oberflaeche dazu baut rieb.js; sie spricht nur mit window.riebSync.
  // Not-Aus bleibt ueber ?sync=aus moeglich.
  const params = new URLSearchParams(location.search);
  if (params.get("sync") === "aus") localStorage.setItem("spesen_sync_aus", "ja");
  if (params.get("sync") === "an") localStorage.removeItem("spesen_sync_aus");
  if (localStorage.getItem("spesen_sync_aus") === "ja") {
    console.info("[Sync] Nicht aktiv (?sync=aus gesetzt).");
    return;
  }

  // ---- Schnittstelle fuer die Oberflaeche (rieb.js) ---------------------
  const zustand = { bereit: false, laedt: false, angemeldet: false, email: "", letzterAbgleich: 0, fehler: "" };
  const zuhoerer = [];
  const melden = () => zuhoerer.forEach((f) => { try { f({ ...zustand }); } catch (e) { /* nie fatal */ } });
  let meldeTimer = null;
  const abgleichGemerkt = () => {
    zustand.letzterAbgleich = Date.now();
    clearTimeout(meldeTimer); meldeTimer = setTimeout(melden, 400);   // nicht bei jedem Schluessel neu zeichnen
  };
  /* Firebase-Fehler in Worte, die ein Kollege versteht */
  const MELDUNG = {
    "auth/invalid-credential": "E-Mail oder Passwort stimmt nicht.",
    "auth/wrong-password": "E-Mail oder Passwort stimmt nicht.",
    "auth/user-not-found": "Für diese E-Mail gibt es noch kein Konto – bitte „Neues Konto“.",
    "auth/email-already-in-use": "Für diese E-Mail gibt es schon ein Konto – bitte „Anmelden“.",
    "auth/weak-password": "Das Passwort braucht mindestens 6 Zeichen.",
    "auth/invalid-email": "Die E-Mail-Adresse ist nicht gültig.",
    "auth/missing-password": "Bitte ein Passwort eingeben.",
    "auth/missing-email": "Bitte eine E-Mail-Adresse eingeben.",
    "auth/network-request-failed": "Keine Internetverbindung – bitte später noch einmal.",
    "auth/too-many-requests": "Zu viele Versuche – bitte in ein paar Minuten noch einmal.",
    "auth/requires-recent-login": "Bitte zur Sicherheit das Passwort noch einmal eingeben.",
  };
  const fehlerText = (e) => MELDUNG[e && e.code] || ("Das hat nicht geklappt" + (e && e.code ? " (" + e.code + ")." : "."));

  const SDK = "https://www.gstatic.com/firebasejs/10.12.2";

  // ---- Schluessel, die NICHT in die Cloud gehen -----------------------
  const AUSGESCHLOSSEN = new Set([
    "kfz-kaefig-v1",        // "Neue Ware zaehlen" – jede Woche neu, kein Nachweis
    "rieb-letzter-bereich", // nur "welcher Bereich war offen"
    "rieb_namen_umgestellt", // Merker der Umstellung alter Speichernamen (15.10.2026) - je Geraet
    "spesen_sync_aus",      // Geraete-Not-Aus, gehoert nicht in die Cloud
    /* Design Hell/Dunkel gilt JE GERAET (08.10.2026, Mirko: "beides
       individuell auswählbar ... und das selbe dann für die pc version
       auch"; unter "Mehr" steht "Gilt für dieses Gerät"). Ohne diesen
       Eintrag haette ein Wechsel am Handy den PC nach 4 s neu geladen und
       mit umgestellt. */
    "rieb_design",
  ]);
  // Interne Hilfsschluessel dieses Moduls (nie synchronisieren)
  /* Ergaenzt 07.10.2026: Firebase legt selbst Merker im Browserspeicher ab
     ("firestore_zombie_firestore/[DEFAULT]/…"). Der Abgleich versuchte, auch
     diese hochzuladen - das scheitert an den Schraegstrichen (gefunden im
     Zwei-Geraete-Test mit dem Emulator, sync-pruefen.js). Schluessel mit "/"
     kann Firestore grundsaetzlich nicht als Dokument anlegen. */
  const istIntern = (k) =>
    k.startsWith("__sync") || k.includes("__shadow_") || k === "emailForSignIn"
    || k.startsWith("firestore_") || k.includes("/");

  const syncFaehig = (k) =>
    typeof k === "string" && !AUSGESCHLOSSEN.has(k) && !istIntern(k);

  const META_KEY = "__sync_meta";          // { key: zuletztGeaendertMillis }
  const DEVICE_KEY = "__sync_device";       // stabile Geraete-Kennung
  const MAX_WERT = 900_000;                 // Firestore-Dok-Limit ~1 MB

  // Original-Funktionen sichern (bevor gepatcht wird)
  const _setItem = Storage.prototype.setItem;
  const _removeItem = Storage.prototype.removeItem;

  const geraet = (() => {
    let d = localStorage.getItem(DEVICE_KEY);
    if (!d) { d = "g_" + Math.random().toString(36).slice(2, 10); _setItem.call(localStorage, DEVICE_KEY, d); }
    return d;
  })();

  const metaLesen = () => {
    try { return JSON.parse(localStorage.getItem(META_KEY) || "{}"); } catch { return {}; }
  };
  const metaSchreiben = (m) => _setItem.call(localStorage, META_KEY, JSON.stringify(m));
  const metaSetzen = (key, ts) => { const m = metaLesen(); m[key] = ts; metaSchreiben(m); };

  // ---- Firebase laden & starten ---------------------------------------
  let db, auth, uid = null;
  const pushWarteschlange = new Map();   // key -> timer
  let anwendenLaeuft = false;            // Echo-Sperre: Remote wird gerade angewendet
  let reloadTimer = null;

  // ---- PDF-Sync (Version 2) -------------------------------------------
  // Die im Tool abgelegten PDFs (IndexedDB "spesen-pdf-archiv") wandern als
  // Base64 in die Unter-Sammlung users/{uid}/pdfs/{id}. Dieselbe Gatung wie
  // der state-Sync (nur angemeldet, seit 09.10.2026 fuer alle). Siehe firestore.rules.
  const PDF_TOOBIG_KEY = "__sync_pdf_toobig"; // { id: byteGroesse } – zu gross fuer ein Firestore-Dok
  const cloudPdfIds = new Set();              // IDs, die aktuell in der Cloud liegen (aus dem Snapshot)
  let anwendenPdfLaeuft = false;              // Echo-Sperre: ein Download wird gerade lokal abgelegt
  let pdfPeriodischLaeuft = false;            // Intervall-Wächter nur einmal starten

  const pdfToobigLesen = () => {
    try { return JSON.parse(localStorage.getItem(PDF_TOOBIG_KEY) || "{}") || {}; } catch { return {}; }
  };
  const pdfToobigMerken = (id, size) => {
    try { const m = pdfToobigLesen(); m[id] = size; _setItem.call(localStorage, PDF_TOOBIG_KEY, JSON.stringify(m)); } catch {}
  };
  const pdfToobigLoeschen = (id) => {
    try { const m = pdfToobigLesen(); if (m[id] != null) { delete m[id]; _setItem.call(localStorage, PDF_TOOBIG_KEY, JSON.stringify(m)); } } catch {}
  };

  // Blob -> Base64 (ohne "data:...;base64,"-Praefix). Null bei Fehler.
  function blobZuBase64(blob) {
    return new Promise((res) => {
      try {
        const r = new FileReader();
        r.onload = () => {
          const s = String(r.result || "");
          const i = s.indexOf(",");
          res(i >= 0 ? s.slice(i + 1) : "");
        };
        r.onerror = () => { console.warn("[Sync] Blob->Base64 fehlgeschlagen"); res(null); };
        r.readAsDataURL(blob);
      } catch (e) { console.warn("[Sync] Blob->Base64 fehlgeschlagen:", e.message); res(null); }
    });
  }

  // Base64 -> Blob (application/pdf). Null bei Fehler.
  function base64ZuBlob(b64) {
    try {
      const bin = atob(b64);
      const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      return new Blob([arr], { type: "application/pdf" });
    } catch (e) { console.warn("[Sync] Base64->Blob fehlgeschlagen:", e.message); return null; }
  }

  /* Firebase erst laden, wenn es gebraucht wird (siehe "Aktivierung") - einmal */
  let ladeVersprechen = null;
  function bereitMachen() {
    if (ladeVersprechen) return ladeVersprechen;
    zustand.laedt = true; zustand.fehler = ""; melden();
    ladeVersprechen = Promise.all([
      import(`${SDK}/firebase-app.js`),
      import(`${SDK}/firebase-auth.js`),
      import(`${SDK}/firebase-firestore.js`),
    ]).then(([appMod, authMod, fsMod]) => starten(appMod, authMod, fsMod))
      .then(() => { zustand.bereit = true; zustand.laedt = false; melden(); })
      .catch((e) => {
        console.error("[Sync] Firebase konnte nicht geladen werden:", e);
        zustand.laedt = false; zustand.fehler = "Keine Verbindung zum Abgleich – bitte später noch einmal.";
        ladeVersprechen = null; melden();
        throw e;
      });
    return ladeVersprechen;
  }
  if (localStorage.getItem("__sync_uid")) bereitMachen().catch(() => {});

  async function starten(appMod, authMod, fsMod) {
    const app = appMod.initializeApp(cfg);
    auth = authMod.getAuth(app);

    // Firestore mit Offline-Speicher (puffert Schreibvorgaenge ohne Netz)
    db = fsMod.initializeFirestore(app, {
      localCache: fsMod.persistentLocalCache({}),
    });
    // Modul-weit gebrauchte Firestore-Funktionen merken
    FS = fsMod;

    /* PRUEFUMGEBUNG (07.10.2026): NUR auf diesem Rechner (localhost) und NUR
       mit ?sync-test in der Adresse -> lokale Firebase-Emulatoren statt
       echter Cloud. So laesst sich der Abgleich mit zwei Browsern pruefen,
       ohne Mirkos Konto und ohne echte Daten (sync-test/ im Spesen-Tool-
       Ordner). Auf rieb-spesen.de wirkungslos: dort ist der Hostname nie
       localhost. */
    const lokal = location.hostname === "localhost" || location.hostname === "127.0.0.1";
    if (lokal && (params.has("sync-test") || sessionStorage.getItem("__sync_test") === "ja")) {
      sessionStorage.setItem("__sync_test", "ja");
      authMod.connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
      fsMod.connectFirestoreEmulator(db, "127.0.0.1", 8080);
      console.info("[Sync] PRUEFUMGEBUNG: Firebase-Emulatoren auf diesem Rechner");
    }

    // --- Magic-Link: Rueckkehr vom Login-Link abfangen ---------------
    if (authMod.isSignInWithEmailLink(auth, window.location.href)) {
      let email = localStorage.getItem("emailForSignIn");
      if (!email) email = window.prompt("Zur Bestaetigung bitte dieselbe E-Mail eingeben:");
      try {
        await authMod.signInWithEmailLink(auth, email, window.location.href);
        localStorage.removeItem("emailForSignIn");
        // Login-Parameter aus der Adresszeile entfernen
        history.replaceState(null, "", window.location.pathname);
      } catch (e) {
        alert("Anmeldung fehlgeschlagen: " + e.message);
      }
    }

    AUTH = authMod;
    auth.languageCode = "de";   // Mails von Firebase (Passwort vergessen) auf Deutsch
    authMod.onAuthStateChanged(auth, (user) => {
      uid = user ? user.uid : null;
      zustand.angemeldet = !!user; zustand.email = user ? user.email || "" : "";
      melden();
      /* Nicht (mehr) angemeldet: Merker weg - beim naechsten Start wird
         Firebase dann gar nicht erst geladen */
      if (!user) _removeItem.call(localStorage, "__sync_uid");
      /* Mirkos Ansicht (10.10.2026, Weg A): nur mit Name UND Mirkos Konto -
         siehe istMirko() in index.html. Merker je Geraet ("__sync…" geht nie
         in die Cloud). Aendert er sich (an-/abgemeldet), einmal neu laden,
         damit Startseite und Bereiche passen. */
      const MIRKO_KONTO = "mirkorieb@t-online.de";
      const mirkoVorher = localStorage.getItem("__sync_mirko");
      const mirkoJetzt = user && String(user.email || "").toLowerCase() === MIRKO_KONTO ? MIRKO_KONTO : null;
      if (mirkoJetzt) _setItem.call(localStorage, "__sync_mirko", mirkoJetzt); else _removeItem.call(localStorage, "__sync_mirko");
      if ((mirkoVorher || null) !== mirkoJetzt) reloadPlanen();
      if (user) {
        localStorage.removeItem("emailForSignIn");
        // Konto gewechselt (oder erstmalig)? Dann den Sync-Merker leeren,
        // damit die lokalen Daten frisch mit DIESEM Konto abgeglichen und
        // (bei leerem Cloud-Konto) vollstaendig hochgeladen werden. Ohne das
        // wuerde nach einem Kontowechsel nichts hochgehen (alte Zeitstempel).
        if (localStorage.getItem("__sync_uid") !== user.uid) {
          _removeItem.call(localStorage, META_KEY);
          _setItem.call(localStorage, "__sync_uid", user.uid);
        }
        patchAnbringen();
        anhoeren();          // Cloud -> Geraet (Live)
        // Beim Start ERST alles aus der Cloud holen, DANN vorhandene lokale
        // Daten hochschieben, die es in der Cloud noch nicht gibt. So wandert
        // beim ersten Login auf einem Geraet mit bestehenden Daten alles
        // nach oben, und ein leeres zweites Geraet bekommt es danach.
        ersteVollsicht().then(erstPushAllesRauf);

        // --- Dasselbe fuer die abgelegten PDFs (Version 2) ---
        pdfPatchAnbringen();                           // neue PDFs prompt hochladen
        pdfAnhoeren();                                 // Cloud -> Geraet (Live)
        pdfErstVollsicht().then(pdfErstPushRauf);      // erst holen, dann fehlende hochladen
        pdfPeriodischStarten();                        // Sicherheitsnetz, falls der Patch mal nicht greift
      }
    });
    /* Die schwebende Marke "☁︎ Sync" (loginOberflaeche, bis 09.10.2026) ist
       weg - angemeldet wird unter "Mehr" -> "Geraete abgleichen" (rieb.js). */
  }

  let FS, AUTH;

  // ---- Geraet -> Cloud: localStorage patchen --------------------------
  function patchAnbringen() {
    if (Storage.prototype.__spesenGepatcht) return;
    Storage.prototype.setItem = function (key, value) {
      _setItem.call(this, key, value);
      if (this === window.localStorage && !anwendenLaeuft && syncFaehig(key)) {
        metaSetzen(key, Date.now());
        pushPlanen(key);
      }
    };
    Storage.prototype.removeItem = function (key) {
      _removeItem.call(this, key);
      if (this === window.localStorage && !anwendenLaeuft && syncFaehig(key)) {
        // Einen eingereichten Monat NICHT per Loeschung in die Cloud tragen
        if (!key.startsWith("spesen_submitted_")) {
          metaSetzen(key, Date.now());
          pushPlanen(key, true);
        }
      }
    };
    Storage.prototype.__spesenGepatcht = true;
  }

  function pushPlanen(key, geloescht = false) {
    if (!uid) return;
    clearTimeout(pushWarteschlange.get(key));
    pushWarteschlange.set(key, setTimeout(() => pushJetzt(key, geloescht), 1500));
  }

  async function pushJetzt(key, geloescht) {
    if (!uid) return;
    try {
      const ref = FS.doc(db, "users", uid, "state", key);
      if (geloescht) {
        await FS.deleteDoc(ref);
        return;
      }
      const value = localStorage.getItem(key);
      if (value == null) return;
      if (value.length > MAX_WERT) {
        console.warn("[Sync] Wert zu gross fuer Sync, uebersprungen:", key, value.length);
        return;
      }
      await FS.setDoc(ref, {
        value,
        clientTime: Date.now(),
        updatedAt: FS.serverTimestamp(),
        device: geraet,
      });
      abgleichGemerkt();
    } catch (e) {
      // Offline landet der Schreibvorgang im Firestore-Puffer und geht spaeter raus.
      console.warn("[Sync] Push wartet/fehlgeschlagen:", key, e.message);
    }
  }

  // ---- Cloud -> Geraet: Live zuhoeren ---------------------------------
  function anhoeren() {
    if (!uid) return;
    const coll = FS.collection(db, "users", uid, "state");
    FS.onSnapshot(coll, (snap) => {
      snap.docChanges().forEach((ch) => {
        if (ch.type === "removed") return; // Loeschungen konservativ ignorieren
        anwenden(ch.doc.id, ch.doc.data());
      });
    }, (e) => console.warn("[Sync] Listener-Fehler:", e.message));
  }

  async function ersteVollsicht() {
    try {
      const coll = FS.collection(db, "users", uid, "state");
      const snap = await FS.getDocs(coll);
      snap.forEach((d) => anwenden(d.id, d.data()));
      abgleichGemerkt();
    } catch (e) {
      console.warn("[Sync] Erstabgleich:", e.message);
    }
  }

  // Bereits vorhandene lokale Daten, die noch NICHT synchronisiert wurden,
  // einmalig hochschieben. Laeuft NACH ersteVollsicht(): Alles, was von dort
  // schon einen Zeitstempel (meta) hat, ueberspringen; nur die echten
  // Alt-Bestaende dieses Geraets gehen rauf. So landen beim ersten Login die
  // vorhandenen Eintraege in der Cloud, ohne Cloud-Neueres zu ueberschreiben.
  function erstPushAllesRauf() {
    const meta = metaLesen();
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!syncFaehig(k)) continue;
      if (meta[k]) continue; // schon von hier gepusht oder aus der Cloud geholt
      metaSetzen(k, Date.now());
      pushJetzt(k, false);
    }
  }

  // Einen Remote-Stand ins localStorage uebernehmen, WENN er neuer ist.
  function anwenden(key, data) {
    if (!data || typeof data.value === "undefined") return;
    if (!syncFaehig(key)) return;

    const meta = metaLesen();
    const lokalTs = meta[key] || 0;
    const remoteTs = data.clientTime || 0;
    // Nur uebernehmen, wenn Remote echt neuer ist (und nicht das eigene Echo)
    if (remoteTs <= lokalTs) return;
    if (localStorage.getItem(key) === data.value) { metaSetzen(key, remoteTs); return; }

    // Schatten-Sicherung fuer den grossen Arbeitszeit-Block
    if (key === "spesen_overrides") {
      const alt = localStorage.getItem(key);
      if (alt) _setItem.call(localStorage, key + "__shadow_" + Date.now(), alt);
      schattenAufraeumen(key); // nur die letzten paar behalten
    }

    // Anwenden OHNE erneuten Push (Echo-Sperre)
    anwendenLaeuft = true;
    _setItem.call(localStorage, key, data.value);
    anwendenLaeuft = false;
    metaSetzen(key, remoteTs);
    abgleichGemerkt();

    // Ansicht auffrischen – aber nicht, waehrend gerade getippt wird.
    reloadPlanen();
  }

  function schattenAufraeumen(key) {
    const praefix = key + "__shadow_";
    const treffer = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(praefix)) treffer.push(k);
    }
    treffer.sort();
    while (treffer.length > 5) _removeItem.call(localStorage, treffer.shift());
  }

  /* Weiches Neuladen nach einem Abgleich von einem anderen Geraet.
     Bis 09.10.2026 wartete es nur auf Eingabefelder - ein offener Tag-Bogen,
     das Dreh-Rad oder die Einrichtung wurden mitten in der Eingabe neu
     geladen (Eingabe weg). Jetzt dieselben Regeln wie guterMoment() der
     Update-Pruefung in index.html (Entscheidung 31). Danach zurueck in
     denselben Bereich, ohne Einstieg (rieb.js liest "rieb_nach_abgleich"). */
  function guterMoment() {
    if (document.querySelector(".modal-overlay")) return false;
    const ebene = document.getElementById("ebene");
    if (ebene && !ebene.hidden) return false;
    if (document.querySelector(".time-wheel-overlay, #einrichtung:not([hidden]), #brief")) return false;
    const a = document.activeElement;
    if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) return false;
    return true;
  }
  function reloadPlanen() {
    clearTimeout(reloadTimer);
    reloadTimer = setTimeout(() => {
      if (!guterMoment()) { reloadPlanen(); return; } // noch beschaeftigt -> spaeter
      try { sessionStorage.setItem("rieb_nach_abgleich", (typeof window.riebBereich === "function" && window.riebBereich()) || "start"); } catch (e) { /* egal */ }
      location.reload();
    }, 4000);
  }

  // ---- Anmelden, Konto, Abmelden - die Oberflaeche dazu ist in rieb.js --
  // (bis 09.10.2026: schwebende Marke "☁︎ Sync" + Browser-Abfragen; der alte
  // Block steht in Sicherungen/firebase-sync-alter-login-block.txt)
  async function anmelden(email, pw) {
    try { await bereitMachen(); } catch (e) { return { ok: false, meldung: zustand.fehler }; }
    try { await AUTH.signInWithEmailAndPassword(auth, String(email || "").trim(), pw || ""); return { ok: true }; }
    catch (e) { return { ok: false, meldung: fehlerText(e) }; }
  }
  /* Neues Konto. "fassung" = welcher Datenschutzhinweis bestaetigt wurde -
     Zeitpunkt + Fassung liegen im Konto (users/{uid}/konto/einwilligung),
     damit sich die Einwilligung belegen laesst. */
  async function registrieren(email, pw, fassung) {
    if (!fassung) return { ok: false, meldung: "Bitte den Datenschutzhinweis bestätigen." };
    try { await bereitMachen(); } catch (e) { return { ok: false, meldung: zustand.fehler }; }
    try {
      const cred = await AUTH.createUserWithEmailAndPassword(auth, String(email || "").trim(), pw || "");
      try {
        await FS.setDoc(FS.doc(db, "users", cred.user.uid, "konto", "einwilligung"),
          { fassung, clientTime: Date.now(), zeit: FS.serverTimestamp() });
      } catch (e) { console.warn("[Sync] Einwilligung nicht abgelegt:", e.message); }
      return { ok: true };
    } catch (e) { return { ok: false, meldung: fehlerText(e) }; }
  }
  async function passwortVergessen(email) {
    if (!String(email || "").trim()) return { ok: false, meldung: "Bitte zuerst oben Ihre E-Mail eintragen." };
    try { await bereitMachen(); } catch (e) { return { ok: false, meldung: zustand.fehler }; }
    try { await AUTH.sendPasswordResetEmail(auth, String(email).trim()); return { ok: true }; }
    catch (e) {
      // Nicht verraten, ob es zu einer Adresse ein Konto gibt
      if (e.code === "auth/user-not-found") return { ok: true };
      return { ok: false, meldung: fehlerText(e) };
    }
  }
  async function abmelden({ neuLaden = true } = {}) {
    try {
      if (auth && AUTH) await AUTH.signOut(auth);
      _removeItem.call(localStorage, "__sync_uid");
      _removeItem.call(localStorage, META_KEY);
      if (neuLaden) location.reload();
      return { ok: true };
    } catch (e) { return { ok: false, meldung: fehlerText(e) }; }
  }
  /* Konto loeschen: Passwort noch einmal (Firebase verlangt eine frische
     Anmeldung), dann alle Cloud-Daten des Kontos und das Konto selbst.
     Auf DIESEM Geraet bleibt alles. */
  async function kontoLoeschen(pw) {
    const user = auth && auth.currentUser;
    if (!user) return { ok: false, meldung: "Nicht angemeldet." };
    try { await AUTH.reauthenticateWithCredential(user, AUTH.EmailAuthProvider.credential(user.email, pw || "")); }
    catch (e) { return { ok: false, meldung: fehlerText(e) }; }
    try {
      pushWarteschlange.forEach((t) => clearTimeout(t)); pushWarteschlange.clear();
      await window.spesenSyncCloudLeeren();                     // state + pdfs
      try { await FS.deleteDoc(FS.doc(db, "users", user.uid, "konto", "einwilligung")); } catch (e) { /* weiter */ }
      await AUTH.deleteUser(user);
      _removeItem.call(localStorage, "__sync_uid");
      location.reload();
      return { ok: true };
    } catch (e) { return { ok: false, meldung: fehlerText(e) }; }
  }
  window.riebSync = {
    zustand: () => ({ ...zustand }),
    beiAenderung: (f) => { if (typeof f === "function") zuhoerer.push(f); },
    anmelden, registrieren, passwortVergessen, abmelden, kontoLoeschen,
  };
  window.dispatchEvent(new Event("rieb-sync-bereit"));

  // =====================================================================
  //  PDF-Ablage synchronisieren (Version 2)
  // =====================================================================

  // Monkey-Patch von window.pdfDbAblegen: nach erfolgreichem lokalem Ablegen
  // (Rueckgabe true) die PDF zusaetzlich in die Cloud schieben. Verhalten und
  // Rueckgabewert des Originals bleiben unveraendert; der Upload laeuft daneben.
  // index.html ist ein KLASSISCHES Script -> die Funktionsdeklaration
  // pdfDbAblegen ist eine window-Property, der Patch greift also auch fuer die
  // bare-identifier-Aufrufe aus index.html (im Test verifiziert).
  function pdfPatchAnbringen() {
    if (window.__spesenPdfGepatcht) return;
    const orig = window.pdfDbAblegen;
    if (typeof orig !== "function") return; // index.html noch nicht so weit -> spaeter erneut
    window.pdfDbAblegen = async function (id, blob) {
      const ok = await orig.call(this, id, blob);
      try {
        // Nicht hochladen, wenn gerade ein DOWNLOAD lokal abgelegt wird (Echo-Schleife),
        // oder wenn noch kein Nutzer angemeldet ist.
        if (ok === true && uid && db && !anwendenPdfLaeuft) pdfHochladen(id);
      } catch (e) { /* Upload darf das lokale Ablegen nie stoeren */ }
      return ok;
    };
    window.__spesenPdfGepatcht = true;
  }

  // Eine lokal abgelegte PDF in die Cloud schreiben.
  async function pdfHochladen(id) {
    if (!uid || !db || !FS) return;
    if (typeof window.pdfDbHolen !== "function") return;
    try {
      const blob = await window.pdfDbHolen(id);
      if (!blob) return;
      const b64 = await blobZuBase64(blob);
      if (!b64) return;
      if (b64.length > MAX_WERT) {
        console.warn("[Sync] PDF zu gross fuer Firestore, uebersprungen:", id, b64.length);
        pdfToobigMerken(id, blob.size);
        return;
      }
      pdfToobigLoeschen(id); // war evtl. frueher zu gross, jetzt passt es
      const ref = FS.doc(db, "users", uid, "pdfs", id);
      await FS.setDoc(ref, {
        b64,
        size: blob.size,
        updatedAt: FS.serverTimestamp(),
        device: geraet,
      });
      cloudPdfIds.add(id);
    } catch (e) {
      console.warn("[Sync] PDF-Upload wartet/fehlgeschlagen:", id, e.message);
    }
  }

  // Live auf die Cloud-PDFs hoeren und fehlende/abweichende herunterladen.
  function pdfAnhoeren() {
    if (!uid || !FS) return;
    const coll = FS.collection(db, "users", uid, "pdfs");
    FS.onSnapshot(coll, (snap) => {
      // Cloud-Id-Menge frisch aufbauen (dient dem Erst-Upload als Echo-Schutz)
      cloudPdfIds.clear();
      snap.forEach((d) => cloudPdfIds.add(d.id));
      let etwasGeholt = false;
      const arbeiten = [];
      snap.docChanges().forEach((ch) => {
        if (ch.type === "removed") return; // Loeschungen konservativ ignorieren
        arbeiten.push(pdfHerunterladen(ch.doc.id, ch.doc.data()).then((g) => { if (g) etwasGeholt = true; }));
      });
      Promise.all(arbeiten).then(() => { if (etwasGeholt) ordnerAuffrischen(); });
    }, (e) => console.warn("[Sync] PDF-Listener-Fehler:", e.message));
  }

  // Eine Cloud-PDF lokal ablegen, WENN sie fehlt oder eine andere Groesse hat.
  // Liefert true, wenn wirklich etwas geschrieben wurde.
  async function pdfHerunterladen(id, data) {
    if (!data || !data.b64) return false;
    if (typeof window.pdfDbHolen !== "function" || typeof window.pdfDbAblegen !== "function") return false;
    try {
      const vorhanden = await window.pdfDbHolen(id);
      if (vorhanden && typeof data.size === "number" && vorhanden.size === data.size) return false; // schon da
      const blob = base64ZuBlob(data.b64);
      if (!blob) return false;
      // Lokal ablegen OHNE erneuten Upload (Echo-Sperre)
      anwendenPdfLaeuft = true;
      try { await window.pdfDbAblegen(id, blob); }
      finally { anwendenPdfLaeuft = false; }
      cloudPdfIds.add(id);
      return true;
    } catch (e) {
      console.warn("[Sync] PDF-Download fehlgeschlagen:", id, e.message);
      return false;
    }
  }

  // Beim Login einmal alle Cloud-PDFs holen und die Id-Menge aufbauen.
  async function pdfErstVollsicht() {
    if (!uid || !FS) return;
    try {
      const coll = FS.collection(db, "users", uid, "pdfs");
      const snap = await FS.getDocs(coll);
      cloudPdfIds.clear();
      let etwasGeholt = false;
      const arbeiten = [];
      snap.forEach((d) => {
        cloudPdfIds.add(d.id);
        arbeiten.push(pdfHerunterladen(d.id, d.data()).then((g) => { if (g) etwasGeholt = true; }));
      });
      await Promise.all(arbeiten);
      if (etwasGeholt) ordnerAuffrischen();
    } catch (e) {
      console.warn("[Sync] PDF-Erstabgleich:", e.message);
    }
  }

  // Beim Login alle lokalen PDFs hochladen, die in der Cloud fehlen.
  async function pdfErstPushRauf() {
    if (!uid) return;
    if (typeof window.pdfDbSchluessel !== "function") return;
    try {
      const ids = await window.pdfDbSchluessel();
      for (const id of ids) {
        if (cloudPdfIds.has(id)) continue; // schon in der Cloud (oder gerade geholt)
        await pdfHochladen(id);
      }
    } catch (e) {
      console.warn("[Sync] PDF-Erstupload:", e.message);
    }
  }

  // Sicherheitsnetz: falls der Monkey-Patch einmal nicht greift (andere
  // Lade-Reihenfolge o.ae.), in Ruhe periodisch lokale PDFs abgleichen.
  function pdfPeriodischStarten() {
    if (pdfPeriodischLaeuft) return;
    pdfPeriodischLaeuft = true;
    setInterval(() => {
      if (!uid) return;
      // Patch nachziehen, falls index.html pdfDbAblegen spaeter definiert hat
      if (!window.__spesenPdfGepatcht) pdfPatchAnbringen();
      pdfErstPushRauf();
    }, 60000);
  }

  // Sichtbare Ordner-Ansichten in index.html neu rendern (Guards, falls die
  // Funktionen fehlen). Deckt die vier PDF-Ordner (Zeit/Urlaub/Jahr/Inventur) ab.
  function ordnerAuffrischen() {
    try {
      if (typeof window.ordnerAlleAuffrischen === "function") window.ordnerAlleAuffrischen();
    } catch (e) { /* nie fatal */ }
  }

  // Echter Wipe: ALLE Cloud-Dokumente dieses Kontos (pdfs + state) loeschen und
  // den lokalen Sync-Merker leeren. Wird von index.htmls testResetAlles() VOR
  // dem lokalen Loeschen aufgerufen, damit ein Reset nicht sofort wieder aus der
  // Cloud nachgeladen wird. Ohne Anmeldung passiert nichts.
  window.spesenSyncCloudLeeren = async function () {
    if (!uid || !db || !FS) return; // nicht angemeldet -> nichts tun
    try {
      for (const sammlung of ["pdfs", "state"]) {
        try {
          const coll = FS.collection(db, "users", uid, sammlung);
          const snap = await FS.getDocs(coll);
          const weg = [];
          snap.forEach((d) => weg.push(FS.deleteDoc(FS.doc(db, "users", uid, sammlung, d.id))));
          await Promise.all(weg);
        } catch (e) { console.warn("[Sync] Cloud-Leeren (" + sammlung + "):", e.message); }
      }
      cloudPdfIds.clear();
      // Lokale Sync-Merker leeren, damit nach dem Reset nichts "schon gesehen" ist
      _removeItem.call(localStorage, META_KEY);
      _removeItem.call(localStorage, "__sync_uid");
      _removeItem.call(localStorage, PDF_TOOBIG_KEY);
    } catch (e) {
      console.warn("[Sync] Cloud-Leeren fehlgeschlagen:", e.message);
    }
  };
})();
