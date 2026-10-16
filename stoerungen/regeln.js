/* =====================================================================
   stoerungen/regeln.js - Störungsliste: Stammdaten und Rechenregeln
   (11.10.2026; Entwurf: Vault "Spesen Tool/Störungsliste - Entwurf.md")

   Reine Logik: kein DOM, kein Speicher, kein Netz. Läuft im Browser
   (window.StoerRegeln) und in Node (module.exports), damit die Regeln
   ohne Browser geprüft werden können (Neues Design/stoerungen-regeln-test.js).
   ===================================================================== */
(function (wurzel) {
  "use strict";

  /* Kürzel vom Verkaufsbericht - Pflicht beim Anlegen (Mirko 11.10.2026:
     "auf unserem Verkaufsbericht stehen die Modelle so wie ich sie im
     Kürzel durchgegeben habe"). Eine Zuordnung zu den Werkstatt-Modellen
     ist nirgends belegt und wird deshalb NICHT vorgegeben. */
  const KUERZEL_START = [
    ["SI20", "Sielaff"], ["SI24", "Sielaff"], ["GR25", "Grünig Poth"], ["GR26", "Grünig Poth"],
    ["HA15", "Harting"], ["HA20", "Harting"], ["HA24", "Harting"], ["AZ23", "Azkoyen"],
    ["AZ26", "Azkoyen"], ["Touch", "Harting"], ["Touch XL", "Harting"],
  ].map(([kuerzel, hersteller], i) => ({ kuerzel, hersteller, reihe: i + 1 }));

  /* Modelle laut Werkstatt-Mitarbeiter - freiwillig, nur in der Kartei
     ("die Werkstattliste kennt aber kein Füllfahrer"). */
  const WERKSTATT_START = [
    ["Sielaff", "SC 20-02"], ["Sielaff", "SC100"], ["Sielaff", "SC200"], ["Sielaff", "SC300"],
    ["Harting", "Towerline 315"], ["Harting", "TL 520"], ["Harting", "TL Touch Basic"], ["Harting", "TL Touch (U)"],
    ["Azkoyen", "Teide75"], ["Azkoyen", "N61"], ["Azkoyen", "N74"],
    ["Grünig Poth", "SE20"], ["Grünig Poth", "SE26"],
    ["S&Z", "Serie 1"], ["S&Z", "SZX"],
  ].map(([hersteller, modell], i) => ({ id: hersteller + "|" + modell, hersteller, modell, reihe: i + 1 }));

  /* Abstreifer je Schacht (Mirko 11.10.2026): sitzt im Schacht bzw. am
     Auswurfmotor, verhindert bei kleinen Packungen das Doppel-Päckchen;
     "immer eine wichtige Ursache wegen Störungen". Terea: je nach Automat
     Plastik-Abstreifer ODER Einsetzblech - nie beides im selben Schacht,
     deshalb EINE Auswahl. Leer = nicht angegeben. */
  const ABSTREIFER = [
    ["kein", "kein Abstreifer"], ["schmal1", "schmal, 1 Zunge"], ["schmal2", "schmal, 2 Zungen"],
    ["breit1", "breit, 1 Zunge"], ["breit2", "breit, 2 Zungen"], ["terea", "Terea-Abstreifer (Plastik)"], ["blech", "Einsetzblech (Terea)"],
  ].map(([wert, text]) => ({ wert, text }));
  const abstreiferText = (wert) => { const x = ABSTREIFER.find((a) => a.wert === wert); return x ? x.text : ""; };

  /* ---- Zeit: Ortszeit als sortierbarer Text, bewusst ohne Zeitzone ---- */
  const zwei = (n) => String(n).padStart(2, "0");
  function lokalIso(d) {
    return d.getFullYear() + "-" + zwei(d.getMonth() + 1) + "-" + zwei(d.getDate())
      + "T" + zwei(d.getHours()) + ":" + zwei(d.getMinutes()) + ":" + zwei(d.getSeconds());
  }
  const tagVon = (iso) => String(iso || "").slice(0, 10);
  const datumKurz = (iso) => { const t = tagVon(iso); return t.slice(8, 10) + "." + t.slice(5, 7) + "."; };
  const datumLang = (iso) => datumKurz(iso) + tagVon(iso).slice(0, 4);
  function tageZwischen(vonTag, bisTag) {
    return Math.round((new Date(bisTag + "T12:00:00") - new Date(vonTag + "T12:00:00")) / 86400000);
  }
  let zaehler = 0;
  const neueId = (praefix) => praefix + "-" + Date.now().toString(36) + "-" + (++zaehler).toString(36) + Math.random().toString(36).slice(2, 6);

  /* ---- A-Nummer und Sorte ---- */
  const ziffernAus = (s) => String(s == null ? "" : s).replace(/\D/g, "");
  const aNummerGueltig = (ziffern) => /^\d{6}$/.test(String(ziffern));
  const aNummer = (ziffern) => "A" + ziffern;
  /* Sorte: Sortennummer (nur Ziffern, "18" -> "018") ODER Sorten-Kürzel aus
     Buchstaben und Zahlen ("abc10" -> "ABC10"). Mirko 12.10.2026: "bei sorte
     muss man auch das kürzel der zigaretten sorte die im schacht ist eintragen
     können also buchstaben und zahlen". Ein Kürzel, das nicht in der Tabelle
     steht, bleibt so stehen, wie es getippt wurde (Großbuchstaben). */
  /* Sortennummer <-> Kürzel zur Laufzeit, NUR aus der Sortentabelle im Konto
     (bestellung/sorten-konto.js, seit 16.10.2026 nicht mehr im Programm).
     globalThis statt window: so funktioniert es auch ohne Browser (Prüfungen). */
  let mapRoh = null, mapNr = {}, mapK = {};
  function sortenMap() {
    const RS = typeof globalThis !== "undefined" ? globalThis.RiebSorten : null;
    const quelle = (RS && RS.nrZuKuerzel()) || {};
    const roh = JSON.stringify(quelle);
    if (roh !== mapRoh) { mapRoh = roh; mapNr = quelle; mapK = Object.fromEntries(Object.entries(quelle).map(([n, k]) => [k, n])); }
    return mapNr;
  }
  const kuerzelZuNr = () => { sortenMap(); return mapK; };
  function sorteNorm(eingabe) {
    const s = String(eingabe == null ? "" : eingabe).replace(/\s+/g, "").toUpperCase();
    if (/^\d+$/.test(s)) return s.length < 3 ? s.padStart(3, "0") : s;
    return s;
  }
  const istSortenNr = (s) => /^\d+$/.test(s);
  /* Nummer zur Eingabe: bei Ziffern die Nummer selbst, bei einem Kürzel die Nummer aus der Tabelle ("" wenn unbekannt) */
  const sorteNummer = (eingabe) => { const s = sorteNorm(eingabe); return istSortenNr(s) ? s : (kuerzelZuNr()[s] || ""); };
  /* Kürzel zur Eingabe: bei Ziffern aus der Tabelle (null wenn unbekannt), bei einem Kürzel das Kürzel selbst */
  const sorteKuerzel = (eingabe) => { const s = sorteNorm(eingabe); return istSortenNr(s) ? (sortenMap()[s] || null) : (s || null); };

  /* ---- Gerätestörung und Mona-App-Störung: feste Auswahl mit Zeitstempel (Mirko 12.10.2026) ----
     Mirko: „päckchenklemmer ist ja letzten endes auch eine geräte störung“, „schacht und modul ist eigentlich dieselbe nummer“,
     „wenn man das setzt genauer zeitstempel wann es passiert ist als info hinterlegen“, „einzelne störungen auch einzeln löschen können“.

     NEUES FORMAT (ab 12.10.2026, wird nur noch dieses geschrieben):
       geraet = { punkte: [{ art, nr: ["7"] | [], sorte, abstreifer, um }], text, textUm, sonstiges }
       mona   = { punkte: [{ art, um }], text, textUm, sonstiges }
     um = Moment des Antippens (lokale Zeit mit Sekunden). „Sonstiges (in eigenen Worten)“ ist text (+ textUm); sonstiges: true heißt „gewählt“,
     auch wenn der Text leer ist. nr: bei Päckchenklemmer genau eine Nummer, bei Modul defekt / Motor beliebig viele (1-30), sonst leer.
     ALTES FORMAT (bis 12.10.2026, bleibt lesbar - überall nur über die Helfer unten):
       geraet = { text }, mona = { text }, klemmer = [{ schacht, modul, sorte, abstreifer, paeckchen? }]
     Der alte Text zählt als Sonstiges (auch leer: früher reichte das Ankreuzen), jeder alte Klemmer als Punkt „klemmer“ mit nr = [Schacht oder
     Modul] und der Zeit der Erfassung als Zeitstempel. Außerhalb dieser Datei liest niemand die rohen Felder. */
  /* Schacht, Modul und Motor tragen dieselbe Nummer – überall EINE Bezeichnung
     (Mirko 13.10.2026: „am besten sogar schacht, modul oder motor, ist ja im
     endeffekt immer die selbe belegung nur 3 verschiedene ausdrucksweisen“ –
     „ja genau wie a“: jede Störung behält ihr Zahlenraster, gleich benannt). */
  const NR_WORT = "Schacht/Modul/Motor";
  const GERAET_ARTEN = [
    ["klemmer", "Päckchenklemmer", "Päckchenklemmer", "eine", NR_WORT],
    ["modul", "Modul defekt", "Modul defekt", "mehrere", NR_WORT],
    ["tuben", "Tuben nicht füllbar", "Tuben nicht füllbar", "", ""],
    ["motor", "Motor lässt sich nicht in Grundstellung fahren", "Motor nicht in Grundstellung", "mehrere", NR_WORT],
    ["auslesen", "Automat nicht auslesbar", "Automat nicht auslesbar", "", ""],
    ["schliesst", "Automat schließt schlecht", "Automat schließt schlecht", "", ""],
    ["oeffnet", "Automat öffnet schlecht", "Automat öffnet schlecht", "", ""],
  ].map(([id, text, kurz, nr, nrWort]) => ({ id, text, kurz, nr, nrWort }));   // text = Knopf in der Oberfläche, kurz = Zeile in Liste, Excel und PDF, nr = eine | mehrere | "" (keine), nrWort = wie die Nummer heißt (ausgeschrieben, Mirko 13.10.2026: nicht „S/M“)
  const MONA_ARTEN = [
    ["vor_auslesen", "Verbindung vor dem Auslesen verloren"],
    ["preisschreibung", "Während der zweiten Preisschreibung Verbindung verloren"],
    ["gegenlesen", "Verbindung zwischen App und Auslesegerät vor dem Gegenlesen der Tuben unterbrochen, App-Neustart erforderlich"],
    ["zwangsinventur", "Nach Zwangsinventur und Umbauten Preisschreibung ohne Funktion, Verbindung zum Auslesegerät verloren"],
    ["absturz", "Mona-App abgestürzt"],
  ].map(([id, text]) => ({ id, text }));
  const SONSTIGES_TEXT = "Sonstiges (in eigenen Worten)";
  const NUMMERN_MAX = 30;   // Schacht/Modul 1-30

  const istObj = (x) => !!x && typeof x === "object";
  const hatPunkte = (t) => istObj(t) && Array.isArray(t.punkte);
  const nummern = (x) => (Array.isArray(x) ? x : []).map((n) => String(n == null ? "" : n).trim()).filter(Boolean);
  const geraetArt = (id) => GERAET_ARTEN.find((x) => x.id === id) || null;
  /* Punkte eines Teils ("geraet" | "mona") in der Reihenfolge: gewählte Punkte, alte Klemmer, Sonstiges. Immer frische Objekte. */
  function lesePunkte(e, teil) {
    const t = e ? e[teil] : null, zeit = String(e && e.zeit ? e.zeit : ""), liste = [];
    if (hatPunkte(t)) {
      for (const p of t.punkte) {
        if (!p || !p.art) continue;
        const x = { art: String(p.art) };
        if (teil === "geraet") {
          x.nr = nummern(p.nr);
          if (x.art === "klemmer") { x.sorte = String(p.sorte == null ? "" : p.sorte); x.abstreifer = String(p.abstreifer == null ? "" : p.abstreifer); }
          if (p.modul) x.modul = String(p.modul);
        }
        x.um = String(p.um || zeit);
        liste.push(x);
      }
    }
    if (teil === "geraet" && e && Array.isArray(e.klemmer)) {
      for (const k of e.klemmer) {
        if (!k) continue;
        const s = textOder(k.schacht).trim(), m = textOder(k.modul).trim();
        const x = { art: "klemmer", nr: s || m ? [s || m] : [], sorte: textOder(k.sorte), abstreifer: textOder(k.abstreifer) };
        if (s && m && s !== m) x.modul = m;   // zwei verschiedene Nummern im alten Eintrag: die zweite geht nicht verloren
        x.um = zeit;
        liste.push(x);
      }
    }
    if (istObj(t)) {
      const text = textOder(t.text).trim();
      if (hatPunkte(t) ? !!text || t.sonstiges === true : true) liste.push({ art: "sonstiges", text, um: String((hatPunkte(t) && t.textUm) || zeit) });
    }
    return liste;
  }
  const geraetPunkte = (e) => lesePunkte(e, "geraet");
  const monaPunkte = (e) => lesePunkte(e, "mona");
  const hatGeraet = (e) => geraetPunkte(e).length > 0;
  const hatMona = (e) => monaPunkte(e).length > 0;
  const klemmerAnzahl = (e) => geraetPunkte(e).filter((p) => p.art === "klemmer").length;
  /* „Päckchenklemmer · Schacht/Modul/Motor 7“ · „Modul defekt · Schacht/Modul/Motor 3, 12“ · „Tuben nicht füllbar“ · „Sonstiges: …“ · bei Mona der ganze Satz.
     Ausgeschrieben, nie „S/M“ (Mirko 13.10.2026), und für alle drei dieselbe Bezeichnung (NR_WORT). */
  function punktText(p) {
    if (!p) return "";
    const g = geraetArt(p.art);
    return g && g.nr ? punktName(p) + " · " + g.nrWort + " " + (punktNummer(p) || "?") : punktName(p);
  }
  /* Nur der Name des Punkts, ohne Nummer („Motor nicht in Grundstellung“, „Sonstiges: …“, bei Mona der ganze Satz) */
  function punktName(p) {
    if (!p) return "";
    if (p.art === "sonstiges") return "Sonstiges: " + (textOder(p.text).trim() || "–");
    const g = geraetArt(p.art);
    if (g) return g.kurz;
    const m = MONA_ARTEN.find((x) => x.id === p.art);
    return m ? m.text : textOder(p.art);
  }
  /* Schacht/Modul-Nummern als Text („7“, „3, 12“, bei einem alten Eintrag mit zwei verschiedenen Nummern „12 (Modul 2)“); leer bei Punkten ohne Nummer */
  function punktNummer(p) {
    const g = p && geraetArt(p.art);
    if (!g || !g.nr) return "";
    return nummern(p.nr).join(", ") + (p.modul ? (nummern(p.nr).length ? " " : "") + "(Modul " + p.modul + ")" : "");
  }
  /* Sorte als Klartext: nur das Kürzel („Sorte ABC10“), nie die interne Sortennummer (Mirko 15.10.2026: „das ist eine interne nummer
     die soll raus bleiben“ – „überall weg“). Alte Einträge mit Nummer werden über die Sortentabelle zum Kürzel; eine Nummer, die nicht
     in der Tabelle steht, bleibt so, wie sie getippt wurde. Leer, wenn nichts eingetragen. Namen stehen bewusst NICHT hier (Liste, PDF,
     Excel): 42 der 60 Namen sind noch Entwurf – im Bericht zählt das Kürzel. */
  function sorteKlartext(eingabe) {
    const s = sorteNorm(eingabe);
    if (!s) return "";
    return "Sorte " + (sorteKuerzel(s) || s);
  }
  /* Was zu einem Päckchenklemmer außer der Nummer gehört: Sorte (Referenz, was im Schacht sitzt) und Abstreifer */
  function punktEinzelheiten(p) {
    const z = [];
    if (p && p.art === "klemmer") {
      const s = sorteKlartext(p.sorte); if (s) z.push(s);
      if (p.abstreifer && abstreiferText(p.abstreifer)) z.push("Abstreifer: " + abstreiferText(p.abstreifer));
    }
    return z;
  }
  /* Uhrzeit des Punkts mit Sekunden; an einem anderen Tag als der Besuch mit Datum davor („11.10. 23:59:58“) */
  function punktZeit(p, e) {
    const um = String((p && p.um) || (e && e.zeit) || ""), uhr = um.slice(11, 19);
    if (!uhr) return "";
    return e && e.zeit && tagVon(um) !== tagVon(e.zeit) ? datumKurz(um) + " " + uhr : uhr;
  }
  /* Punkte (wie geraetPunkte / monaPunkte sie liefern) -> der gespeicherte Teil. Genau eine Nummer beim Klemmer, Sorte normiert, Text getrimmt. */
  function teilBauen(punkte) {
    const t = { punkte: [], text: "" };
    for (const p of punkte || []) {
      if (!p) continue;
      if (p.art === "sonstiges") { t.text = textOder(p.text).trim(); t.textUm = textOder(p.um); t.sonstiges = true; continue; }
      const g = geraetArt(p.art), x = { art: String(p.art) };
      if (g) {
        x.nr = g.nr === "eine" ? nummern(p.nr).slice(0, 1) : nummern(p.nr);
        if (g.id === "klemmer") { x.sorte = sorteNorm(p.sorte); x.abstreifer = textOder(p.abstreifer); }
        if (p.modul) x.modul = String(p.modul);
      }
      x.um = textOder(p.um);
      t.punkte.push(x);
    }
    return t;
  }
  /* Beide Teile im neuen Format (null, wenn nichts darin steht) - ohne Päckchen; auch für einen alten angefangenen Entwurf */
  function teileNeu(e) {
    const g = geraetPunkte(e), m = monaPunkte(e);
    return { geraet: g.length ? teilBauen(g) : null, mona: m.length ? teilBauen(m) : null };
  }
  /* Die ganze Erfassung im neuen Format: alte Klemmer werden Punkte, die darin gefundenen Päckchen wandern in paeckchen */
  function inNeuesFormat(e) {
    if (!e) return e;
    const gp = gefundenePaeckchen(e);
    return Object.assign({}, e, teileNeu(e), { klemmer: null, paeckchen: gp.length ? gp : null });
  }
  /* Einen Punkt streichen (wo = "geraet" | "mona", index = Stelle in geraetPunkte / monaPunkte). Liefert die Erfassung im NEUEN Format
     (auch wenn sie alt war), das Original bleibt unverändert; null, wenn es den Punkt nicht gibt. Bleibt nichts übrig, sind geraet und mona null. */
  function punktEntfernen(e, wo, index) {
    if (!e || (wo !== "geraet" && wo !== "mona")) return null;
    const g = geraetPunkte(e), m = monaPunkte(e), liste = wo === "mona" ? m : g;
    if (!Number.isInteger(index) || index < 0 || index >= liste.length) return null;
    liste.splice(index, 1);
    const gp = gefundenePaeckchen(e);
    return Object.assign({}, e, { geraet: g.length ? teilBauen(g) : null, mona: m.length ? teilBauen(m) : null, klemmer: null, paeckchen: gp.length ? gp : null });
  }
  /* Zählung je Art für die Übersicht: { vorher|nachher: { geraet: { klemmer: n, … sonstiges: n }, mona: { vor_auslesen: n, … sonstiges: n } } } */
  function punktArten(erfassungen, umstellung) {
    const leer = () => ({ geraet: Object.fromEntries(GERAET_ARTEN.map((a) => [a.id, 0]).concat([["sonstiges", 0]])),
      mona: Object.fromEntries(MONA_ARTEN.map((a) => [a.id, 0]).concat([["sonstiges", 0]])) });
    const p = { vorher: leer(), nachher: leer() };
    for (const e of erfassungen) {
      const x = p[phase(e.zeit, umstellung)];
      for (const q of geraetPunkte(e)) if (q.art in x.geraet) x.geraet[q.art]++;
      for (const q of monaPunkte(e)) if (q.art in x.mona) x.mona[q.art]++;
    }
    return p;
  }

  /* ---- Werkstatt ----
     Zählt: Gerätestörung (jeder Punkt, auch ein alter Klemmer). Mona-App-Störung NICHT (Mirko
     11.10.2026: "mona probleme haben nichts mit einer automatenstörung
     allgemein zu tun"). Grenze eines Werkstatt-Eintrags: bekanntes Datum
     -> Tagesbeginn; Datum unbekannt -> der Moment, in dem Mirko den Hinweis
     eingetragen hat (Fundtag). Alles davor stammt aus früheren Besuchen. */
  function zaehlt(e) {
    return !!e && e.ergebnis === "stoerung" && hatGeraet(e);
  }
  const werkstattGrenze = (w) => (w.datum ? w.datum + "T00:00:00" : w.erfasstUm);
  function letzteWerkstatt(werkstatt, a) {
    let best = null;
    for (const w of werkstatt) if (w.a === a && (!best || werkstattGrenze(w) > werkstattGrenze(best))) best = w;
    return best;
  }
  function zaehlendeSeitWerkstatt(erfassungen, werkstatt, a, ohneId) {
    const w = letzteWerkstatt(werkstatt, a), grenze = w ? werkstattGrenze(w) : "";
    return erfassungen.filter((e) => e.a === a && e.id !== ohneId && zaehlt(e) && e.zeit >= grenze).length;
  }
  function seitText(w) {
    if (!w) return "seit Beginn der Liste";
    return w.datum ? "seit Werkstattbesuch am " + datumKurz(w.datum) : "seit dem Werkstatt-Hinweis vom " + datumKurz(w.erfasstUm);
  }
  const ORDINALE = ["", "Erste", "Zweite", "Dritte", "Vierte", "Fünfte", "Sechste", "Siebte", "Achte", "Neunte", "Zehnte"];
  const ordinal = (n) => ORDINALE[n] || n + ".";
  /* Beim Speichern einer neuen Erfassung: null = kein Hinweis. erfassungen = ALLE Besuche (laufender Zeitraum UND früher – die Zählung läuft über das
     Abschließen eines Zeitraums hinweg, 13.10.2026).
     Ab der 2. Gerätestörung seit Beginn der Liste bzw. seit dem letzten Werkstattbesuch: „Zweite Störung … – Werkstatt bestellen?“ (frage: true).
     Mirko 13.10.2026: nicht noch einmal fragen, wenn die Werkstatt schon bestellt ist – steht seit dem letzten Werkstattbesuch bei einem Besuch dieses
     Automaten „Werkstatt bestellt“, gibt es nur den Hinweis „Werkstatt ist seit TT.MM. bestellt“ (frage: false). Erst ein eingetragener Werkstattbesuch
     setzt die Zählung zurück. */
  function werkstattHinweis(erfassungen, werkstatt, neu) {
    if (!zaehlt(neu)) return null;
    /* Nachtrag mit Datum VOR dem letzten Werkstattbesuch gehört zu einem früheren Besuch - kein Hinweis */
    const w = letzteWerkstatt(werkstatt, neu.a), grenze = w ? werkstattGrenze(w) : "";
    if (w && neu.zeit < grenze) return null;
    const vorher = zaehlendeSeitWerkstatt(erfassungen, werkstatt, neu.a, neu.id);
    if (vorher < 1) return null;
    const nr = vorher + 1;
    const bestellt = erfassungen.filter((e) => e.a === neu.a && e.id !== neu.id && e.werkstattAntwort === "bestellt" && e.zeit >= grenze)
      .reduce((x, e) => (!x || e.zeit > x.zeit ? e : x), null);
    if (bestellt) return { nr, frage: false, bestelltAm: tagVon(bestellt.zeit), text: "Werkstatt ist seit " + datumKurz(bestellt.zeit) + " bestellt" };
    return { nr, frage: true, text: ordinal(nr) + " Störung " + seitText(letzteWerkstatt(werkstatt, neu.a)) + " – Werkstatt bestellen?" };
  }
  /* Bildschirm 1, gleich nach der A-Nummer */
  function vorwarnung(erfassungen, werkstatt, a) {
    const n = zaehlendeSeitWerkstatt(erfassungen, werkstatt, a, null);
    return n < 1 ? null : n + (n === 1 ? " Störung " : " Störungen ") + seitText(letzteWerkstatt(werkstatt, a));
  }

  /* ---- Phase, offene Störung, Pflichtangaben ---- */
  const phase = (zeit, umstellung) => (umstellung && tagVon(zeit) >= umstellung ? "nachher" : "vorher");
  function offeneStoerung(erfassungen, a) {
    const offen = erfassungen.filter((e) => e.a === a && e.ergebnis === "stoerung" && e.behoben === false);
    offen.sort((x, y) => (x.zeit < y.zeit ? 1 : x.zeit > y.zeit ? -1 : 0));
    return offen[0] || null;
  }
  /* ---- Gefundene Päckchen ----
     Eigener Teil jeder Störung (Mirko 12.10.2026): e.paeckchen = [{ sorte, anzahl, schacht }] oder null.
     Sorte = Nummer oder Kürzel (darf leer sein = Sorte unbekannt), Anzahl ganze Zahl >= 1, Schacht darf leer sein.
     ALTE Einträge (bis 12.10.2026) tragen sie im Klemmer: klemmer[i].paeckchen = [{ schacht, anzahl }] ohne Sorte –
     dort gilt die Sorte des Klemmers. Sie bleiben lesbar und werden beim Ändern in den neuen Teil übernommen. */
  const textOder = (x) => String(x == null ? "" : x);
  function gefundenePaeckchen(e) {
    const liste = [];
    const nimm = (sorte, p) => { const anzahl = Number(p && p.anzahl) || 0; if (anzahl > 0) liste.push({ sorte: textOder(sorte), anzahl, schacht: textOder(p.schacht) }); };
    if (e && Array.isArray(e.paeckchen)) for (const p of e.paeckchen) nimm(p && p.sorte, p);
    if (e && Array.isArray(e.klemmer)) for (const k of e.klemmer) if (k && Array.isArray(k.paeckchen)) for (const p of k.paeckchen) nimm(k.sorte, p);
    return liste;
  }
  const paeckchenSumme = (e) => gefundenePaeckchen(e).reduce((s, p) => s + p.anzahl, 0);
  /* „ABC10: 3 (Schacht 7); XYZ10: 1; Sorte unbekannt: 2“ – Bezeichnung: bekanntes Kürzel, sonst die normierte Eingabe, sonst „Sorte unbekannt“ */
  const paeckchenText = (liste) => liste.map((p) => (sorteKuerzel(p.sorte) || sorteNorm(p.sorte) || "Sorte unbekannt") + ": " + p.anzahl
    + (textOder(p.schacht).trim() ? " (Schacht " + textOder(p.schacht).trim() + ")" : "")).join("; ");

  /* ---- Automatenstörung und Mona-Problem trennen (Mirko 12.10.2026) ----
     „automatenstörung und mona störung voneinander trennen, dennoch den automaten notieren der bearbeitet wurde als das problem aufgetreten ist“.
     Automatenstörung = Störung mit einem Geräte-Punkt (auch ein alter Klemmer) ODER gefundenen Päckchen (> 0) – auch dann, wenn zugleich Mona angekreuzt ist.
     Mona-Problem = Störung mit einem Mona-Punkt. Eine Erfassung kann beides sein (dann steht sie in beiden Teilen des Berichts).
     Das ist NICHT dasselbe wie zaehlt(): Die Werkstatt-Regel (Hinweis, Zähler) kennt nur die Geräte-Punkte. */
  function automatenStoerung(e) {
    return !!e && e.ergebnis === "stoerung" && (hatGeraet(e) || paeckchenSumme(e) > 0);
  }
  const monaProblem = (e) => !!e && e.ergebnis === "stoerung" && hatMona(e);
  /* Zu welchem Problem gehört ein Foto? Neue Fotos tragen zu: "automat" | "mona" (Kamera „Störung festhalten“ bzw. „Mona-Problem festhalten“).
     ALTE Fotos ohne Zuordnung: „mona“ nur bei einem Mona-Besuch ohne Geräte-Punkt und Päckchen – sonst „automat“. */
  function fotoZu(foto, e) {
    if (foto && (foto.zu === "automat" || foto.zu === "mona")) return foto.zu;
    return e && hatMona(e) && !hatGeraet(e) && paeckchenSumme(e) === 0 ? "mona" : "automat";
  }

  /* ---- Videos als Nachweis (Mirko 12.10.2026) ----
     „bis 30 sek ist okey … mail whatsapp airdrop passt, nur muss dann auch die daten des automaten mit geschickt werden, genau so bei mona störung“.
     Ein Video gehört zu einer Erfassung und ist entweder ein Automaten-Video oder ein Mona-Video (zu), genau wie die Fotos – neue Videos tragen immer ein zu.
     Datensatz im Speicher „videos“: { id, erfassung (null im Entwurf), entwurf (nur im Entwurf), zu, video (Blob), typ, dauer (ganze Sekunden oder null),
     standbild (kleines JPEG oder null), erstellt }. Dateiname und Text zum Teilen entstehen hier – aus denselben Helfern wie PDF und Excel. */
  const VIDEO_MAX = 30, VIDEO_TOLERANZ = 1;   // Sekunden; über MAX + TOLERANZ wird ein Video abgewiesen
  const VIDEO_HINWEIS = "Das Video ist länger als 30 Sekunden – bitte kürzer aufnehmen.";
  const videoZu = (v) => (v && v.zu === "mona" ? "mona" : "automat");
  const VIDEO_TYPEN = { mov: "video/quicktime", mp4: "video/mp4", m4v: "video/mp4", webm: "video/webm" };
  /* Der Typ, den die Datei meldet; meldet sie keinen, entscheidet die Endung des Dateinamens, sonst mp4 */
  function videoTyp(typ, name) {
    const t = String(typ || "").trim().toLowerCase();
    if (t) return t;
    const m = /\.([a-z0-9]+)$/i.exec(String(name || ""));
    return (m && VIDEO_TYPEN[m[1].toLowerCase()]) || "video/mp4";
  }
  /* Endung nach Typ: das iPhone nimmt QuickTime (.mov) auf; webm gibt es nur im Chrome-Test */
  const videoEndung = (typ) => { const t = String(typ || "").toLowerCase(); return /quicktime/.test(t) ? "mov" : /webm/.test(t) ? "webm" : "mp4"; };
  /* Reihenfolge der Videos einer Erfassung (bestimmt die Nummer im Dateinamen und in „Video 2 ansehen“): nach Aufnahmezeit, dann Id */
  const videosGeordnet = (liste) => (liste || []).slice().sort((x, y) => (x.erstellt < y.erstellt ? -1 : x.erstellt > y.erstellt ? 1 : x.id < y.id ? -1 : x.id > y.id ? 1 : 0));
  /* <A-Nummer>_<TT-MM-JJJJ>_<Automat|Mona>_<n>.<Endung> – das Datum ist das der Erfassung; steht das Wichtigste auch im Namen, wenn ein Ziel den Text nicht annimmt */
  function videoDateiname(e, v, nr) {
    const t = tagVon(e.zeit);
    return e.a + "_" + t.slice(8, 10) + "-" + t.slice(5, 7) + "-" + t.slice(0, 4) + "_" + (videoZu(v) === "mona" ? "Mona" : "Automat") + "_" + nr + "." + videoEndung(v && v.typ);
  }
  /* Die Videos EINER Erfassung in einer Sorte (teil = "automat" | "mona"), in Aufnahmereihenfolge, mit Nummer und Dateiname: [{ v, nr, name }].
     Der EINZIGE Ort, an dem Nummer und Name entstehen - das Teilen eines Videos, „PDF mit Videos teilen“ und die Beschriftung im PDF holen sie alle hier,
     damit der Name im PDF immer der Name der Datei ist, die beim Empfänger ankommt (13.10.2026). videos = alle Videos dieser Erfassung.
     nr = Nummer des Videos in DIESER Störung („Video 2“ in der Beschriftung). Die Zahl im Dateinamen zählt dagegen je Automat, Tag und Sorte fortlaufend:
     vorher = so viele Videos derselben Sorte haben frühere Erfassungen desselben Automaten am selben Tag (frueherAmTag). Mirko 13.10.2026 („b“): zwei Störungen
     am selben Tag dürfen nicht beide …_Automat_1 heißen - sonst stünde im PDF zweimal derselbe Name, und beim Teilen könnte eine Datei die andere überschreiben. */
  const videosBenannt = (e, videos, teil, vorher) => videosGeordnet((videos || []).filter((x) => videoZu(x) === teil))
    .map((v, i) => ({ v, nr: i + 1, name: videoDateiname(e, v, (vorher || 0) + i + 1) }));
  /* Die anderen Erfassungen desselben Automaten am selben Tag, die VOR e liegen (Zeit, bei gleicher Zeit die Id) - deren Videos zählen im Dateinamen von e vor */
  const frueherAmTag = (erfassungen, e) => (erfassungen || []).filter((x) => x && x.id !== e.id && x.a === e.a && tagVon(x.zeit) === tagVon(e.zeit)
    && (x.zeit < e.zeit || (x.zeit === e.zeit && x.id < e.id)));
  /* Unter dem Standbild im PDF: „Video 2: A900108_17-09-2026_Automat_2.mov (12 s)“ (b = ein Eintrag aus videosBenannt); ohne bekannte Länge ohne Klammer */
  const videoBeschriftung = (b) => "Video " + b.nr + ": " + b.name + (b.v && b.v.dauer ? " (" + b.v.dauer + " s)" : "");
  /* „A123456 · Tour 1 · AZ23 · Azkoyen · außen“ – der Automat (g = geraetInfo) */
  const automatZeile = (g) => [g.a, g.tour ? "Tour " + g.tour : "", g.kuerzel, g.hersteller, g.ortText].filter(Boolean).join(" · ");
  /* Der Text, der mit dem Video geteilt wird: der Automat und die Störung, zu der das Video gehört. Jeder Punkt mit seiner Uhrzeit (Sekunden) – alte Einträge
     laufen über dieselben Helfer (geraetPunkte / monaPunkte), mit der Zeit der Erfassung. */
  function videoText(e, g, v) {
    const zeit = datumLang(e.zeit) + ", " + e.zeit.slice(11, 16);
    const mitZeit = (p) => { const einz = punktEinzelheiten(p), z = punktZeit(p, e); return punktText(p) + (einz.length ? ", " + einz.join(", ") : "") + (z ? " (" + z + ")" : ""); };
    const z = ["Störungsliste – Video"];
    if (videoZu(v) === "mona") {
      z.push("Mona-Problem vom " + zeit, "Automat in Bearbeitung: " + automatZeile(g));
      const m = monaPunkte(e); if (m.length) z.push("Mona-App-Störung: " + m.map(mitZeit).join("; "));
    } else {
      z.push(automatZeile(g), "Automatenstörung vom " + zeit + " – " + (e.behoben === true ? "behoben" + (e.behobenAm ? " am " + datumLang(e.behobenAm) : "") : "offen"));
      const p = geraetPunkte(e); if (p.length) z.push("Gerät: " + p.map(mitZeit).join("; "));
      const summe = paeckchenSumme(e); if (summe > 0) z.push("Gefundene Päckchen: " + paeckchenText(gefundenePaeckchen(e)) + " · zusammen " + summe);
    }
    return z.join("\n");
  }

  const FEHLER_GERAET = "Bei Gerätestörung bitte mindestens einen Punkt wählen oder in eigenen Worten beschreiben";
  const FEHLER_MONA = "Bei Mona-App-Störung bitte mindestens einen Punkt wählen oder in eigenen Worten beschreiben";
  const FEHLER_NUMMER = "Bitte die Schacht/Modul-Nummer wählen";
  function pruefeErfassung(e) {
    const f = [];
    if (!/^A\d{6}$/.test(e.a || "")) f.push("A-Nummer fehlt");
    if (e.ergebnis === "stoerung") {
      if (!e.geraet && !e.mona && !(e.klemmer && e.klemmer.length)) f.push("Bitte mindestens eine Art wählen");
      /* Nur das NEUE Format wird streng geprüft (eine alte Erfassung bleibt gültig, auch ein alter Klemmer ohne Nummer) */
      if (hatPunkte(e.geraet) && !hatGeraet(e)) f.push(FEHLER_GERAET);
      if (hatPunkte(e.mona) && !hatMona(e)) f.push(FEHLER_MONA);
      if (hatPunkte(e.geraet) && e.geraet.punkte.some((p) => p && geraetArt(p.art) && geraetArt(p.art).nr && !nummern(p.nr).length)) f.push(FEHLER_NUMMER);
      /* Päckchen allein sind keine Art. Eine Zeile mit Sorte oder Schacht braucht eine Anzahl >= 1 (völlig leere Zeilen zählen nicht).
         Eine Anzahl, die keine Zahl ist (NaN, z. B. „1,5“ oder „abc“ getippt), zählt als ausgefüllt und fällt hier durch. */
      const gefuellt = (p) => textOder(p.sorte).trim() || textOder(p.schacht).trim() || (p.anzahl != null && p.anzahl !== "" && Number(p.anzahl) !== 0);
      if (Array.isArray(e.paeckchen) && e.paeckchen.some((p) => p && gefuellt(p) && !(Number(p.anzahl) >= 1))) {
        f.push("Bei jeder gefundenen Sorte bitte die Anzahl eintragen");
      }
      if (e.behoben !== true && e.behoben !== false) f.push("Bitte „Behoben: Ja / Nein“ wählen");
    }
    return f;
  }

  /* ---- Kartei und Übersicht ---- */
  const ORT_TEXT = { innen: "innen", aussen: "außen" };
  function geraetInfo(stand, a) {
    const m = stand.automaten.find((x) => x.a === a) || { a, kuerzel: "", ort: "", tour: "", werkstattModell: null };
    const k = stand.kuerzel.find((x) => x.kuerzel === m.kuerzel);
    const w = m.werkstattModell ? stand.werkstattModelle.find((x) => x.id === m.werkstattModell) : null;
    return { a, tour: m.tour || "", kuerzel: m.kuerzel || "", hersteller: k ? k.hersteller : "", werkstattModell: w ? w.modell : "",
      ort: m.ort || "", ortText: ORT_TEXT[m.ort] || "" };
  }
  /* ---- Gedächtnis je Automat (13.10.2026) ----
     frueher = abgeschlossene Besuche (daten.js stand().frueher). Ins Gedächtnis gehören die AUTOMATENSTÖRUNGEN (Gerät, Klemmer, gefundene Päckchen) –
     Mona-Probleme bleiben getrennt und gehören nicht zum Automaten. Neueste zuerst. */
  const frueherVon = (frueher, a) => (frueher || []).filter((e) => e.a === a && automatenStoerung(e)).sort((x, y) => (x.zeit < y.zeit ? 1 : x.zeit > y.zeit ? -1 : 0));
  /* Eine Zeile je früherer Störung: „05.10.2026 · Tuben nicht füllbar; Sonstiges: Münzprüfer · gefundene Päckchen 2 – behoben am 06.10.2026“ */
  function frueherText(e) {
    const punkte = geraetPunkte(e).map(punktText), pk = paeckchenSumme(e);
    const status = e.behoben === true ? "behoben" + (e.behobenAm ? " am " + datumLang(e.behobenAm) : "") : "offen";
    return datumLang(e.zeit) + " · " + (punkte.length ? punkte.join("; ") : "gefundene Päckchen") + (pk > 0 && punkte.length ? " · gefundene Päckchen " + pk : pk > 0 ? " " + pk : "") + " – " + status;
  }
  /* Automaten, die NUR noch im Gedächtnis stehen (kein Besuch im laufenden Zeitraum): für die aufklappbare Liste unter der Kartei */
  function karteiFrueher(stand) {
    const laufend = new Set(stand.erfassungen.map((e) => e.a));
    return stand.automaten.filter((m) => !laufend.has(m.a)).map((m) => {
      const fr = frueherVon(stand.frueher, m.a), alle = (stand.frueher || []).filter((e) => e.a === m.a);
      return Object.assign(geraetInfo(stand, m.a), { frueherStoerungen: fr.length, letzte: alle.reduce((x, e) => (e.zeit > x ? e.zeit : x), "") });
    }).filter((z) => z.letzte).sort((x, y) => (x.letzte < y.letzte ? 1 : x.letzte > y.letzte ? -1 : 0));
  }
  /* Die Kartei des LAUFENDEN Zeitraums: nur Automaten mit mindestens einem Besuch darin (Mirko 13.10.2026: keine leeren Karten). */
  function kartei(stand) {
    const laufend = new Set(stand.erfassungen.map((e) => e.a));
    return stand.automaten.filter((m) => laufend.has(m.a)).map((m) => {
      const eig = stand.erfassungen.filter((e) => e.a === m.a);
      const w = letzteWerkstatt(stand.werkstatt, m.a);
      return Object.assign(geraetInfo(stand, m.a), {
        erfassungen: eig.length,
        stoerungen: eig.filter(zaehlt).length,
        klemmer: eig.reduce((s, e) => s + klemmerAnzahl(e), 0),
        paeckchen: eig.reduce((s, e) => s + paeckchenSumme(e), 0),
        mona: eig.filter(hatMona).length,
        werkstattBesuche: stand.werkstatt.filter((x) => x.a === m.a).length,
        letzteWerkstatt: w ? (w.datum || tagVon(w.erfasstUm)) : "",
        werkstattBestellt: eig.filter((e) => e.werkstattAntwort === "bestellt").length,
        letzte: eig.reduce((x, e) => (e.zeit > x ? e.zeit : x), ""),
      });
    }).sort((x, y) => (y.stoerungen - x.stoerungen) || (x.letzte < y.letzte ? 1 : x.letzte > y.letzte ? -1 : 0));
  }
  function uebersicht(erfassungen, umstellung) {
    const leer = () => ({ tage: new Set(), geoeffnet: 0, stoerungen: 0, klemmer: 0, mona: 0, probeKlemmer: 0, paeckchen: 0 });
    const p = { vorher: leer(), nachher: leer() };
    for (const e of erfassungen) {
      const x = p[phase(e.zeit, umstellung)];
      x.tage.add(tagVon(e.zeit)); x.geoeffnet++;
      if (zaehlt(e)) x.stoerungen++;
      x.klemmer += klemmerAnzahl(e);
      x.paeckchen += paeckchenSumme(e);
      if (hatMona(e)) x.mona++;
      if (e.probeverkauf && e.probeverkauf.ergebnis === "klemmer") x.probeKlemmer++;
    }
    const fertig = (x) => ({ tage: x.tage.size, geoeffnet: x.geoeffnet, stoerungen: x.stoerungen, klemmer: x.klemmer, mona: x.mona,
      klemmerJe100: x.geoeffnet ? Math.round(x.klemmer / x.geoeffnet * 1000) / 10 : 0, probeKlemmer: x.probeKlemmer, paeckchen: x.paeckchen });
    return { vorher: fertig(p.vorher), nachher: fertig(p.nachher) };
  }

  const R = { KUERZEL_START, WERKSTATT_START, ABSTREIFER, abstreiferText, lokalIso, tagVon, datumKurz, datumLang, tageZwischen, neueId,
    ziffernAus, aNummerGueltig, aNummer, sorteNorm, sorteNummer, sorteKuerzel, zaehlt, letzteWerkstatt, zaehlendeSeitWerkstatt,
    werkstattHinweis, vorwarnung, phase, offeneStoerung, pruefeErfassung, gefundenePaeckchen, paeckchenSumme, paeckchenText, automatenStoerung, monaProblem, fotoZu, geraetInfo, kartei, karteiFrueher, frueherVon, frueherText, uebersicht,
    GERAET_ARTEN, MONA_ARTEN, SONSTIGES_TEXT, NUMMERN_MAX, geraetPunkte, monaPunkte, hatGeraet, hatMona, klemmerAnzahl, punktText, punktName, punktNummer, punktEinzelheiten, punktZeit, sorteKlartext,
    teilBauen, teileNeu, inNeuesFormat, punktEntfernen, punktArten,
    VIDEO_MAX, VIDEO_TOLERANZ, VIDEO_HINWEIS, videoZu, videoTyp, videoEndung, videosGeordnet, videoDateiname, videosBenannt, frueherAmTag, videoBeschriftung, automatZeile, videoText };
  if (typeof module !== "undefined" && module.exports) module.exports = R; else wurzel.StoerRegeln = R;
})(typeof window !== "undefined" ? window : globalThis);
