/* =====================================================================
   stoerungen/sprache.js - Spracheingabe der Störungsliste (14.10.2026)

   Mirko 14.10.2026: "dann nehmen wir apple mikrofon" - "am besten so, dass man
   es verwenden kann aber nicht muss, das man die wahl hat zwischen schreiben und
   sprechen" - "das sollte ja ein extra werkzeug für die störungsliste werden".

   Gesprochen wird über das Mikrofon der iPhone-Tastatur in ein Textfeld oben auf
   der Seite "Störung". Aus dem Text macht sprachtest/verstehen.js eine Meldung
   (dieselbe Auswertung wie auf der Testseite). Diese Datei trägt die Meldung in
   die Störung ein - erst wenn Mirko "Übernehmen" tippt, und nur als VORSCHLAG:
   danach steht alles in den gewohnten Knöpfen und Feldern und kann vor dem
   Speichern geändert werden (CLAUDE.md: eine Automatik ersetzt die Eingabe nie
   stillschweigend). Was sich nicht eintragen lässt, steht in "hinweise".

   Reine Logik: kein DOM, kein Speicher, kein Netz. Browser (window.StoerSprache)
   und Node (Neues Design/stoerungen-sprache-pruefen.js).
   ===================================================================== */
(function (wurzel) {
  "use strict";
  const leererTeil = () => ({ punkte: [], text: "", textUm: "", sonstiges: false });
  const zeileLeer = (z) => !String(z.sorte || "").trim() && !String(z.anzahl || "").trim() && !String(z.schacht || "").trim();
  const sortiert = (liste) => Array.from(new Set(liste)).sort((x, y) => Number(x) - Number(y));
  const gross = (t) => t.charAt(0).toUpperCase() + t.slice(1);

  /* Die Sorte einer gehörten Sorte: angetippt (bestaetigt[gehört]) geht vor dem Vorschlag. Intern wird mit der Sortennummer gesucht,
     ins Feld kommt das KÜRZEL (Mirko 15.10.2026: die Nummer „ist eine interne nummer die soll raus bleiben“). */
  function sorteNr(s, bestaetigt) {
    if (bestaetigt && bestaetigt[s.text]) return bestaetigt[s.text];
    return s.wahl && s.wahl.vorschlag ? s.wahl.vorschlag.nr : "";
  }
  const alsKuerzel = (R, wert) => (wert ? R.sorteKuerzel(wert) || wert : "");

  /* e = Entwurf der Störung (wird verändert), m = Verstehen.verstehen(...), R = StoerRegeln,
     um = Zeitstempel für neue Punkte (Moment des Übernehmens), bestaetigt = { gehört: Sortennummer } */
  function anwenden(e, m, R, um, bestaetigt) {
    const hinweise = [];
    let neu = 0;
    if (!Array.isArray(e.paeckchen)) e.paeckchen = [];

    /* Sorten: gehört zu dem Klemmer / den Päckchen mit demselben Schacht - ist nur EINE Sorte genannt, gehört sie zu allem */
    const sorten = (m.sorten || []).map((s) => ({ s, nr: alsKuerzel(R, sorteNr(s, bestaetigt)), schacht: s.schacht || "", benutzt: false }));   // nr = Kürzel fürs Feld
    const sorteFuer = (schacht) => {
      const mit = sorten.filter((x) => x.nr);
      const x = mit.find((y) => schacht && y.schacht === schacht) || (mit.length === 1 ? mit[0] : null);
      if (x) x.benutzt = true;
      return x ? x.nr : "";
    };

    /* Gerätestörung */
    for (const p of m.geraet || []) {
      const art = R.GERAET_ARTEN.find((a) => a.id === p.art); if (!art) continue;
      const nr = (p.nr || []).map(String).filter((n) => {
        const gut = Number(n) >= 1 && Number(n) <= R.NUMMERN_MAX;
        if (!gut) hinweise.push(`${art.kurz}: Nummer ${n} gibt es nicht (1 bis ${R.NUMMERN_MAX}) – bitte unten wählen`);
        return gut;
      });
      if (!e.geraet) e.geraet = leererTeil();
      if (p.art === "klemmer") {
        /* in einen angefangenen Klemmer ohne Nummer oder mit derselben Nummer - sonst ein weiterer Klemmer */
        let k = e.geraet.punkte.find((q) => q.art === "klemmer" && (!q.nr.length || (nr[0] && q.nr[0] === nr[0])));
        if (!k) { k = { art: "klemmer", nr: [], sorte: "", abstreifer: "", um }; e.geraet.punkte.push(k); }
        if (nr[0]) k.nr = [nr[0]];
        const sorte = alsKuerzel(R, p.sorte) || sorteFuer(nr[0] || "");
        if (sorte && !k.sorte) k.sorte = sorte;
        if (p.abstreifer && !k.abstreifer) k.abstreifer = p.abstreifer;
        if (!k.nr.length) hinweise.push("Päckchenklemmer: Schacht/Modul/Motor bitte unten wählen");
        neu++;
        continue;
      }
      const da = e.geraet.punkte.find((q) => q.art === p.art);
      if (da) { if (art.nr === "mehrere") da.nr = sortiert(da.nr.concat(nr)); neu++; continue; }
      e.geraet.punkte.push({ art: p.art, nr: art.nr === "mehrere" ? sortiert(nr) : [], um });
      neu++;
    }

    /* Mona-App-Störung */
    for (const p of m.mona || []) {
      if (!R.MONA_ARTEN.some((a) => a.id === p.art)) continue;
      if (!e.mona) e.mona = leererTeil();
      if (!e.mona.punkte.some((q) => q.art === p.art)) e.mona.punkte.push({ art: p.art, um });
      neu++;
    }

    /* Sonstiges: was keinem Punkt zugeordnet werden konnte - als "in eigenen Worten" ("Mona: …" zur Mona-App-Störung) */
    for (const t of m.sonstiges || []) {
      const mona = /^Mona: /.test(t), teil = mona ? "mona" : "geraet", text = gross(mona ? t.replace(/^Mona: /, "") : t);
      if (!e[teil]) e[teil] = leererTeil();
      const x = e[teil];
      if (!x.sonstiges) { x.sonstiges = true; x.textUm = um; }
      x.text = x.text && x.text.trim() ? x.text.trim() + "; " + text : text;
      neu++;
    }

    /* Gefundene Päckchen: zuerst in die leere Zeile, sonst eine neue Zeile */
    for (const p of m.paeckchen || []) {
      const zeile = { sorte: alsKuerzel(R, p.sorte) || sorteFuer(p.schacht || ""), anzahl: String(p.anzahl), schacht: p.schacht || "" };
      const frei = e.paeckchen.findIndex(zeileLeer);
      if (frei >= 0) e.paeckchen[frei] = zeile; else e.paeckchen.push(zeile);
      if (!zeile.sorte) hinweise.push(`Gefundene Päckchen (${zeile.anzahl}${zeile.schacht ? ", Schacht " + zeile.schacht : ""}): Sorte bitte unten eintragen`);
      neu++;
    }

    for (const x of sorten) {
      if (!x.nr) hinweise.push(`Sorte „${x.s.text || "?"}“ nicht gewählt – bitte unten im Feld „Sorte“ eintragen`);
      else if (!x.benutzt) hinweise.push(`Sorte ${x.nr} gehört zu keinem Klemmer und keinen Päckchen – bitte unten eintragen`);
    }
    if (m.automat && m.automat !== e.a) hinweise.push(`Gesprochen wurde ${m.automat} – erfasst wird ${e.a}. Die A-Nummer bleibt ${e.a}.`);
    if (m.ergebnis === "ok" && !neu) hinweise.push("„Alles in Ordnung“ bitte auf der Seite davor wählen – hier wird eine Störung erfasst.");
    else if (!neu) hinweise.push("Nichts erkannt, das sich eintragen lässt – bitte unten selbst auswählen.");
    return { neu, hinweise };
  }

  const api = { anwenden };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else wurzel.StoerSprache = api;
})(typeof window !== "undefined" ? window : globalThis);
