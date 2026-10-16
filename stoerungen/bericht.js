/* =====================================================================
   stoerungen/bericht.js - Störungsliste: PDF zum Ausdrucken (12.10.2026)

   Zwei Blätter, beide auf dem Gerät erzeugt (jsPDF, nichts geht ins Netz):
   - chefBericht(stand, { von, bis }): Automatenstörungen und Mona-Probleme
     getrennt (Mirko 12.10.2026: „automatenstörung und mona störung voneinander
     trennen, dennoch den automaten notieren der bearbeitet wurde als das
     problem aufgetreten ist“, „mona fotos … an mona problem anheften nicht an
     automaten störungen“):
       Seite 1  Titel, Zeitraum, Summen, Tabelle „Automaten in diesem Bericht“
                (A-Nummer · Tour · Kürzel · Störungen · Päckchen · offen · Seite)
                und die Zeile „Mona-Probleme: ab Seite N“
       Teil 1   „Automatenstörungen“: jeder Automat mit mindestens einer
                Automatenstörung (Gerät, Klemmer oder gefundene Päckchen) auf
                eigener Seite - ohne Mona-Zeilen, nur mit Automaten-Fotos
       Teil 2   „Mona-Probleme“: nach Datum, neueste zuerst, mit „Automat in
                Bearbeitung: …“, dem Mona-Text und den Mona-Fotos
     Die Seitenzahlen in der Tabelle stehen schon fest, bevor der Inhalt gesetzt
     wird: Die Zeilen der Tabelle haben feste Höhe, also ist die Zahl der
     Tabellenseiten vorab bekannt; sie werden leer vorgehalten, der Inhalt
     folgt, und zuletzt wird die Tabelle mit den dann bekannten Seitenzahlen
     auf die vorgehaltenen Seiten geschrieben (jsPDF setPage).
   - automatBericht(stand, a): „PDF für diesen Automaten“ (13.10.2026, löst das
     Werkstatt-Blatt ab - Mirko: „egal ob offen oder geschlossen einzelne pdfs …
     um auch mal einzelne geräte auszuwerten“, „die werkstatt schicke ich
     ohnehin dann hin“): ein Automat, ALLE Automatenstörungen (offen und
     behoben, neueste zuerst), ohne Mona (Mona-Punkte, -Fotos und -Videos stehen
     nur im Chef-Bericht, Teil „Mona-Probleme“), nur mit Automaten-Fotos und
     Automaten-Videos.
   Videos (13.10.2026): Nach den Fotos eines Problems steht je Video ein
   Standbild (beim Aufnehmen gezogen) mit „Video n: <Dateiname> (12 s)“ -
   derselbe Dateiname wie beim Teilen des Videos (regeln.js videosBenannt),
   damit der Empfänger Datei und PDF zuordnen kann; gelingt kein Standbild,
   nur die Beschriftung. Wie bei den Fotos nach Automat/Mona getrennt:
   Automaten-Videos in Teil 1 und im Automaten-PDF, Mona-Videos nur in Teil 2.
   Bilder-Raster (13.10.2026): Fotos und Standbilder EINER Störung stehen
   zusammen auf einem Blatt - ein einzelnes groß, mehrere im Raster
   (rasterPlan), so groß wie es die Seite erlaubt.
   Gerechnet wird mit denselben Regeln wie Kartei und Excel (regeln.js,
   auswertung.js); dieses Skript legt nur das Papier aus.
   Schrift: Helvetica (Umlaute und € gehen), keine Geldbeträge.
   ===================================================================== */
(function () {
  "use strict";
  const R = window.StoerRegeln, A = window.StoerAuswertung, D = window.StoerDaten;

  /* A4 hoch, Ränder 15 mm; unter dem Inhalt bleibt Platz für die Fußzeile */
  const SEITE_B = 210, SEITE_H = 297, RAND = 15, BREITE = SEITE_B - 2 * RAND;
  const OBEN = RAND, UNTEN = SEITE_H - RAND - 6, FUSS_Y = SEITE_H - 9;
  const MM = 25.4 / 72;                              // 1 pt in mm
  const SCHWARZ = [0, 0, 0], GRAU = [85, 85, 85], HELL = [190, 190, 190];
  /* Fotos: ein einzelnes Foto über die volle Breite (180 mm), höchstens 150 mm hoch – Hochkant-Fotos sind dann schmaler und stehen mittig.
     Mirko 12.10.2026: Die Fotos sind „ausschlaggebend für die Entwicklung/Verbesserung“, man muss sie groß ansehen können.
     Mehrere Fotos einer Störung stehen seit 13.10.2026 zusammen auf einem Blatt (Raster, siehe rasterPlan). */
  const FOTO_H = 150;
  const LABEL_B = 42, LABEL_B_MONA = 50;             // Spalte der Beschriftungen („Gefundene Päckchen:“; im Mona-Teil „Automat in Bearbeitung:“)
  /* Umbruchbreiten mit 3 mm Luft: jsPDF schätzt die Breite mancher Zeichen (ñ, Š, …) etwas zu klein - ohne Luft ragte eine Zeile 2 mm über den Rand */
  const ZEILE_B = BREITE - 3;

  const zeilenhoehe = (pt) => pt * MM * 1.32;
  const neuesteZuerst = (x, y) => (x.zeit < y.zeit ? 1 : x.zeit > y.zeit ? -1 : 0);
  const datumZeit = (e) => R.datumLang(e.zeit) + " · " + e.zeit.slice(11, 16);

  /* ---- Auswahl: dieselbe Zeitraum-Regel wie die Excel-Auswertung ---- */
  /* liste: Automaten mit mindestens einer AUTOMATENSTÖRUNG (Gerät, Klemmer oder gefundene Päckchen) im Zeitraum, geordnet wie die Kartei – gezählt wird nur,
     was im Zeitraum liegt (automatenStoerungen = Anzahl, offen = davon noch nicht behoben). Ein Automat, der nur ein Mona-Problem hatte, steht hier nicht.
     mona: die Mona-Probleme im Zeitraum (jeder Automat), neueste zuerst. */
  function automaten(stand, zeitraum) {
    const von = (zeitraum && zeitraum.von) || null, bis = (zeitraum && zeitraum.bis) || null;
    const erf = stand.erfassungen.filter((e) => A.imZeitraum(e.zeit, von, bis));
    const mitStoerung = new Set(erf.filter(R.automatenStoerung).map((e) => e.a));
    const liste = R.kartei(Object.assign({}, stand, { erfassungen: erf })).filter((z) => mitStoerung.has(z.a)).map((z) => {
      const eigene = erf.filter((e) => e.a === z.a && R.automatenStoerung(e));
      return Object.assign({}, z, { automatenStoerungen: eigene.length, offen: eigene.filter((e) => e.behoben === false).length });
    });
    return { von, bis, erfassungen: erf, liste, mona: erf.filter(R.monaProblem).sort(neuesteZuerst) };
  }
  /* Alle Automatenstörungen eines Automaten (offen UND behoben; Gerät, Klemmer oder gefundene Päckchen – ein reines Mona-Problem nicht), neueste zuerst */
  const stoerungenVon = (stand, a) => stand.erfassungen.filter((e) => e.a === a && R.automatenStoerung(e)).sort(neuesteZuerst);

  /* ---- Texte ---- */
  /* Die Standard-Schrift (Helvetica, WinAnsi = Windows-1252) kennt kein Emoji, keinen Pfeil, kein ≥ – ohne Umschreiben käme Zeichenmüll
     aufs Papier („Ø=Þ! !’“). Häufige Zeichen werden lesbar umgeschrieben, alles andere Unlesbare wird ein „?“ (mehrere in Folge zu einem).
     Umlaute, ß, €, „ “ ‚ ‘ und Gedankenstrich bleiben. Gilt für jeden Text, den Mirko selbst getippt hat (Gerät, Mona, Tour, Schacht …). */
  const ERSATZ = { "\u2192": "->", "\u2190": "<-", "\u2194": "<->", "\u21D2": "=>", "\u2265": ">=", "\u2264": "<=", "\u2260": "!=", "\u2248": "~",
    "\u2713": "ok", "\u2714": "ok", "\u2717": "x", "\u2718": "x" };
  const lesbar = (text) => String(text == null ? "" : text).replace(/\r/g, "").replace(/\t/g, " ")
    .replace(/[\u2192\u2190\u2194\u21D2\u2265\u2264\u2260\u2248\u2713\u2714\u2717\u2718]/g, (c) => ERSATZ[c])
    .replace(/[^\n\u0020-\u007E\u00A0-\u00FF\u20AC\u201A\u0192\u201E\u2026\u2020\u2021\u02C6\u2030\u0160\u2039\u0152\u017D\u2018\u2019\u201C\u201D\u2022\u2013\u2014\u02DC\u2122\u0161\u203A\u0153\u017E\u0178]+/gu, "?");
  function kopfText(e) {
    return datumZeit(e) + " – " + (e.behoben === true ? "behoben" + (e.behobenAm ? " am " + R.datumLang(e.behobenAm) : "") : "offen");
  }
  /* Eine Zeile je Punkt: „14:05:32 · Päckchenklemmer Schacht 7, Sorte ABC10, Abstreifer: breit, 2 Zungen“ – die Uhrzeit mit Sekunden vorn (Mirko 12.10.2026:
     jeder Punkt mit genauem Zeitstempel). Die Beschriftung („Gerätestörung:“ / „Mona-App-Störung:“) steht nur vor der ersten Zeile.
     Alte Einträge (Text, Klemmer-Liste) kommen über regeln.js geraetPunkte / monaPunkte genauso: mit der Uhrzeit der Erfassung. */
  function punktZeilen(label, e, punkte) {
    return punkte.map((p, i) => {
      const einz = R.punktEinzelheiten(p), z = R.punktZeit(p, e);
      return { label: i === 0 ? label : "", text: (z ? z + " · " : "") + R.punktText(p) + (einz.length ? ", " + einz.join(", ") : "") };
    });
  }
  /* [{ label, text }] – was zur AUTOMATENSTÖRUNG gehört, in dieser Reihenfolge. Die Mona-Zeilen fehlen immer: Sie stehen im Teil „Mona-Probleme“ des Chef-Berichts
     (und gar nicht im PDF für einen Automaten). */
  function detailZeilen(e) {
    const z = punktZeilen("Gerätestörung:", e, R.geraetPunkte(e));
    const summe = R.paeckchenSumme(e);
    if (summe > 0) z.push({ label: "Gefundene Päckchen:", text: R.paeckchenText(R.gefundenePaeckchen(e)) + " · zusammen " + summe });
    if (e.probeverkauf) z.push({ label: "Probeverkauf:", text: e.probeverkauf.ergebnis === "ok" ? "ok" : "Klemmer" + (e.probeverkauf.schacht ? " Schacht " + e.probeverkauf.schacht : "") });
    if (e.werkstattAntwort) z.push({ label: "Werkstatt:", text: e.werkstattAntwort === "bestellt" ? "bestellt" : "noch nicht bestellt" });
    return z.map((x) => ({ label: x.label, text: lesbar(x.text) }));
  }
  const zeitraumText = (von, bis) => (!von && !bis ? "Beginn bis heute" : (von ? R.datumLang(von) : "Beginn") + " – " + (bis ? R.datumLang(bis) : "heute"));
  /* „A123456 · Tour 1 · HA20 · Harting · außen“ – der Automat, an dem gearbeitet wurde, als das Mona-Problem auftrat */
  const automatText = (stand, a) => lesbar(R.automatZeile(R.geraetInfo(stand, a)));
  const werkstattText = (z) => (z.letzteWerkstatt ? "Werkstatt zuletzt " + R.datumLang(z.letzteWerkstatt) : "noch kein Werkstattbesuch");

  /* ---- Blatt: ein Cursor (y) über das PDF ---- */
  function neuesBlatt() {
    const { jsPDF } = window.jspdf;
    return { doc: new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true }), y: OBEN, start: OBEN, folge: "" };
  }
  function schrift(p, pt, fett, farbe) {
    const f = farbe || SCHWARZ;
    p.doc.setFont("helvetica", fett ? "bold" : "normal"); p.doc.setFontSize(pt); p.doc.setTextColor(f[0], f[1], f[2]);
  }
  function linie(p, y, farbe, staerke) {
    p.doc.setDrawColor(farbe[0], farbe[1], farbe[2]); p.doc.setLineWidth(staerke); p.doc.line(RAND, y, RAND + BREITE, y);
  }
  /* Neue Seite; folge = kleine Zeile oben („A262583 · Fortsetzung“), damit eine angebrochene Seite nicht namenlos dasteht */
  function seiteNeu(p) {
    p.doc.addPage(); p.y = OBEN;
    if (p.folge) { schrift(p, 9, false, GRAU); p.doc.text(p.folge, RAND, p.y + 9 * MM * 0.85); p.y += 8; }
    p.start = p.y;
  }
  /* Genug Platz für die nächsten mm? Sonst neue Seite. Wahr, wenn umgebrochen wurde. */
  function platz(p, mm) {
    const noetig = Math.min(mm, UNTEN - OBEN - 12);
    if (p.y + noetig > UNTEN) { seiteNeu(p); return true; }
    return false;
  }
  function zeile(p, str, pt, fett, farbe, x) {
    const h = zeilenhoehe(pt);
    schrift(p, pt, fett, farbe);
    p.doc.text(str, x == null ? RAND : x, p.y + pt * MM * 0.85);
    p.y += h;
  }
  /* Beschriftung links (fett), Text rechts daneben; lange Texte laufen eingerückt weiter */
  function beschriftet(p, label, text, labelB) {
    const lb = labelB || LABEL_B, pt = 9.5, h = zeilenhoehe(pt);
    schrift(p, pt, false);
    const teile = p.doc.splitTextToSize(String(text), BREITE - lb - 3);
    for (let i = 0; i < teile.length; i++) {
      if (p.y + h > UNTEN) seiteNeu(p);
      if (i === 0) { schrift(p, pt, true); p.doc.text(label, RAND, p.y + pt * MM * 0.85); }
      schrift(p, pt, false); p.doc.text(teile[i], RAND + lb, p.y + pt * MM * 0.85);
      p.y += h;
    }
  }
  function hoeheBeschriftet(p, text, labelB) {
    schrift(p, 9.5, false);
    return p.doc.splitTextToSize(String(text), BREITE - (labelB || LABEL_B) - 3).length * zeilenhoehe(9.5);
  }

  /* Automaten-Kopf: A-Nummer groß, Tour · Kürzel · Hersteller · Werkstatt-Modell · innen/außen, dann eine Zahlenzeile */
  /* Angaben, getrennt durch „ · “: wird die Zeile zu lang, bricht sie an einem Trenner um – nie mitten in einer Angabe.
     Eine einzelne Angabe, die allein zu lang ist (z. B. eine sehr lange Tour-Bezeichnung), bricht wie normaler Text. */
  function angabenZeilen(p, teile, pt, farbe) {
    schrift(p, pt, false, farbe);
    const zeilen = [];
    let aktuell = "";
    for (const t of teile) {
      if (aktuell && p.doc.getTextWidth(aktuell + " · " + t) > ZEILE_B) { zeilen.push(aktuell); aktuell = t; }
      else aktuell = aktuell ? aktuell + " · " + t : t;
    }
    if (aktuell) zeilen.push(aktuell);
    for (const l of zeilen) for (const w of p.doc.splitTextToSize(l, ZEILE_B)) zeile(p, w, pt, false, farbe);
  }
  /* titel: was groß oben steht - Standard die A-Nummer; im PDF für einen Automaten „Automat A262583“ */
  function automatenKopf(p, z, zahlen, titel) {
    zeile(p, titel || z.a, 22, true);
    angabenZeilen(p, [z.tour ? "Tour " + z.tour : "", z.kuerzel, z.hersteller, z.werkstattModell, z.ortText].filter(Boolean).map(lesbar), 11, SCHWARZ);
    angabenZeilen(p, zahlen, 10, GRAU);
    p.y += 1.5; linie(p, p.y, SCHWARZ, 0.5); p.y += 4;
  }

  /* ---- Fotos: Blob -> Data-URL; die Maße liest jsPDF aus dem JPEG selbst (dann stimmen Bild und Rahmen immer überein) ----
     Verkleinert wird vor dem Einbetten: Die Fotos der Störungsliste sind bis 1600 px groß. Unverkleinert wurde ein Bericht mit
     300 Fotos 42 MB groß (Spitze im Speicher ~250 MB) – auf dem iPhone stürzt dann der Tab ab, und per Mail geht es auch nicht mehr.
     Längste Kante höchstens 1400 px (auf 180 mm Breite rund 200 dpi – am Bildschirm noch gut zu vergrößern), JPEG-Qualität 0,82,
     nie hochgerechnet; kleinere Fotos bleiben unverändert. */
  const FOTO_KANTE = 1400, FOTO_QUALITAET = 0.82;
  function alsDataUrl(blob) {
    return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(r.error); r.readAsDataURL(blob); });
  }
  function bildLaden(blob) {
    if (typeof createImageBitmap === "function") return createImageBitmap(blob);
    return new Promise((res, rej) => {
      const u = URL.createObjectURL(blob), i = new Image();
      i.onload = () => { URL.revokeObjectURL(u); res(i); };
      i.onerror = () => { URL.revokeObjectURL(u); rej(new Error("Foto nicht lesbar")); };
      i.src = u;
    });
  }
  /* -> { url, format }; bei jedem Fehler beim Verkleinern bleibt es beim Original (lieber ein großes Foto als gar keins) */
  async function fotoFuerPdf(blob) {
    let bild = null;
    try {
      bild = await bildLaden(blob);
      const b = bild.naturalWidth || bild.width, h = bild.naturalHeight || bild.height, lang = Math.max(b, h);
      if (lang > FOTO_KANTE) {
        const f = FOTO_KANTE / lang, c = document.createElement("canvas");
        c.width = Math.round(b * f); c.height = Math.round(h * f);
        const g = c.getContext("2d");
        g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height);
        g.imageSmoothingQuality = "high"; g.drawImage(bild, 0, 0, c.width, c.height);
        const url = c.toDataURL("image/jpeg", FOTO_QUALITAET);
        c.width = c.height = 0;   // Speicher der Fläche gleich freigeben (iOS hält sonst jede Fläche bis zum Aufräumen)
        if (url.startsWith("data:image/jpeg")) return { url, format: "JPEG" };
      }
    } catch (e) { console.error(e); }
    finally { if (bild && typeof bild.close === "function") bild.close(); }
    return { url: await alsDataUrl(blob), format: /png/i.test(blob.type) ? "PNG" : "JPEG" };
  }
  /* Nur die Fotos EINES Problems: teil = "automat" (Automatenstörung) oder "mona" (Mona-Problem); alte Fotos ohne Zuordnung nach regeln.js fotoZu */
  async function fotosLaden(p, e, teil) {
    const aus = [];
    for (const f of (await D.fotosZu(e.id)).filter((x) => R.fotoZu(x, e) === teil).sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0))) {
      try {
        const { url, format } = await fotoFuerPdf(f.bild);
        const m = p.doc.getImageProperties(url);
        aus.push({ url, format, r: m.height / m.width });   // r = Höhe/Breite; die Größe auf dem Blatt legt erst das Raster fest
      } catch (e) { console.error(e); aus.push(null); }
    }
    return aus;
  }

  /* ---- Videos (13.10.2026): Länge und Standbild über ein verstecktes <video> ----
     Mirko 12.10.2026: Im PDF ein Standbild mit dem Vermerk „Video vorhanden“; das Video selbst bleibt in der App. Beim Aufnehmen wird die Länge gelesen
     (über 30 s wird abgewiesen) und ein Standbild aus der ersten Sekunde (bei 0,1 s) gezogen und beim Video gespeichert. Alles mit Zeitgrenze: Lässt sich ein
     Video nicht lesen (anderer Codec, Gerät lädt nicht), ist die Länge null und es gibt kein Standbild – das Video wird trotzdem übernommen, im PDF steht dann nur
     die Beschriftung. Das <video> hängt unsichtbar im Dokument (iOS dekodiert abgehängte Elemente nicht zuverlässig) und wird danach wieder entfernt. */
  function videoOeffnen(blob) {
    const url = URL.createObjectURL(blob), v = document.createElement("video");
    v.muted = true; v.defaultMuted = true; v.playsInline = true; v.preload = "auto";
    v.setAttribute("playsinline", ""); v.setAttribute("muted", "");
    v.style.cssText = "position:fixed;left:0;top:0;width:2px;height:2px;opacity:0;pointer-events:none";
    document.body.appendChild(v);
    v.src = url;
    return { v, schliessen() { try { v.pause(); } catch (e) { /* egal */ } v.removeAttribute("src"); try { v.load(); } catch (e) { /* egal */ } v.remove(); URL.revokeObjectURL(url); } };
  }
  /* wahr, sobald eines der Ereignisse eintrifft; falsch bei einem Fehler des Videos oder nach ms Millisekunden */
  function abwarten(v, namen, ms) {
    return new Promise((res) => {
      let fertig = false, uhr = null;
      const ende = (ergebnis) => { if (fertig) return; fertig = true; clearTimeout(uhr); namen.forEach((n) => v.removeEventListener(n, ja)); v.removeEventListener("error", nein); res(ergebnis); };
      const ja = () => ende(true), nein = () => ende(false);
      namen.forEach((n) => v.addEventListener(n, ja)); v.addEventListener("error", nein);
      uhr = setTimeout(nein, ms);
    });
  }
  /* -> { dauer: Sekunden (Zahl) oder null, standbild: JPEG-Blob (längste Kante höchstens 1400 px, wie die Fotos im PDF) oder null } */
  async function videoLesen(blob) {
    const aus = { dauer: null, standbild: null }, { v, schliessen } = videoOeffnen(blob);
    try {
      if (v.readyState < 1 && !(await abwarten(v, ["loadedmetadata"], 6000))) return aus;
      if (v.duration === Infinity) {   // Aufnahmen aus MediaRecorder (WebM, im Test) tragen keine Länge: ans Ende zu springen zwingt den Browser, sie auszurechnen
        v.currentTime = 1e7;
        await abwarten(v, ["seeked"], 3000);
      }
      const d = v.duration;
      aus.dauer = isFinite(d) && d > 0 ? d : null;
      if (!(v.videoWidth > 0)) return aus;   // kein Bild lesbar (nur Ton oder unbekanntes Format)
      v.currentTime = Math.min(0.1, (aus.dauer || 0.2) / 2);
      if ((await abwarten(v, ["seeked"], 5000)) && v.readyState >= 2) {
        const f = Math.min(1, FOTO_KANTE / Math.max(v.videoWidth, v.videoHeight)), c = document.createElement("canvas");
        c.width = Math.max(1, Math.round(v.videoWidth * f)); c.height = Math.max(1, Math.round(v.videoHeight * f));
        const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); g.drawImage(v, 0, 0, c.width, c.height);
        aus.standbild = await new Promise((res) => c.toBlob((b) => res(b), "image/jpeg", FOTO_QUALITAET));
        c.width = c.height = 0;
      }
    } catch (e) { console.error(e); }
    finally { schliessen(); }
    return aus;
  }
  /* Die Videos EINES Problems (wie bei den Fotos: „automat“ oder „mona“), in der Reihenfolge der Aufnahme: Standbild (das beim Aufnehmen gespeicherte, sonst jetzt
     aus dem Video gezogen) in der Größe eines Fotos plus Beschriftung „Video n: <Dateiname> (12 s)“ (Nummer und Name aus regeln.js videosBenannt - dieselben wie
     beim Teilen). Gelingt kein Standbild, bleibt bild null – dann steht nur die Beschriftung da. alle = alle Erfassungen (für die Zählung im Dateinamen). */
  async function videosLaden(p, e, teil, alle) {
    const aus = [];
    for (const b of await videosBenannt(alle, e, teil)) {
      const v = b.v;
      let bild = null;
      try {
        const blob = v.standbild || (v.video ? (await videoLesen(v.video)).standbild : null);
        if (blob) {
          const { url, format } = await fotoFuerPdf(blob);
          const m = p.doc.getImageProperties(url);
          bild = { url, format, r: m.height / m.width };
        }
      } catch (err) { console.error(err); bild = null; }
      aus.push({ bild, text: lesbar(R.videoBeschriftung(b)) });
    }
    return aus;
  }
  /* Die Automaten-Videos eines Automaten in der Reihenfolge des PDFs für diesen Automaten (Störungen neueste zuerst, in jeder die Videos nach Aufnahme), mit Nummer und
     Dateiname wie in den Beschriftungen: [{ e, v, nr, name }]. Daraus entstehen die Dateien für „PDF mit Videos teilen“. */
  async function automatVideos(stand, a) {
    const aus = [];
    for (const e of stoerungenVon(stand, a)) for (const b of await videosBenannt(stand.erfassungen, e, "automat")) aus.push(Object.assign({ e }, b));
    return aus;
  }
  /* Nummer und Dateiname der Videos einer Erfassung (regeln.js videosBenannt) – mit der Zählung je Automat und Tag: die Videos derselben Sorte aus früheren
     Erfassungen desselben Automaten am selben Tag zählen vor (Mirko 13.10.2026, „b“). Für PDF-Beschriftung, „PDF mit Videos teilen“ UND das Teilen eines
     einzelnen Videos (oberflaeche.js) - so tragen alle drei denselben Namen. alle = alle Erfassungen (stand.erfassungen). */
  async function videosBenannt(alle, e, teil) {
    let vorher = 0;
    for (const x of R.frueherAmTag(alle, e)) vorher += (await D.videosZu(x.id)).filter((v) => R.videoZu(v) === teil).length;
    return R.videosBenannt(e, await D.videosZu(e.id), teil, vorher);
  }

  /* ---- Raster für die Bilder EINER Störung (13.10.2026) ----
     Mirko 13.10.2026: „wenn mehrere fotos hochgeladen werden, dann muss man logisch alle fotos auf einem blatt im idealfall sehen“.
     Kacheln = die Fotos, danach die Video-Standbilder (mit „Video n: <Dateiname> (12 s)“ darunter). Ein einzelnes Bild bleibt so groß wie bisher (180 x 150 mm
     höchstens). Bei mehreren wird die Spaltenzahl (1 bis 4) so gewählt, dass alle Kacheln in die verfügbare Höhe passen und das KLEINSTE Bild dabei so groß wie
     möglich ist – so stehen zwei Querfotos untereinander, zwei Hochkant-Fotos nebeneinander, drei oder vier im 2er-Raster. Kein Raster mit Bildern unter
     ZELLE_MIN_H Höhe; geht es so nicht auf eine Seite (sehr viele Fotos), läuft ein 3er-Raster zeilenweise über die Seiten (keine Reihe wird zerschnitten).
     Die Spalten sind so breit wie das breiteste Bild (sb ≤ zb) und das Raster steht mittig – Hochkant-Fotos rücken so zusammen, statt mit breiter Lücke in
     zu breiten Zellen zu stehen. Spalte j beginnt bei x0 + j * (sb + LUECKE); Beschriftungen brechen auf die Spaltenbreite um.
     -> { k, sb, x0, m: [{ b, h }], cap: [[Zeile…]], reihen: [{ von, bis, h }], gesamt, passt, score } */
  const LUECKE = 4, SPALTEN_MAX = 4, ZELLE_MIN_H = 40, BESCHRIFTUNG_PT = 8.5;
  function rasterBei(p, kacheln, k, zh) {
    const zb = (BREITE - (k - 1) * LUECKE) / k;
    const m = kacheln.map((x) => { if (!x.bild) return { b: 0, h: 0 }; const b = Math.min(zb, zh / x.bild.r); return { b, h: b * x.bild.r }; });
    const sb = kacheln.some((x) => x.bild) ? Math.max(...m.map((x) => x.b)) : zb;
    schrift(p, BESCHRIFTUNG_PT, false, GRAU);
    /* „Video 1:“ und „(10 s)“ bleiben beim Umbrechen beisammen (geschütztes Leerzeichen nur zum Teilen, gezeichnet wird ein normales) */
    const zusammen = (t) => t.replace(/^(\S+) (\d+):/, "$1 $2:").replace(/\((\d+) s\)$/, "($1 s)");
    const cap = kacheln.map((x) => (x.text ? p.doc.splitTextToSize(zusammen(x.text), sb - 1).map((z) => z.replace(/ /g, " ")) : []));
    const capH = cap.map((c, i) => (c.length ? c.length * zeilenhoehe(BESCHRIFTUNG_PT) + (kacheln[i].bild ? 1 : 0) : 0));
    const reihen = [];
    for (let i = 0; i < kacheln.length; i += k) {
      let h = 0; for (let j = i; j < Math.min(i + k, kacheln.length); j++) h = Math.max(h, m[j].h + capH[j]);
      reihen.push({ von: i, bis: Math.min(i + k, kacheln.length), h });
    }
    const gesamt = reihen.reduce((s, x) => s + x.h, 0) + (reihen.length - 1) * LUECKE;
    const x0 = RAND + (BREITE - (k * sb + (k - 1) * LUECKE)) / 2;
    return { k, sb, x0, m, cap, reihen, gesamt };
  }
  function rasterPlan(p, kacheln, verfuegbar) {
    let best = null;
    for (let k = 1; k <= Math.min(SPALTEN_MAX, kacheln.length); k++) {
      let zh = FOTO_H;
      if (rasterBei(p, kacheln, k, zh).gesamt > verfuegbar) {   // größte Zellhöhe, bei der alles passt
        let lo = 0, hi = FOTO_H;
        for (let n = 0; n < 40; n++) { const mitte = (lo + hi) / 2; if (rasterBei(p, kacheln, k, mitte).gesamt <= verfuegbar) lo = mitte; else hi = mitte; }
        zh = lo;
      }
      const plan = rasterBei(p, kacheln, k, zh);
      plan.passt = plan.gesamt <= verfuegbar + 0.01 && zh >= ZELLE_MIN_H;
      const flaechen = plan.m.filter((x, i) => kacheln[i].bild).map((x) => x.b * x.h);
      plan.score = flaechen.length ? Math.min(...flaechen) : 0;
      if (plan.passt && (!best || plan.score > best.score * 1.005)) best = plan;
    }
    if (best) return best;
    /* sehr viele Bilder: 3er-Raster in natürlicher Hochkant-Größe, läuft über die Seiten */
    const k = Math.min(3, kacheln.length), plan = rasterBei(p, kacheln, k, Math.min(FOTO_H, ((BREITE - (k - 1) * LUECKE) / k) * 4 / 3));
    plan.passt = false; plan.score = 0;
    return plan;
  }

  /* Ein Eintrag: Kopfzeile, Angaben, dann alle Fotos und Video-Standbilder im Raster (rasterPlan). Kopfzeile + Angaben + Bilder sollen zusammen auf EIN Blatt:
     Reicht der Platz auf der laufenden Seite nicht für fast dieselbe Bildgröße wie auf einer frischen Seite, beginnt der Eintrag auf der nächsten Seite
     (beim ersten Eintrag unter dem Automaten-Kopf genügt die halbe Bildfläche – sonst bliebe Seite 1 fast leer). Kein Bild wird zerschnitten.
     opt.teil "automat": die Automatenstörung (Kopf „TT.MM.JJJJ · HH:MM – offen/behoben“, Gerät/Klemmer/Päckchen …, Automaten-Fotos).
     opt.teil "mona": das Mona-Problem (Kopf „TT.MM.JJJJ · HH:MM“, „Automat in Bearbeitung: …“ = opt.automat, „Mona-App-Störung:“ mit einer Zeile je Mona-Punkt samt Uhrzeit, Mona-Fotos). */
  async function stoerung(p, e, opt) {
    const mona = opt.teil === "mona", lb = mona ? LABEL_B_MONA : LABEL_B;
    const zeilen = mona ? [{ label: "Automat in Bearbeitung:", text: opt.automat }].concat(punktZeilen("Mona-App-Störung:", e, R.monaPunkte(e)).map((x) => ({ label: x.label, text: lesbar(x.text) }))) : detailZeilen(e);
    const fotos = await fotosLaden(p, e, opt.teil), videos = await videosLaden(p, e, opt.teil, opt.alle), kopf = mona ? datumZeit(e) : kopfText(e);
    /* Kacheln: erst die Fotos (ein unlesbares Foto als Hinweistext), dann die Videos (Standbild + Beschriftung; ohne Standbild nur die Beschriftung) */
    const kacheln = fotos.map((f) => (f ? { bild: f, text: "" } : { bild: null, text: "(Foto nicht lesbar)" })).concat(videos.map((vd) => ({ bild: vd.bild, text: vd.text })));
    const trenner = opt.erster ? 0 : 4, nachKopf = 2;
    const kopfH = zeilenhoehe(10.5) + zeilen.reduce((s, z) => s + hoeheBeschriftet(p, z.text, lb), 0) + 3;
    let umbruch = false, plan = null;
    if (!kacheln.length) umbruch = platz(p, trenner + kopfH);
    else {
      const hier = rasterPlan(p, kacheln, UNTEN - p.y - trenner - kopfH - nachKopf);
      const frisch = rasterPlan(p, kacheln, UNTEN - OBEN - (p.folge ? 8 : 0) - kopfH - nachKopf);
      const anfang = p.y <= p.start + 0.5;
      let bleiben;
      if (anfang) bleiben = true;
      else if (frisch.passt) bleiben = hier.passt && hier.score >= (opt.erster ? 0.5 : 0.85) * frisch.score;
      else bleiben = UNTEN - p.y - trenner - kopfH - nachKopf >= frisch.reihen[0].h;   // passt auf keine Seite: Kopf und erste Reihe gehören zusammen
      if (bleiben) plan = anfang || frisch.passt ? hier : frisch;   // frisch.passt false = Raster läuft ohnehin über Seiten, dann in voller Größe
      else { seiteNeu(p); umbruch = true; plan = frisch; }
    }
    if (!opt.erster && !umbruch && p.y > p.start + 0.5) { linie(p, p.y + 1.5, HELL, 0.25); p.y += 4; }
    zeile(p, kopf, 10.5, true);
    p.y += 0.5;
    for (const z of zeilen) beschriftet(p, z.label, z.text, lb);
    p.y += 1.5;
    if (plan) {
      for (const reihe of plan.reihen) {
        if (p.y + reihe.h > UNTEN) {   // nur bei sehr vielen Bildern (oder sehr langem Text): Fortsetzung auf der nächsten Seite, ganze Reihe
          seiteNeu(p);
          zeile(p, datumZeit(e) + (mona ? " · Mona-Fotos (Fortsetzung)" : " · Fotos (Fortsetzung)"), 8.5, false, GRAU); p.y += 1;
        }
        for (let j = reihe.von; j < reihe.bis; j++) {
          const x = plan.x0 + (j - reihe.von) * (plan.sb + LUECKE), kc = kacheln[j], m = plan.m[j];
          /* mittig in der Spalte; jsPDF hält die Bilddaten jetzt selbst - unsere Kopie gleich loslassen */
          if (kc.bild) { p.doc.addImage(kc.bild.url, kc.bild.format, x + (plan.sb - m.b) / 2, p.y, m.b, m.h); kc.bild.url = null; }
          if (plan.cap[j].length) {
            schrift(p, BESCHRIFTUNG_PT, false, GRAU);
            const y0 = p.y + m.h + (kc.bild ? 1 : 0) + BESCHRIFTUNG_PT * MM * 0.85;
            plan.cap[j].forEach((t, i) => p.doc.text(t, x, y0 + i * zeilenhoehe(BESCHRIFTUNG_PT)));
          }
        }
        p.y += reihe.h + LUECKE;
      }
    }
    p.y += 2;
  }

  /* Gedächtnis (13.10.2026): die früheren Automatenstörungen des Automaten (abgeschlossene Zeiträume) als eigener, grauer TEXT-Block nach den laufenden –
     Mirko: frühere Störungen „getrennt aufgelistet“, „in pdf als text reicht fotos nur in app“. Eine Zeile je Störung (regeln.js frueherText); die Überschrift
     steht nie allein am Seitenende. */
  function frueherAbschnitt(p, stand, a) {
    const fr = R.frueherVon(stand.frueher, a); if (!fr.length) return;
    schrift(p, 9, false, GRAU);
    const teile = fr.map((e) => p.doc.splitTextToSize(lesbar(R.frueherText(e)), ZEILE_B - 3));
    platz(p, 9 + zeilenhoehe(10) + zeilenhoehe(9) * teile[0].length);
    p.y += 2; linie(p, p.y, HELL, 0.25); p.y += 3;
    zeile(p, "Früher (abgeschlossene Zeiträume) · " + fr.length + (fr.length === 1 ? " Störung" : " Störungen"), 10, true, GRAU);
    p.y += 1;
    for (const t of teile) {
      if (p.y + zeilenhoehe(9) * t.length > UNTEN) seiteNeu(p);
      for (const w of t) zeile(p, w, 9, false, GRAU, RAND + 3);
      p.y += 0.8;
    }
    p.y += 2;
  }

  /* Fußzeile auf jeder Seite – erst am Ende, wenn die Seitenzahl feststeht */
  function fusszeilen(p) {
    const n = p.doc.getNumberOfPages(), heute = R.datumLang(R.lokalIso(new Date()));
    for (let i = 1; i <= n; i++) {
      p.doc.setPage(i);
      linie(p, FUSS_Y - 4.5, HELL, 0.25);
      schrift(p, 8.5, false, GRAU);
      p.doc.text("Störungsliste · Seite " + i + " von " + n, RAND, FUSS_Y);
      p.doc.text("Erstellt am " + heute, RAND + BREITE, FUSS_Y, { align: "right" });
    }
  }
  const alsBlob = (p) => { fusszeilen(p); return p.doc.output("blob"); };

  /* ---- Chef-Bericht: Seite 1 mit der Tabelle „Automaten in diesem Bericht“ ---- */
  /* Feste Höhen: Die Zahl der Tabellenseiten steht damit fest, bevor irgendein Automat gesetzt ist. */
  const TAB_ZEILE = 6.2, TAB_TITEL = 9, TAB_FOLGE = 8, TAB_KOPF = 7;
  /* Spalten in mm ab dem linken Rand; Zahlen rechtsbündig an der angegebenen Stelle */
  const SP = { a: 0, tour: 31, kuerzel: 70, stoerungen: 125, paeckchen: 145, offen: 160, seite: 180 };
  const TOUR_B = SP.kuerzel - SP.tour - 3, KUERZEL_B = 35;
  /* Wie viele Zeilen auf welche Seite kommen: [{ von, bis, yZeilen }], die erste Seite beginnt bei yErste, jede weitere trägt oben eine kleine Fortsetzungs-Überschrift */
  function tabellenPlan(yErste, n, mitKopf) {
    const kopf = mitKopf ? TAB_KOPF : 0, seiten = [];
    for (let i = 0; i < n;) {
      const yZeilen = (seiten.length ? OBEN + TAB_FOLGE : yErste + TAB_TITEL) + kopf;
      const passen = Math.max(1, Math.floor((UNTEN - yZeilen) / TAB_ZEILE));
      seiten.push({ von: i, bis: Math.min(n, i + passen), yZeilen });
      i += passen;
    }
    return seiten;
  }
  function kuerzen(p, text, breite) {
    if (p.doc.getTextWidth(text) <= breite) return text;
    let s = text;
    while (s.length > 1 && p.doc.getTextWidth(s + "…") > breite) s = s.slice(0, -1);
    return s.replace(/\s+$/, "") + "…";
  }
  function textBei(p, str, pt, fett, farbe, x, yBasis, ausrichtung) {
    schrift(p, pt, fett, farbe);
    p.doc.text(str, RAND + x, yBasis, ausrichtung ? { align: ausrichtung } : undefined);
  }
  /* Schreibt die Tabelle auf die vorgehaltenen Seiten (1, 2, …). zeilen: [{ art: "automat", z, seite } | { art: "leer" } | { art: "mona", seite }] */
  function tabelleSchreiben(p, plan, zeilen, yErste, mitKopf) {
    plan.forEach((seite, k) => {
      p.doc.setPage(1 + k);
      let y = k === 0 ? yErste : OBEN;
      if (k === 0) textBei(p, "Automaten in diesem Bericht", 13, true, SCHWARZ, 0, y + 13 * MM * 0.85);
      else textBei(p, "Automaten in diesem Bericht (Fortsetzung)", 9, false, GRAU, 0, y + 9 * MM * 0.85);
      y += k === 0 ? TAB_TITEL : TAB_FOLGE;
      if (mitKopf) {
        const yb = y + TAB_KOPF * 0.62;
        textBei(p, "A-Nummer", 8.5, true, GRAU, SP.a, yb); textBei(p, "Tour", 8.5, true, GRAU, SP.tour, yb); textBei(p, "Kürzel", 8.5, true, GRAU, SP.kuerzel, yb);
        textBei(p, "Störungen", 8.5, true, GRAU, SP.stoerungen, yb, "right"); textBei(p, "Päckchen", 8.5, true, GRAU, SP.paeckchen, yb, "right");
        textBei(p, "offen", 8.5, true, GRAU, SP.offen, yb, "right"); textBei(p, "Seite", 8.5, true, GRAU, SP.seite, yb, "right");
        linie(p, y + TAB_KOPF - 0.6, SCHWARZ, 0.4);
        y += TAB_KOPF;
      }
      for (const r of zeilen.slice(seite.von, seite.bis)) {
        const yb = y + TAB_ZEILE * 0.68;
        if (r.art === "automat") {
          const z = r.z;
          textBei(p, z.a, 10, true, SCHWARZ, SP.a, yb);
          schrift(p, 10, false); textBei(p, kuerzen(p, lesbar(z.tour) || "–", TOUR_B), 10, false, SCHWARZ, SP.tour, yb);
          schrift(p, 10, false); textBei(p, kuerzen(p, lesbar(z.kuerzel) || "–", KUERZEL_B), 10, false, SCHWARZ, SP.kuerzel, yb);
          textBei(p, String(z.automatenStoerungen), 10, false, SCHWARZ, SP.stoerungen, yb, "right"); textBei(p, String(z.paeckchen), 10, false, SCHWARZ, SP.paeckchen, yb, "right");
          textBei(p, String(z.offen), 10, false, SCHWARZ, SP.offen, yb, "right"); textBei(p, String(r.seite), 10, true, SCHWARZ, SP.seite, yb, "right");
          linie(p, y + TAB_ZEILE - 0.4, HELL, 0.2);
        } else if (r.art === "leer") textBei(p, "Keine Automatenstörung im Zeitraum.", 10.5, false, SCHWARZ, 0, yb);
        else textBei(p, "Mona-Probleme: ab Seite " + r.seite, 10.5, true, SCHWARZ, 0, yb);
        y += TAB_ZEILE;
      }
    });
  }

  /* ---- Chef-Bericht ---- */
  async function chefBericht(stand, zeitraum) {
    const m = automaten(stand, zeitraum), p = neuesBlatt();
    const summe = (feld) => m.liste.reduce((s, z) => s + z[feld], 0);
    const nichts = !m.liste.length && !m.mona.length;

    zeile(p, "Störungsliste – Bericht", 22, true); p.y += 3;
    const kv = (k, v, fett, x) => { const h = zeilenhoehe(11); schrift(p, 11, false, GRAU); p.doc.text(k, RAND, p.y + 11 * MM * 0.85); schrift(p, 11, !!fett, SCHWARZ); p.doc.text(String(v), RAND + (x || 62), p.y + 11 * MM * 0.85); p.y += h + 0.8; };
    kv("Zeitraum", zeitraumText(m.von, m.bis));
    if (stand.umstellung) kv("Umstellung ab", R.datumLang(stand.umstellung));
    p.y += 6;
    zeile(p, "Im Zeitraum", 13, true); p.y += 1.5;
    if (nichts) zeile(p, "Keine Störung im Zeitraum.", 11, false);
    else {
      kv("Automaten mit Automatenstörungen", m.liste.length, true, 80);
      kv("Automatenstörungen", summe("automatenStoerungen"), true, 80);
      kv("Klemmer", summe("klemmer"), true, 80);
      kv("Gefundene Päckchen", summe("paeckchen"), true, 80);
      kv("Mona-Probleme", m.mona.length, true, 80);
    }

    /* Tabelle planen: Zeilen und ihre Seiten stehen noch nicht fest (Seitenzahlen kommen erst nach dem Inhalt) – aber wie viele Seiten die Tabelle selbst braucht, schon.
       Diese Seiten werden jetzt leer angelegt; der Inhalt der Automaten beginnt danach. */
    const zeilen = m.liste.map((z) => ({ art: "automat", z, seite: 0 }));
    if (!zeilen.length && !nichts) zeilen.push({ art: "leer" });
    if (m.mona.length) zeilen.push({ art: "mona", seite: 0 });
    const mitKopf = m.liste.length > 0, yTabelle = p.y + 6;
    const plan = nichts ? [] : tabellenPlan(yTabelle, zeilen.length, mitKopf);
    for (let k = 1; k < plan.length; k++) p.doc.addPage();

    /* Teil 1: Automatenstörungen – je Automat eine neue Seite, ohne Mona */
    for (const z of m.liste) {
      p.folge = ""; seiteNeu(p);
      zeilen.find((r) => r.z === z).seite = p.doc.getNumberOfPages();
      zeile(p, "Automatenstörungen", 11, false, GRAU); p.y += 0.5;
      automatenKopf(p, z, ["Besuche im Zeitraum " + z.erfassungen, "Störungen " + z.automatenStoerungen, "Klemmer " + z.klemmer, "gefundene Päckchen " + z.paeckchen, werkstattText(z)]);
      p.folge = z.a + " · Fortsetzung";
      const eigene = m.erfassungen.filter((e) => e.a === z.a && R.automatenStoerung(e)).sort(neuesteZuerst);
      for (let i = 0; i < eigene.length; i++) await stoerung(p, eigene[i], { teil: "automat", erster: i === 0, alle: stand.erfassungen });
      frueherAbschnitt(p, stand, z.a);
    }
    /* Teil 2: Mona-Probleme – nach Datum, neueste zuerst, mit dem Automaten, an dem gearbeitet wurde */
    if (m.mona.length) {
      p.folge = ""; seiteNeu(p);
      zeilen[zeilen.length - 1].seite = p.doc.getNumberOfPages();
      zeile(p, "Mona-Probleme", 22, true);
      zeile(p, m.mona.length + (m.mona.length === 1 ? " Mona-Problem" : " Mona-Probleme") + " im Zeitraum · neueste zuerst", 10, false, GRAU); p.y += 3;
      p.start = p.y;
      p.folge = "Mona-Probleme · Fortsetzung";
      for (let i = 0; i < m.mona.length; i++) await stoerung(p, m.mona[i], { teil: "mona", erster: i === 0, automat: automatText(stand, m.mona[i].a), alle: stand.erfassungen });
    }
    if (plan.length) tabelleSchreiben(p, plan, zeilen, yTabelle, mitKopf);
    return alsBlob(p);
  }

  /* ---- PDF für diesen Automaten: alle Automatenstörungen (offen und behoben), ohne Mona ---- */
  /* Zahlenzeile: Besuche, Störungen, offen, Klemmer, gefundene Päckchen, Werkstatt zuletzt - über alle Besuche des Automaten im laufenden Zeitraum (wie die
     Kartei), dazu „früher n“ aus dem Gedächtnis. Danach die laufenden Störungen, am Ende der Text-Block „Früher“ (13.10.2026).
     Weder laufende noch frühere Automatenstörung -> null. */
  async function automatBericht(stand, a) {
    const liste = stoerungenVon(stand, a), nf = R.frueherVon(stand.frueher, a).length;
    if (!liste.length && !nf) return null;
    const p = neuesBlatt(), g = R.geraetInfo(stand, a), eig = stand.erfassungen.filter((e) => e.a === a);
    const w = R.letzteWerkstatt(stand.werkstatt, a);
    const z = Object.assign({}, g, { letzteWerkstatt: w ? (w.datum || R.tagVon(w.erfasstUm)) : "" });
    zeile(p, "Automatenstörungen", 11, false, GRAU); p.y += 0.5;
    automatenKopf(p, z, ["Besuche " + eig.length, "Störungen " + liste.length, "offen " + liste.filter((e) => e.behoben === false).length,
      "Klemmer " + eig.reduce((s, e) => s + R.klemmerAnzahl(e), 0), "gefundene Päckchen " + eig.reduce((s, e) => s + R.paeckchenSumme(e), 0)]
      .concat(nf ? ["früher " + nf + (nf === 1 ? " Störung" : " Störungen")] : []).concat([werkstattText(z)]), "Automat " + a);
    p.folge = a + " · Fortsetzung";
    if (!liste.length) zeile(p, "Im laufenden Zeitraum keine Automatenstörung.", 10, false, GRAU);
    for (let i = 0; i < liste.length; i++) await stoerung(p, liste[i], { teil: "automat", erster: i === 0, alle: stand.erfassungen });
    frueherAbschnitt(p, stand, a);
    return alsBlob(p);
  }

  const dateiname = (art, tag, a) => (art === "automat" ? "Automat-" + a + "-" + tag + ".pdf" : "Stoerungsliste-Bericht-" + tag + ".pdf");

  window.StoerBericht = { chefBericht, automatBericht, dateiname, automaten, stoerungenVon, automatVideos, videosBenannt, videoLesen };
})();
