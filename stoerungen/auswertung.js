/* =====================================================================
   stoerungen/auswertung.js - Störungsliste: Stand -> Tabellenblätter
   (11.10.2026). Mirko: Excel reicht, "die können gucken was sie draus
   machen". Sieben Blätter (Übersicht, Erfassungen, Klemmer, Gerätestörungen,
   Mona-Probleme, Automaten, Frühere Störungen – das Gedächtnis aus
   abgeschlossenen Zeiträumen, seit 13.10.2026); Fotos und Videos stehen nicht
   drin, nur ihre Anzahl.
   Gerätestörung und Mona-App-Störung sind Punkte mit Uhrzeit (12.10.2026,
   regeln.js geraetPunkte / monaPunkte - auch alte Einträge laufen darüber).
   Reine Logik, Browser (window.StoerAuswertung) und Node.
   ===================================================================== */
(function (wurzel) {
  "use strict";
  const R = (typeof module !== "undefined" && module.exports) ? require("./regeln.js") : wurzel.StoerRegeln;
  const jaNein = (b) => (b === true ? "ja" : b === false ? "nein" : "");
  const imZeitraum = (zeit, von, bis) => { const t = R.tagVon(zeit); return (!von || t >= von) && (!bis || t <= bis); };
  const nachZeit = (x, y) => (x.zeit < y.zeit ? -1 : x.zeit > y.zeit ? 1 : 0);

  /* fotoAnzahl / videoAnzahl: { erfassungsId: Anzahl } (daten.js fotoAnzahl / videoAnzahl); in Excel steht nur die Zahl, nie ein Bild oder Video */
  function blaetter(stand, zeitraum, fotoAnzahl, videoAnzahl) {
    const von = (zeitraum && zeitraum.von) || null, bis = (zeitraum && zeitraum.bis) || null;
    const fotos = fotoAnzahl || {}, videos = videoAnzahl || {};
    const erf = stand.erfassungen.filter((e) => imZeitraum(e.zeit, von, bis)).sort(nachZeit);
    const u = R.uebersicht(erf, stand.umstellung);

    const uebersicht = [
      ["Störungsliste – Auswertung", "", ""],
      ["Zeitraum", (von ? R.datumLang(von) : "Beginn") + " bis " + (bis ? R.datumLang(bis) : "heute"), ""],
      ["Umstellung ab", stand.umstellung ? R.datumLang(stand.umstellung) : "nicht festgelegt", ""],
      ["", "", ""],
      ["Kennzahl", "vorher", "nachher"],
      ["Tage mit Erfassungen", u.vorher.tage, u.nachher.tage],
      ["Geöffnete Automaten", u.vorher.geoeffnet, u.nachher.geoeffnet],
      ["Störungen (Gerät oder Klemmer)", u.vorher.stoerungen, u.nachher.stoerungen],
      ["Klemmer", u.vorher.klemmer, u.nachher.klemmer],
      ["Klemmer je 100 geöffnete Automaten", u.vorher.klemmerJe100, u.nachher.klemmerJe100],
      ["Gefundene Päckchen", u.vorher.paeckchen, u.nachher.paeckchen],
      ["Mona-Probleme", u.vorher.mona, u.nachher.mona],
      ["Probeverkauf mit Klemmer", u.vorher.probeKlemmer, u.nachher.probeKlemmer],
    ];
    /* Je Art eine Zeile (Zahl der Punkte, vorher/nachher): die sieben Geräte-Punkte und Sonstiges, dann die fünf Mona-Punkte und Sonstiges */
    const arten = R.punktArten(erf, stand.umstellung), fett = [0, 4];
    const abschnitt = (titel, liste, zaehl) => {
      uebersicht.push(["", "", ""]); fett.push(uebersicht.length);
      uebersicht.push([titel, "vorher", "nachher"]);
      for (const [name, id] of liste) uebersicht.push([name, zaehl.vorher[id], zaehl.nachher[id]]);
    };
    abschnitt("Gerätestörungen nach Art", R.GERAET_ARTEN.map((x) => [x.kurz, x.id]).concat([["Sonstiges", "sonstiges"]]), { vorher: arten.vorher.geraet, nachher: arten.nachher.geraet });
    abschnitt("Mona-App-Störungen nach Art", R.MONA_ARTEN.map((x) => [x.text, x.id]).concat([["Sonstiges", "sonstiges"]]), { vorher: arten.vorher.mona, nachher: arten.nachher.mona });
    const erfassungen = [["Datum", "Uhrzeit", "A-Nummer", "Tour", "Kürzel", "Hersteller", "Werkstatt-Modell", "innen/außen", "Phase", "Ergebnis",
      "Gerätestörung", "Mona-App-Störung", "Klemmer", "gefundene Päckchen", "Päckchen gesamt", "behoben", "behoben am", "Probeverkauf", "Werkstatt", "Fotos", "Videos"]];
    /* Gefundene Päckchen gehören zur Erfassung (seit 12.10.2026), nicht mehr zum einzelnen Klemmer - deshalb hier keine Päckchen-Spalten */
    /* „Sorte“ = Sorten-Kürzel; die interne Sortennummer steht seit 15.10.2026 nicht mehr im Excel (Mirko: „überall weg“) */
    const klemmer = [["Datum", "Uhrzeit", "A-Nummer", "Tour", "Kürzel", "Werkstatt-Modell", "innen/außen", "Phase", "Schacht/Modul/Motor", "Sorte",
      "Abstreifer", "behoben"]];
    const geraetBlatt = [["Datum", "Uhrzeit", "A-Nummer", "Tour", "Kürzel", "Hersteller", "innen/außen", "Phase", "Störung", "Schacht/Modul/Motor", "behoben"]];
    const mona = [["Datum", "Uhrzeit", "A-Nummer", "Tour", "Kürzel", "Hersteller", "Werkstatt-Modell", "innen/außen", "Text"]];
    /* „Päckchenklemmer Schacht 7 (14:05:32); Motor nicht in Grundstellung Motor 3 (14:06:01); Sonstiges: … (14:07:00)“ */
    const liste = (e, punkte) => punkte.map((p) => { const z = R.punktZeit(p, e); return R.punktText(p) + (z ? " (" + z + ")" : ""); }).join("; ");

    for (const e of erf) {
      const g = R.geraetInfo(stand, e.a), phase = R.phase(e.zeit, stand.umstellung);
      const probe = !e.probeverkauf ? "" : e.probeverkauf.ergebnis === "ok" ? "ok"
        : "Klemmer" + (e.probeverkauf.schacht ? " (Schacht " + e.probeverkauf.schacht + ")" : "");
      const werk = e.werkstattAntwort === "bestellt" ? "bestellt" : e.werkstattAntwort === "noch_nicht" ? "noch nicht" : "";
      const gp = R.gefundenePaeckchen(e);   // neue Zeilen der Erfassung plus alte aus dem Klemmer (mit der Sorte des Klemmers)
      const gPunkte = R.geraetPunkte(e), mPunkte = R.monaPunkte(e);
      erfassungen.push([R.datumLang(e.zeit), e.zeit.slice(11, 16), e.a, g.tour, g.kuerzel, g.hersteller, g.werkstattModell, g.ortText, phase,
        e.ergebnis === "ok" ? "in Ordnung" : "Störung", liste(e, gPunkte), liste(e, mPunkte),
        R.klemmerAnzahl(e), R.paeckchenText(gp), R.paeckchenSumme(e), jaNein(e.behoben), e.behobenAm ? R.datumLang(e.behobenAm) : "", probe, werk, fotos[e.id] || 0, videos[e.id] || 0]);
      for (const p of gPunkte) {
        if (p.art === "klemmer") {
          klemmer.push([R.datumLang(e.zeit), R.punktZeit(p, e), e.a, g.tour, g.kuerzel, g.werkstattModell, g.ortText, phase, R.punktNummer(p),
            R.sorteKuerzel(p.sorte || "") || R.sorteNorm(p.sorte || ""), R.abstreiferText(p.abstreifer || ""), jaNein(e.behoben)]);
        }
        geraetBlatt.push([R.datumLang(e.zeit), R.punktZeit(p, e), e.a, g.tour, g.kuerzel, g.hersteller, g.ortText, phase, R.punktName(p), R.punktNummer(p), jaNein(e.behoben)]);
      }
      for (const p of mPunkte) mona.push([R.datumLang(e.zeit), R.punktZeit(p, e), e.a, g.tour, g.kuerzel, g.hersteller, g.werkstattModell, g.ortText, R.punktName(p)]);
    }

    const imZeitraumA = new Set(erf.map((e) => e.a));
    const frueherA = (a) => R.frueherVon(stand.frueher, a);
    const automaten = [["A-Nummer", "Tour", "Kürzel", "Hersteller", "Werkstatt-Modell", "innen/außen", "Erfassungen", "Störungen", "Klemmer",
      "gefundene Päckchen", "Mona-Probleme", "Werkstattbesuche", "letzter Werkstattbesuch", "Werkstatt bestellt", "frühere Störungen"]]
      .concat(R.kartei(Object.assign({}, stand, { erfassungen: erf })).filter((z) => imZeitraumA.has(z.a)).map((z) => [z.a, z.tour, z.kuerzel,
        z.hersteller, z.werkstattModell, z.ortText, z.erfassungen, z.stoerungen, z.klemmer, z.paeckchen, z.mona, z.werkstattBesuche,
        z.letzteWerkstatt ? R.datumLang(z.letzteWerkstatt) : "", z.werkstattBestellt, frueherA(z.a).length]));
    /* Gedächtnis (13.10.2026, Mirko: frühere Störungen „ja aber auch getrennt aufgelistet“): die Automatenstörungen aus abgeschlossenen Zeiträumen –
       für die Automaten, die in dieser Auswertung vorkommen; eigenes Blatt, nie in den Blättern des laufenden Zeitraums. Neueste zuerst je Automat. */
    const frueher = [["A-Nummer", "Tour", "Kürzel", "Hersteller", "Datum", "Uhrzeit", "Gerätestörung", "gefundene Päckchen", "behoben", "behoben am", "Zeitraum abgeschlossen am"]];
    for (const a of Array.from(imZeitraumA).sort()) {
      const g = R.geraetInfo(stand, a);
      for (const e of frueherA(a)) frueher.push([a, g.tour, g.kuerzel, g.hersteller, R.datumLang(e.zeit), e.zeit.slice(11, 16), liste(e, R.geraetPunkte(e)),
        R.paeckchenSumme(e), jaNein(e.behoben), e.behobenAm ? R.datumLang(e.behobenAm) : "", e.abgeschlossen ? R.datumLang(e.abgeschlossen) : ""]);
    }

    return [
      { name: "Übersicht", zeilen: uebersicht, fett },
      { name: "Erfassungen", zeilen: erfassungen, fett: [0] },
      { name: "Klemmer", zeilen: klemmer, fett: [0] },
      { name: "Gerätestörungen", zeilen: geraetBlatt, fett: [0] },
      { name: "Mona-Probleme", zeilen: mona, fett: [0] },
      { name: "Automaten", zeilen: automaten, fett: [0] },
      { name: "Frühere Störungen", zeilen: frueher, fett: [0] },
    ];
  }
  const dateiname = (tag) => "Stoerungsliste-Auswertung-" + tag + ".xlsx";

  const A = { blaetter, dateiname, imZeitraum };
  if (typeof module !== "undefined" && module.exports) module.exports = A; else wurzel.StoerAuswertung = A;
})(typeof window !== "undefined" ? window : globalThis);
