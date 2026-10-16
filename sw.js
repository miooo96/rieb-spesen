/* Service Worker für rieb-spesen.de
   =========================================

   EIN Worker für alles: Spesen-Rechner, Anleitung und die App unter /app/.

   Warum im Stammordner und nicht in /app/:
   Ein Service Worker darf nur den Ordner bedienen, in dem er liegt. Lag er
   in /app/, konnte er das Spesenblatt nicht offline verfügbar machen -
   und genau das ist gewünscht, damit in der App beides ohne Empfang läuft.
   Zwei Worker mit überlappendem Zustaendigkeitsbereich waeren unnoetig
   fehleranfaellig, deshalb einer.

   WICHTIGSTE ENTSCHEIDUNG - "Netz zuerst" fuer alle Seiten:
   Der klassische Fehler ist "Cache zuerst" fuer HTML. Dann bekommen Nutzer
   monatelang eine veraltete Fassung, und niemand versteht, warum eine
   laengst behobene Sache immer noch kaputt ist. Deshalb:

     index.html / Anleitung.html / app/  -> NETZ zuerst, Cache als Rueckfall
     version.txt                         -> NUR Netz (das Auto-Update muss
                                            ehrlich sehen koennen, ob es
                                            etwas Neues gibt)
     Bilder, Symbole, vendor/*.js        -> Cache zuerst (aendern sich fast
                                            nie, sind aber gross)

   Damit gilt: online immer aktuell, offline immer benutzbar.

   HINWEIS ZUR WEBSEITE:
   Dieser Worker macht die Webseite NICHT zur App. Dafuer braeuchte
   index.html ein verlinktes Manifest - das hat sie bewusst nicht. Es gibt
   also kein "App installieren"-Fenster fuer Kollegen. Sie merken nur, dass
   das Tool auch ohne Empfang funktioniert.

   Bei jeder Aenderung: CACHE_VERSION hochzaehlen. Diese Datei muss sich
   dabei aendern, sonst installiert der Browser den neuen Worker nicht.
*/

const CACHE_VERSION = "2026-10-16-1";
const CACHE_NAME = "rieb-spesen-" + CACHE_VERSION;
/* Eigene, nach Fassung benannte Caches - auch die mit dem frueheren Namen
   vorn (bis 15.10.2026). Erkannt am Aufbau "<name>-spesen-<datum>", damit
   fremde Caches (z. B. "rieb-mitteilungen") nie mitgeloescht werden. */
const EIGENER_CACHE = /^[a-z]+-(spesen|arbeitszeit)-\d{4}-\d{2}-\d{2}/;

/* Was beim Installieren mitgenommen wird, damit auch der allererste
   Offline-Start vollstaendig ist. Die Anleitungsbilder sind bewusst NICHT
   dabei - die sind gross und werden bei Bedarf nachgeladen. */
const SHELL = [
  "./",
  "./index.html",
  "./Anleitung.html",
  /* Die frueheren Firmenbilder (Logo, Nachtbild) sind seit 10.10.2026 nicht
     mehr dabei und seit 15.10.2026 ganz entfernt. */
  "./app/",
  "./app/index.html",
  "./app/manifest.json",
  "./favicon.ico",
  "./icons/favicon-32.png",
  "./icons/favicon-64.png",
  "./icons/favicon-180.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png",
  "./vendor/html2canvas.min.js",
  "./vendor/jspdf.umd.min.js",
  "./vendor/qrcode.min.js",
  // Neue Oberflaeche "Rieb Spesen" (08.10.2026) - ohne sie startet die App offline nackt
  "./rieb.css",
  "./rieb.js",
  // Stoerungsliste (11.10.2026, nur Mirko) - muss auch ohne Empfang am Automaten laufen
  "./stoerungen/regeln.js",
  "./stoerungen/auswertung.js",
  "./stoerungen/excel.js",
  "./stoerungen/daten.js",
  "./stoerungen/bericht.js",
  // Spracheingabe der Stoerungsliste (14.10.2026)
  "./bestellung/sorten-konto.js",
  "./sprachtest/verstehen.js",
  "./stoerungen/sprache.js",
  "./sprachtest/mengen.js",          // Zaehlen per Sprache, Fahrzeug-Inventur (14.10.2026)
  "./stoerungen/oberflaeche.js",
  "./stoerungen/stoerungen.css",
  "./schrift/Geist-Variable.woff2",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // Einzeln statt addAll: eine fehlende Datei soll nicht die ganze
      // Installation scheitern lassen.
      Promise.all(SHELL.map((url) =>
        cache.add(new Request(url, { cache: "reload" })).catch(() => null)
      ))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((namen) => Promise.all(
        namen.filter((n) => EIGENER_CACHE.test(n) && n !== CACHE_NAME)
             .map((n) => caches.delete(n))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // version.txt: ausschliesslich Netz, damit das Auto-Update ehrlich bleibt
  if (url.pathname.endsWith("version.txt")) {
    event.respondWith(fetch(req).catch(() => new Response("", { status: 504 })));
    return;
  }

  /* Die neue Oberflaeche (rieb.js, rieb.css - 08.10.2026) gehoert zur
     Seite und aendert sich mit jeder Veroeffentlichung. "Cache zuerst"
     wuerde eine ALTE rieb.js zu einer NEUEN index.html liefern - dieselbe
     Falle wie am 05.09.2026 (drei Veroeffentlichungen liefen ins Leere).
     Deshalb Netz zuerst, Cache als Rueckfall - ohne den Umweg auf
     index.html, der fuer eine Skriptdatei falsch waere. */
  /* Stoerungsliste (11.10.2026): dieselbe Falle wie rieb.js - also auch
     Netz zuerst, sonst kaeme eine alte oberflaeche.js zu einer neuen Seite. */
  if (/\/(rieb\.(js|css)|stoerungen\/[a-z]+\.(js|css))$/.test(url.pathname)) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const kopie = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, kopie)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req).then((treffer) => treffer || new Response("", { status: 504 })))
    );
    return;
  }

  const istSeite = req.mode === "navigate" || url.pathname.endsWith(".html") || url.pathname.endsWith("/");

  if (istSeite) {
    // Netz zuerst, Cache als Rueckfall
    event.respondWith(
      fetch(req)
        .then((res) => {
          const kopie = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, kopie)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req).then((treffer) =>
          treffer || caches.match(url.pathname.indexOf("/app/") === 0 ? "./app/index.html" : "./index.html")))
    );
    return;
  }

  // Alles andere: Cache zuerst, sonst Netz
  event.respondWith(
    caches.match(req).then((treffer) => treffer || fetch(req).then((res) => {
      const kopie = res.clone();
      caches.open(CACHE_NAME).then((c) => c.put(req, kopie)).catch(() => {});
      return res;
    }))
  );
});

/* ---------------- Mitteilungen (11.10.2026) ----------------
   Der Weckruf (GitHub, senden.mjs) enthaelt NUR das Datum: {"t":"2026-10-12"}.
   Titel und Text hat das Geraet selbst vorausgerechnet (rieb.js, mtVorausrechnen)
   und im Cache "rieb-mitteilungen" abgelegt - Name und Eintraege verlassen das
   Geraet nie. Der Cache heisst bewusst nicht "…-spesen-<datum>": den
   raeumt "activate" oben bei jeder neuen Fassung weg.
   Apple verlangt: JEDER Weckruf zeigt sichtbar etwas an, sonst entzieht
   Safari das Abo nach drei Mal still. Darum immer ein Rueckfall-Text und
   alles in event.waitUntil. */
const MT_CACHE = "rieb-mitteilungen";
const MT_DATEI = "/__mitteilungen.json";
const mtHeute = () => { const d = new Date(), z = (n) => String(n).padStart(2, "0"); return d.getFullYear() + "-" + z(d.getMonth() + 1) + "-" + z(d.getDate()); };

self.addEventListener("push", (event) => {
  event.waitUntil((async () => {
    let tag = mtHeute();
    try { const d = event.data ? event.data.json() : null; if (d && /^\d{4}-\d\d-\d\d$/.test(d.t || "")) tag = d.t; } catch (e) { /* kein Datum -> heute */ }
    let eintrag = null;
    try {
      const r = await (await caches.open(MT_CACHE)).match(MT_DATEI);
      if (r) { const j = await r.json(); eintrag = (j.tage || []).find((x) => x.t === tag) || null; }
    } catch (e) { /* kein Vorrat -> Rueckfall */ }
    const titel = eintrag ? eintrag.titel : "Rieb Spesen";
    const text = eintrag ? eintrag.text : "Schauen Sie mal wieder rein – Ihr Spruch des Tages wartet.";
    await self.registration.showNotification(titel, { body: text, icon: "/icons/icon-192.png", tag: "rieb-tag", lang: "de", data: { url: "/index.html" } });
  })());
});

/* Antippen: offene App nach vorn holen, sonst oeffnen */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const fenster = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const f of fenster) { if ("focus" in f) return f.focus(); }
    return self.clients.openWindow((event.notification.data && event.notification.data.url) || "/index.html");
  })());
});
