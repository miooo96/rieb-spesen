/* bestellung/sorten-konto.js - woher die Sortentabelle kommt

   Mirko 15.10.2026: Die Sortentabelle (interne Kürzel, Nummern, Preise) gehört
   nicht in den öffentlichen Code, sondern über sein Konto auf seine Geräte
   ("Aus dem Code nehmen", in zwei Schritten).

   Schritt 1 (15.10.2026) hat die Tabelle auf Mirkos angemeldetem Gerät unter
   "rieb_sorten_v1" abgelegt; der Konto-Abgleich bringt den Eintrag auf seine
   anderen Geräte. Schritt 2 (16.10.2026): Die Tabelle steht nicht mehr im
   Programm - gelesen wird NUR noch dieser Eintrag. Fehlt er, gibt es keine
   Sortentabelle (Kürzel lassen sich trotzdem eintippen).

   Alle Stellen, die Sorten brauchen (Störungsliste, Spracheingabe,
   Testseite), fragen nur hier. */
(function () {
  "use strict";
  const KEY = "rieb_sorten_v1";
  const LEER = { liste: [], namen: {}, namenMirko: {} };
  let roh0 = null, daten0 = null;

  function ausSpeicher() {
    try {
      const roh = localStorage.getItem(KEY);
      if (!roh) return null;
      if (roh === roh0) return daten0;
      const d = JSON.parse(roh);
      if (!d || !Array.isArray(d.liste) || !d.liste.length) return null;
      roh0 = roh; daten0 = d;
      return d;
    } catch (e) { return null; }
  }
  const daten = () => ausSpeicher() || LEER;

  /* Für die Anzeige: "konto" (Eintrag da und vom Abgleich erfasst), "geraet"
     (Eintrag da, Abgleich hat ihn noch nicht), "keine" */
  function quelle() {
    if (!ausSpeicher()) return "keine";
    let meta = {};
    try { meta = JSON.parse(localStorage.getItem("__sync_meta") || "{}") || {}; } catch (e) { meta = {}; }
    return meta[KEY] ? "konto" : "geraet";
  }

  window.RiebSorten = {
    KEY,
    liste: () => daten().liste || [],
    namenEntwurf: () => daten().namen || {},
    namenMirko: () => daten().namenMirko || {},
    nrZuKuerzel: () => Object.fromEntries((daten().liste || []).map((z) => [z.nr, z.kuerzel])),
    stand: () => (ausSpeicher() || {}).stand || "",
    quelle,
  };
})();
