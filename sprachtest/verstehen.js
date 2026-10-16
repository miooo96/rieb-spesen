/* =====================================================================
   sprachtest/verstehen.js - aus frei gesprochenem Text eine Störungsmeldung
   machen (13.10.2026). Reine Logik, Browser (window.Verstehen) und Node.

   Mirko 13.10.2026: "automat modell, welche störung aufgetreten ist
   gegebenenfalls an welchem schacht, oder obs tuben füllen nicht geht oder
   sonst was also letztenendes soll man alles reinsprechen können und aus den
   infos soll eine fertige störungsmeldung dann werden quasi mit fotos ect."
   Und: "man soll frei reinsprechen können, die spracherkennung soll
   stichwörter erkennen die wir im geschäft benutzen um begriffe richtig
   zuordnen zu können."

   Die Stichwörter sind 1:1 aus stoerungen/regeln.js und oberflaeche.js
   abgeschrieben (GERAET_ARTEN, MONA_ARTEN, ABSTREIFER, KUERZEL_START,
   NUMMERN_MAX, "Alles in Ordnung") - die Testseite läuft bewusst ohne die
   App. Beim Einbau in die Störungsliste kommen sie aus regeln.js.

   HÖRFEHLER: gemessen am 13.10.2026 (Computerstimme, Vosk ohne Wortliste).
   GELERNT: was Mirko auf der Testseite selbst zuordnet (Gerät, localStorage) -
   die Nachschlagetabelle, die durch Benutzung wächst (CLAUDE.md).

   ⛔ Die Erkennung SCHLÄGT VOR, sie trägt nichts ein (CLAUDE.md: eine
   Automatik ersetzt die Eingabe nie stillschweigend). Was unsicher ist,
   steht in "hinweise".
   ===================================================================== */
(function (wurzel) {
  "use strict";

  const GERAET_ARTEN = {
    klemmer: "Päckchenklemmer", modul: "Modul defekt", tuben: "Tuben nicht füllbar",
    motor: "Motor nicht in Grundstellung", auslesen: "Automat nicht auslesbar",
    schliesst: "Automat schließt schlecht", oeffnet: "Automat öffnet schlecht",
  };
  const NR_ARTEN = { klemmer: "eine", modul: "mehrere", motor: "mehrere" };
  const MONA_ARTEN = {
    vor_auslesen: "Verbindung vor dem Auslesen verloren",
    preisschreibung: "Während der zweiten Preisschreibung Verbindung verloren",
    gegenlesen: "Verbindung zwischen App und Auslesegerät vor dem Gegenlesen der Tuben unterbrochen, App-Neustart erforderlich",
    zwangsinventur: "Nach Zwangsinventur und Umbauten Preisschreibung ohne Funktion, Verbindung zum Auslesegerät verloren",
    absturz: "Mona-App abgestürzt",
  };
  const ABSTREIFER = { kein: "kein Abstreifer", schmal1: "schmal, 1 Zunge", schmal2: "schmal, 2 Zungen", breit1: "breit, 1 Zunge", breit2: "breit, 2 Zungen", terea: "Terea-Abstreifer (Plastik)", blech: "Einsetzblech (Terea)" };
  const KUERZEL = ["SI20", "SI24", "GR25", "GR26", "HA15", "HA20", "HA24", "AZ23", "AZ26", "Touch", "Touch XL"];
  const NUMMERN_MAX = 30;

  /* Die Stichwörter zum Auswählen in der Lernliste (alle aus der Störungsliste) */
  const STICHWOERTER = ["automat", "schacht", "modul", "motor", "klemmer", "päckchen", "gefunden", "tuben", "füllbar", "grundstellung",
    "auslesbar", "schließt", "öffnet", "defekt", "sorte", "abstreifer", "zunge", "zungen", "schmal", "breit", "terea", "einsetzblech",
    "mona", "app", "verbindung", "verloren", "auslesen", "preise", "gegenlesen", "neustart", "zwangsinventur", "abgestürzt",
    "ordnung", "sonstiges"];

  /* Hörfehler -> Stichwort, gemessen 13.10.2026. "monat" nur mit Mona-Zusammenhang (siehe woerter) */
  const HOERFEHLER = { schach: "schacht", "fühlbar": "füllbar", fuellbar: "füllbar", "päckchenklemmer": "klemmer", paeckchenklemmer: "klemmer",
    /* Apple-Tastaturdiktat mit Mirkos Stimme, 14.10.2026: "gallas statt gauloise" */
    gallas: "gauloises" };

  /* ---- Zahlwörter -> Ziffern ---- */
  const EINER = { null: 0, eins: 1, ein: 1, eine: 1, einen: 1, zwei: 2, zwo: 2, drei: 3, vier: 4, "fünf": 5, sechs: 6, sieben: 7, acht: 8, neun: 9 };
  const ZEHN_BIS_19 = { zehn: 10, elf: 11, "zwölf": 12, dreizehn: 13, vierzehn: 14, "fünfzehn": 15, sechzehn: 16, siebzehn: 17, achtzehn: 18, neunzehn: 19 };
  const ZEHNER = { zwanzig: 20, "dreißig": 30, dreissig: 30, vierzig: 40, "fünfzig": 50, sechzig: 60, siebzig: 70, achtzig: 80, neunzig: 90 };
  function unterHundert(w) {
    if (w in EINER) return EINER[w];
    if (w in ZEHN_BIS_19) return ZEHN_BIS_19[w];
    if (w in ZEHNER) return ZEHNER[w];
    const m = w.match(/^(ein|zwei|drei|vier|fünf|sechs|sieben|acht|neun)und(zwanzig|dreißig|dreissig|vierzig|fünfzig|sechzig|siebzig|achtzig|neunzig)$/);
    return m ? EINER[m[1]] + ZEHNER[m[2]] : null;
  }
  /* Ein Wort als Zahl ("dreiundzwanzig" -> "23", "zweihundertfünf" -> "205", "47" -> "47"), sonst null */
  function zahlWort(w) {
    if (/^\d+$/.test(w)) return w;
    let rest = w, wert = 0, gefunden = false;
    for (const [wort, faktor] of [["tausend", 1000], ["hundert", 100]]) {
      const i = rest.indexOf(wort);
      if (i < 0) continue;
      const vor = rest.slice(0, i), v = vor === "" ? 1 : unterHundert(vor);
      if (v == null) return null;
      wert += v * faktor; rest = rest.slice(i + wort.length); gefunden = true;
    }
    if (rest) { const v = unterHundert(rest); if (v == null) return null; wert += v; gefunden = true; }
    return gefunden ? String(wert) : null;
  }

  /* ---- Sorten nach dem Klang vergleichen (Mirko 13.10.2026: "das wäre ne idee mit dem vergleichen") ----
     Markennamen kennt die Erkennung nicht und hört sie jedes Mal anders ("download dieses", "gau luises
     droht", "gau dieses rot" für "Gauloises Rot"). Deshalb: Kölner Phonetik (übliches Verfahren für
     deutschen Klang, läuft lokal) des Gehörten gegen den Namen der Sorte und gegen alles, was für diese
     Sorte schon bestätigt wurde. Der gesprochene Preis grenzt vorher ein (Packungspreis = Preis / P/St,
     Sortentabelle). Ergebnis ist ein VORSCHLAG - Mirko bestätigt. */
  function koelner(wort) {
    const s = String(wort || "").toLowerCase().replace(/ä/g, "a").replace(/ö/g, "o").replace(/ü/g, "u").replace(/ß/g, "s").replace(/[^a-z]/g, "");
    let code = "";
    for (let i = 0; i < s.length; i++) {
      const c = s[i], v = i > 0 ? s[i - 1] : "", n = i + 1 < s.length ? s[i + 1] : "";
      const vorN = (zeichen) => n !== "" && zeichen.includes(n);
      let k = "";
      if ("aeijouy".includes(c)) k = "0";
      else if (c === "h") k = "";
      else if (c === "b") k = "1";
      else if (c === "p") k = n === "h" ? "3" : "1";
      else if (c === "d" || c === "t") k = vorN("csz") ? "8" : "2";
      else if ("fvw".includes(c)) k = "3";
      else if ("gkq".includes(c)) k = "4";
      else if (c === "c") k = i === 0 ? (vorN("ahkloqrux") ? "4" : "8") : (vorN("ahkoqux") && !(v !== "" && "sz".includes(v)) ? "4" : "8");
      else if (c === "x") k = v !== "" && "ckq".includes(v) ? "8" : "48";
      else if (c === "l") k = "5";
      else if (c === "m" || c === "n") k = "6";
      else if (c === "r") k = "7";
      else if (c === "s" || c === "z") k = "8";
      code += k;
    }
    let ohneDoppel = "";
    for (const ch of code) if (ch !== ohneDoppel[ohneDoppel.length - 1]) ohneDoppel += ch;
    return ohneDoppel ? ohneDoppel[0] + ohneDoppel.slice(1).replace(/0/g, "") : "";
  }
  function levenshtein(a, b) {
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[a.length][b.length];
  }
  /* 0 = klingt gleich, 1 = nichts gemeinsam */
  function klangAbstand(a, b) {
    const ka = koelner(a), kb = koelner(b);
    if (!ka || !kb) return 1;
    return levenshtein(ka, kb) / Math.max(ka.length, kb.length);
  }
  const packungspreis = (s) => Math.round((s.preis / (s.ps || 1)) * 100) / 100;
  const SICHER_BIS = 0.25, ABSTAND_ZUM_ZWEITEN = 0.1;
  /* wissen = { liste: Sortentabelle (RiebSorten.liste()), namen: { nr: "Name" }, varianten: { "gehört": nr } } */
  function sorteFinden(gehoert, preis, wissen) {
    const w = wissen || {}, liste = w.liste || [], namen = w.namen || {}, varianten = w.varianten || {};
    const text = String(gehoert || "").trim();
    let kandidaten = liste.filter((s) => preis == null || Math.abs(packungspreis(s) - preis) < 0.005)
      /* Mehrere Namen je Sorte mit "|" ("jps rot|john player special rot") - verglichen wird mit
         allen, angezeigt der erste (Mirko 14.10.2026 schreibt JPS als "john player special") */
      .map((s) => { const alle = String(namen[s.nr] || "").split("|").map((x) => x.trim()).filter(Boolean);
        return { nr: s.nr, kuerzel: s.kuerzel, preis: packungspreis(s), name: alle[0] || "", namen: alle, abstand: null }; });
    /* nach dem Klang: gegen Namen und gegen bestätigte Varianten derselben Sorte */
    if (text) {
      for (const k of kandidaten) {
        const vergleiche = k.namen.concat(Object.keys(varianten).filter((v) => varianten[v] === k.nr)).filter(Boolean);
        if (vergleiche.length) k.abstand = Math.min(...vergleiche.map((v) => klangAbstand(text, v)));
      }
    }
    const bewertet = kandidaten.filter((k) => k.abstand != null).sort((a, b) => a.abstand - b.abstand);
    const rest = kandidaten.filter((k) => k.abstand == null);
    kandidaten = bewertet.concat(rest);
    /* genau so schon einmal bestätigt: vorn - die übrigen nach dem Klang dahinter, damit ohne Preis
       die anderen Packungen desselben Namens gleich daneben stehen (14.10.2026: vorher Listenreihenfolge) */
    if (text && varianten[text]) {
      const k = kandidaten.find((x) => x.nr === varianten[text]);
      if (k) { k.abstand = 0; return { kandidaten: [k].concat(kandidaten.filter((x) => x !== k)), vorschlag: k, sicher: true, nameSicher: true, ueber: "gelernt" }; }
    }
    const erster = bewertet[0], zweiter = bewertet[1];
    /* Vorschlag, wenn der Klang nah ist UND der Zweite klar dahinter liegt - oder wenn der Klang
       etwas weiter weg ist, der Zweite aber DEUTLICH schlechter (14.10.2026 gemessen: "ich kenne
       filter" -> Camel Filter 0,29, der Nächste 0,57). Nie ein Vorschlag bei Gleichstand. */
    const luecke = erster && zweiter ? zweiter.abstand - erster.abstand : 1;
    const sicher = !!erster && ((erster.abstand <= SICHER_BIS && luecke >= ABSTAND_ZUM_ZWEITEN) || (erster.abstand <= 0.35 && luecke >= 0.25));
    /* Name eindeutig, Packung nicht: ohne Preis gibt es "gauloises rot" dreimal (12, 10, 15 €) - dann
       ist es sicher EINE Sorte dieses Namens, welche, entscheidet Mirko in der Auswahl (14.10.2026:
       vorher fiel "Gauloises Rot im Schacht 12" ohne Preis stillschweigend weg) */
    const andererName = erster ? bewertet.find((k) => k.name !== erster.name) : null;
    const lueckeName = andererName ? andererName.abstand - erster.abstand : 1;
    const nameSicher = !!erster && ((erster.abstand <= SICHER_BIS && lueckeName >= ABSTAND_ZUM_ZWEITEN) || (erster.abstand <= 0.35 && lueckeName >= 0.25));
    return { kandidaten, vorschlag: sicher ? erster : null, sicher, nameSicher, ueber: bewertet.length ? "klang" : "preis" };
  }

  /* ---- Text -> Wörter (mit Hörfehlern und Gelerntem) ---- */
  const NACH_ZAHL = /^(päckchen|stück|stange|stangen|zunge|zungen)$/;
  function woerter(text, gelernt) {
    const lern = gelernt || {};
    const roh = String(text || "").toLowerCase()
      .replace(/(\d)[.,](?=\d{3}\b)/g, "$1")        // 123.456 -> 123456
      /* Tastatur-Diktat schreibt Preise mit Zeichen: "12,50 €" -> "12 euro 50", "10 €" -> "10 euro"
         (14.10.2026: vorher fiel das €-Zeichen weg und die Sorte wurde nicht erkannt) */
      .replace(/(\d+),(\d{2})\s*(€|euro\b)/g, "$1 euro $2")
      .replace(/€/g, " euro ")
      /* Satzzeichen (Tastatur-Diktat) bleiben als Grenze "|" stehen - teilsaetze entscheidet, ob dort getrennt wird */
      .replace(/[.,;:!?]+(?=\s|$)/g, " | ")
      .replace(/[^a-z0-9äöüß|]+/g, " ").trim().split(/\s+/).filter(Boolean);
    const aus = [];
    for (let i = 0; i < roh.length; i++) {
      const w0 = roh[i];
      if (w0 === "|") { if (aus.length && aus[aus.length - 1] !== "|") aus.push("|"); continue; }
      const a = w0.match(/^a(\d{3,})$/);             // Tastatur-Diktat: "A471102"
      if (a) { aus.push("automat", a[1]); continue; }
      /* "A-Nummer 123456" / "A 123456" (Mirkos Wort "A-Nummer") */
      if (w0 === "a" && /^(nummer|nr|\d+)$/.test(roh[i + 1] || "")) { aus.push("automat"); continue; }
      const w = lern[w0] != null ? lern[w0] : (HOERFEHLER[w0] || w0);
      if (w === "") continue;                         // gelernt: "ignorieren"
      aus.push(...w.split(/\s+/));
    }
    /* "Monat" nur, wenn es um die App geht (gemessen: "monat abstürzt beim auslesen") */
    const monaZusammenhang = aus.some((w) => /^(app|abgestürzt|abstürzt|stürzt|absturz|verbindung|auslesen|preise|gegenlesen)$/.test(w));
    const fertig = aus.map((w) => (w === "monat" && monaZusammenhang ? "mona" : w));
    /* "ein/eine/einen" sind nur vor Päckchen/Stück/Zunge eine Zahl, sonst Artikel */
    return fertig.map((w, i) => ({ w, zahl: (["ein", "eine", "einen"].includes(w) && !NACH_ZAHL.test(fertig[i + 1] || "")) ? null : zahlWort(w) }));
  }

  /* Teilsätze: an "und"/"außerdem"/"dann"/"sowie" trennen - aber nicht zwischen zwei Zahlen ("Modul drei und sieben").
     Satzzeichen "|" (Tastatur-Diktat, 14.10.2026): nur trennen, wenn VORHER und NACHHER eine eigene Störung steht -
     "Modul 3 und 7 defekt, Mona-App abgestürzt" sind zwei (vorher fiel das Modul weg), "Klemmer Schacht 7, 2 Päckchen
     gefunden" bleibt einer (die Päckchen gehören zu Schacht 7), "Schacht 12, Klemmer" auch. */
  const THEMA = /klemm|^tuben?$|^füllbar$|^motor$|grundstellung|^module?$|^(auslesen|auslesbar|ausgelesen|schließt|schliesst|öffnet|oeffnet)$|^sonstig|^(mona|app|verbindung|abgestürzt|abstürzt|stürzt|absturz|gegenlesen|neustart|preise?|preisschreibung|zwangsinventur|ordnung)$/;
  function teilsaetze(t) {
    const saetze = [[]];
    t.forEach((x, i) => {
      if (x.w === "|") {
        const jetzt = saetze[saetze.length - 1], danach = [];
        for (let j = i + 1; j < t.length && t[j].w !== "|"; j++) danach.push(t[j]);
        if (jetzt.some((y) => THEMA.test(y.w)) && danach.some((y) => THEMA.test(y.w))) saetze.push([]);
        return;
      }
      const trenner = /^(und|außerdem|ausserdem|dann|sowie|plus)$/.test(x.w);
      const zwischenZahlen = x.w === "und" && t[i - 1] && t[i - 1].zahl != null && t[i + 1] && t[i + 1].zahl != null;
      if (trenner && !zwischenZahlen) { if (saetze[saetze.length - 1].length) saetze.push([]); return; }
      saetze[saetze.length - 1].push(x);
    });
    return saetze.filter((s) => s.length);
  }

  const hat = (s, re) => s.some((x) => re.test(x.w));
  /* Zahlen direkt nach einem Schlüsselwort (Schacht/Modul/Motor), "und" dazwischen erlaubt */
  function zahlenNach(s, re) {
    const out = [];
    s.forEach((x, i) => {
      if (!re.test(x.w)) return;
      for (let j = i + 1; j < s.length; j++) {
        /* "Schacht sieben zwei Päckchen": die Zwei ist die Anzahl, kein zweiter Schacht */
        if (s[j].zahl != null && s[j + 1] && NACH_ZAHL.test(s[j + 1].w)) break;
        if (s[j].zahl != null) { out.push(s[j].zahl); s[j].benutzt = true; continue; }
        if (s[j].w === "und" || s[j].w === "nummer" || s[j].w === "nr") continue;
        break;
      }
    });
    return out;
  }
  function sorteNorm(z) { return z.length < 3 ? z.padStart(3, "0") : z; }
  /* Abstreifer aus einem Teilsatz: "schmal eine Zunge", "breit zwei Zungen", "Terea", "Einsetzblech", "kein Abstreifer" */
  function abstreiferAus(s) {
    if (hat(s, /^(einsetzblech|blech)$/)) return "blech";
    if (hat(s, /^terea$/)) return "terea";
    if (hat(s, /^(kein|keine|ohne)$/) && hat(s, /^abstreifer$/)) return "kein";
    const form = hat(s, /^schmal$/) ? "schmal" : hat(s, /^breit$/) ? "breit" : null;
    if (!form) return null;
    let zungen = null;
    s.forEach((x, i) => { if (/^zungen?$/.test(x.w) && s[i - 1] && s[i - 1].zahl != null) { zungen = s[i - 1].zahl; s[i - 1].benutzt = true; } });
    return zungen === "1" ? form + "1" : zungen === "2" ? form + "2" : null;
  }

  function verstehen(text, gelernt, wissen) {
    const t = woerter(text, gelernt);
    const e = { ergebnis: null, automat: null, kuerzel: null, geraet: [], mona: [], paeckchen: [], sorten: [], sonstiges: [], hinweise: [] };

    /* 0 · "Alles in Ordnung" */
    if (t.some((x, i) => x.w === "ordnung" && t[i - 1] && t[i - 1].w === "in")) e.ergebnis = "ok";

    /* 1 · Automatennummer: "Automat" + Zahlen, Ziffern hintereinander ("neun null null eins null eins" -> A900101) */
    t.forEach((x, i) => {
      if (e.automat || !/^(automat|automaten|automatennummer)$/.test(x.w)) return;
      let z = "", j = i + 1;
      const genutzt = [];
      while (j < t.length && (t[j].zahl != null || /^(a|nummer|nr)$/.test(t[j].w)) && z.length < 6) { if (t[j].zahl != null) z += t[j].zahl; genutzt.push(t[j]); j++; }
      if (!z) return;
      genutzt.forEach((g) => { g.benutzt = true; }); x.benutzt = true;
      e.automat = "A" + z;
      if (z.length !== 6) e.hinweise.push(`Automatennummer hat ${z.length} statt 6 Stellen – bitte prüfen`);
    });
    /* 1b · Ohne das Wort "Automat": eine Zahlenfolge mit genau 6 Ziffern ist die Automatennummer.
       13.10.2026 gemessen: ohne Wortliste wurde aus "Automat" einmal "Thomas" - die Ziffern stimmten. */
    if (!e.automat) {
      for (let i = 0; i < t.length && !e.automat; i++) {
        if (t[i].zahl == null || t[i].benutzt) continue;
        let z = "", j = i;
        const lauf = [];
        while (j < t.length && t[j].zahl != null && !t[j].benutzt) { z += t[j].zahl; lauf.push(t[j]); j++; }
        /* Gesprochen: mehrere Zahlwörter. Getippt/diktiert: eine Zahl mit genau 6 Ziffern ("123456") -
           ein einzelnes Zahlwort ("hunderttausend…") zählt weiter nicht */
        if (z.length === 6 && (lauf.length >= 2 || /^\d{6}$/.test(lauf[0].w))) {
          lauf.forEach((g) => { g.benutzt = true; });
          e.automat = "A" + z;
          e.hinweise.push("Automatennummer ohne das Wort „Automat“ erkannt – bitte prüfen");
        }
        i = j - 1;
      }
    }

    /* 2 · Modell (Kürzel vom Verkaufsbericht) - nur wenn es das Kürzel gibt */
    const HERSTELLER = { sielaff: "SI", si: "SI", harting: "HA", ha: "HA", "grünig": "GR", poth: "GR", gr: "GR", azkoyen: "AZ", az: "AZ" };
    t.forEach((x, i) => {
      if (e.kuerzel) return;
      if (x.w === "touch") { const xl = t[i + 1] && t[i + 1].w === "xl"; e.kuerzel = xl ? "Touch XL" : "Touch"; x.benutzt = true; if (xl) t[i + 1].benutzt = true; return; }
      if (HERSTELLER[x.w] && t[i + 1] && t[i + 1].zahl != null) {
        const k = HERSTELLER[x.w] + t[i + 1].zahl;
        if (KUERZEL.includes(k)) { e.kuerzel = k; x.benutzt = true; t[i + 1].benutzt = true; }
      }
    });

    /* 3 · Teilsätze einordnen */
    for (const s of teilsaetze(t)) {
      const rest = s.filter((x) => !x.benutzt);
      if (!rest.length) continue;
      if (hat(s, /^ordnung$/) && hat(s, /^in$/) && rest.length <= 3) continue;   // "alles in Ordnung" - oben erledigt
      if (hat(s, /^sonstig/)) {
        const i = s.findIndex((x) => /^sonstig/.test(x.w));
        const txt = s.slice(i + 1).map((x) => x.w).join(" ");
        if (txt) e.sonstiges.push(txt);
        continue;
      }
      /* Mona-App. "App" allein zählt nur, wenn kein Gerätewort im Satz steht - am 13.10.2026
         wurde aus "Tuben nicht füllbar" einmal "tuben nicht fünf app" erkannt */
      const geraetWort = hat(s, /klemm|^tuben?$|^füllbar$|^motor$|grundstellung|^modul$|^schacht$/);
      const monaStark = hat(s, /^(mona|verbindung|abgestürzt|abstürzt|stürzt|absturz|gegenlesen|neustart|preis|preise|preisschreibung|zwangsinventur)$/);
      if (monaStark || (hat(s, /^app$/) && !geraetWort)) {
        let art = null;
        if (hat(s, /^(abgestürzt|abstürzt|stürzt|absturz|hängt)$/)) art = "absturz";
        else if (hat(s, /inventur|^umbau/)) art = "zwangsinventur";
        else if (hat(s, /^preis/)) art = "preisschreibung";
        else if (hat(s, /^(gegenlesen|neustart)$/)) art = "gegenlesen";
        else if (hat(s, /^verbindung$/) && hat(s, /^(auslesen|vor)$/)) art = "vor_auslesen";
        if (art && !e.mona.some((m) => m.art === art)) e.mona.push({ art, text: MONA_ARTEN[art] });
        if (!art) e.sonstiges.push("Mona: " + s.map((x) => x.w).join(" "));
        continue;
      }
      /* Gerätestörung */
      let art = null;
      if (hat(s, /klemm/)) art = "klemmer";
      else if (hat(s, /^tuben?$|^füllbar$/)) art = "tuben";
      /* "Motor defekt" ist "Modul defekt": Schacht, Modul und Motor sind EINE Nummer (Mirko 13.10.2026),
         und Mirko 14.10.2026: "ein modul kann auch defekt sein ... bzw motor". Nur "Grundstellung"
         ist der eigene Motor-Punkt. */
      else if (hat(s, /grundstellung/)) art = "motor";
      else if (hat(s, /^(modul|module|motor)$/) && hat(s, /^(defekt|kaputt)$/)) art = "modul";
      else if (hat(s, /^motor$/)) art = "motor";
      else if (hat(s, /^modul$/) && s.some((x) => x.zahl != null)) art = "modul";
      else if (hat(s, /^(auslesen|auslesbar|ausgelesen)$/)) art = "auslesen";
      else if (hat(s, /^(schließt|schliesst)$/) || (hat(s, /^geht$/) && hat(s, /^zu$/))) art = "schliesst";
      else if (hat(s, /^(öffnet|oeffnet)$/) || (hat(s, /^geht$/) && hat(s, /^auf$/))) art = "oeffnet";

      /* Sorte frei gesprochen: "<Name> für <Preis> Euro" (Mirko 13.10.2026: "gauloise rot für 10 euro
         im schat 12 2 päckchen nicht verkauft"). Die Zuordnung zur Sortennummer braucht die
         Sortenliste - bis dahin steht in der Meldung, was gehört wurde. */
      let sorteGehoert = null;
      /* "Zwei-Euro-Stücke" ist keine Sorte mit Preis (Beispielsatz 9 der Testseite) */
      const iEuro = s.findIndex((x, i) => x.w === "euro" && !/^(stück|stücke|stücken|münze|münzen)$/.test((s[i + 1] || {}).w || ""));
      if (iEuro > 0 && s[iEuro - 1].zahl != null && !s[iEuro - 1].benutzt) {
        let preis = Number(s[iEuro - 1].zahl); s[iEuro - 1].benutzt = true; s[iEuro].benutzt = true;
        const cent = s[iEuro + 1];   /* "zehn Euro fünfzig" - aber nicht "zehn Euro zwei Päckchen" */
        if (cent && cent.zahl != null && Number(cent.zahl) < 100 && !(s[iEuro + 2] && NACH_ZAHL.test(s[iEuro + 2].w))) { preis += Number(cent.zahl) / 100; cent.benutzt = true; }
        let ende = iEuro - 1;
        if (s[ende - 1] && s[ende - 1].w === "für") { ende--; s[ende].benutzt = true; }
        const name = [];
        for (let j = ende - 1; j >= 0; j--) {
          const x = s[j];
          if (x.benutzt || x.zahl != null || /^(schacht|modul|motor|automat|automaten|klemmer|klemmt|päckchen|sorte|im|in|am|und)$/.test(x.w)) break;
          name.unshift(x);
        }
        name.forEach((x) => { x.benutzt = true; });
        sorteGehoert = { text: name.map((x) => x.w).join(" "), preis };
      } else if (wissen && (Object.keys(wissen.namen || {}).length || Object.keys(wissen.varianten || {}).length)) {
        /* Ohne Preis: die Wörter am Satzanfang (bis zum ersten Stichwort) gegen Namen und
           Gelerntes halten - nur wenn es eindeutig klingt, ist es eine Sorte */
        const name = [];
        for (const x of s) { if (x.benutzt || x.zahl != null || /^(schacht|modul|motor|automat|automaten|klemmer|klemmt|päckchen|sorte|im|in|am|und|tuben?|mona|app)$/.test(x.w)) break; name.push(x); }
        const txt = name.map((x) => x.w).join(" ");
        const f = name.length ? sorteFinden(txt, null, wissen) : null;
        if (f && (f.sicher || f.nameSicher)) { name.forEach((x) => { x.benutzt = true; }); sorteGehoert = { text: txt, preis: null }; }
      }
      const sorte = zahlenNach(s, /^sorte$/).join("") || null;   /* "Sorte null eins acht" -> 018 */
      const nrs = zahlenNach(s, /^(schacht|modul|motor|module)$/);
      const abstreifer = abstreiferAus(s);
      if (sorteGehoert) {
        sorteGehoert.wahl = sorteFinden(sorteGehoert.text, sorteGehoert.preis, wissen);
        e.sorten.push(Object.assign(sorteGehoert, { schacht: nrs[0] || null }));
        e.hinweise.push(sorteGehoert.wahl.sicher ? "Sorte: Vorschlag bitte bestätigen" : "Sorte noch nicht zugeordnet – bitte unten wählen");
      }
      /* Päckchen: Zahl direkt VOR "Päckchen"/"Stück". "nicht verkauft" gehört dazu
         (Mirko 13.10.2026: "genau gehört dazu" = Päckchen gefunden). */
      let anzahl = null;
      s.forEach((x, i) => { if (/^(päckchen|stück)$/.test(x.w) && s[i - 1] && s[i - 1].zahl != null && !s[i - 1].benutzt) { anzahl = Number(s[i - 1].zahl); s[i - 1].benutzt = true; } });
      const nichtVerkauft = hat(s, /^verkauft$/) && hat(s, /^nicht$/);
      if (anzahl != null) e.paeckchen.push({ anzahl, schacht: nrs[0] || null, sorte: sorte ? sorteNorm(sorte) : null, nichtVerkauft });

      if (art) {
        const p = { art, text: GERAET_ARTEN[art], nr: [], sorte: null, abstreifer: null };
        if (NR_ARTEN[art] === "eine") p.nr = nrs.slice(0, 1);
        else if (NR_ARTEN[art] === "mehrere") p.nr = nrs;
        if (art === "klemmer") { if (sorte) p.sorte = sorteNorm(sorte); p.abstreifer = abstreifer; }
        p.nr.forEach((n) => { if (!(Number(n) >= 1 && Number(n) <= NUMMERN_MAX)) e.hinweise.push(`${GERAET_ARTEN[art]}: Nummer ${n} liegt nicht zwischen 1 und ${NUMMERN_MAX}`); });
        if (art === "klemmer" && !p.nr.length) e.hinweise.push("Päckchenklemmer ohne Schacht/Modul/Motor – Nummer fehlt");
        const schon = e.geraet.find((q) => q.art === art && JSON.stringify(q.nr) === JSON.stringify(p.nr));
        if (!schon) e.geraet.push(p);
      } else if (anzahl == null && !sorteGehoert) {
        /* Nichts erkannt: als Sonstiges vorschlagen (Mirko: "oder sonst was") */
        if (rest.length >= 2) e.sonstiges.push(rest.map((x) => x.w).join(" "));
      }
    }
    if (e.ergebnis !== "ok") e.ergebnis = (e.geraet.length || e.mona.length || e.paeckchen.length || e.sonstiges.length) ? "stoerung" : null;
    if (!e.automat) e.hinweise.push("Keine Automatennummer erkannt");
    if (!e.ergebnis) e.hinweise.push("Keine Störung erkannt");
    return e;
  }

  /* ---- Zwei Erkenner -> EINE Meldung (Mirko: frei sprechen, Stichwörter erkennen) ----
     Die Meldung kommt NUR aus der freien Erkennung (ganzer Wortschatz, Hörfehler-Tabelle,
     Lernliste). Die Stichwortliste prüft nur noch die Automatennummer gegen.
     Grund, gemessen 13.10.2026: Bei Wörtern außerhalb der Liste (Markennamen, "für",
     "Euro") ERFINDET die Stichwortliste Stichwörter - aus "Gauloises Rot für zehn Euro"
     wurde "auslesen vierzehn störung", das hätte eine falsche Störung "Automat nicht
     auslesbar" erzeugt. Frei kam alles außer dem Markennamen richtig an.
     Hören beide verschiedene Automatennummern: Hinweis (einmal "neun neun" statt "neun null"). */
  function zusammenfuehren(frei, liste) {
    const e = { ergebnis: null, automat: null, kuerzel: frei.kuerzel, geraet: frei.geraet.map((p) => Object.assign({}, p)), mona: frei.mona.slice(),
      paeckchen: frei.paeckchen.slice(), sorten: (frei.sorten || []).slice(), sonstiges: frei.sonstiges.slice(), hinweise: [] };
    e.automat = frei.automat || liste.automat;
    if (frei.automat && liste.automat && frei.automat !== liste.automat) e.hinweise.push(`Automatennummer unsicher: einmal ${frei.automat}, einmal ${liste.automat} gehört – bitte prüfen`);
    /* Hinweise für die gemeinsame Meldung NEU bestimmen (nicht die beiden Listen mischen) */
    const a = e.automat ? e.automat.slice(1) : "";
    if (e.automat && a.length !== 6) e.hinweise.push(`Automatennummer hat ${a.length} statt 6 Stellen – bitte prüfen`);
    const quelle = frei.automat ? frei : liste;
    const bestaetigt = frei.automat && liste.automat && frei.automat === liste.automat;
    if (e.automat && !bestaetigt && quelle.hinweise.some((h) => /ohne das Wort/.test(h))) e.hinweise.push("Automatennummer ohne das Wort „Automat“ erkannt – bitte prüfen");
    for (const p of e.geraet) {
      p.nr.forEach((n) => { if (!(Number(n) >= 1 && Number(n) <= NUMMERN_MAX)) e.hinweise.push(`${p.text}: Nummer ${n} liegt nicht zwischen 1 und ${NUMMERN_MAX}`); });
      if (p.art === "klemmer" && !p.nr.length) e.hinweise.push("Päckchenklemmer ohne Schacht/Modul/Motor – Nummer fehlt");
    }
    for (const h of frei.hinweise) if (/^Sorte/.test(h) && !e.hinweise.includes(h)) e.hinweise.push(h);
    e.ergebnis = frei.ergebnis === "ok" ? (e.geraet.length || e.mona.length ? "stoerung" : "ok")
      : (e.geraet.length || e.mona.length || e.paeckchen.length || e.sonstiges.length) ? "stoerung" : null;
    if (!e.automat) e.hinweise.push("Keine Automatennummer erkannt");
    if (!e.ergebnis) e.hinweise.push("Keine Störung erkannt");
    return e;
  }

  /* Die Meldung als Zeilen, wie sie in Liste, Excel und PDF stehen würde */
  /* Nie die interne Sortennummer (Mirko 15.10.2026: „überall weg“) – kuerzelVon macht aus einer gesprochenen Nummer ("Sorte null eins
     acht") das Kürzel (Störungsliste: R.sorteKuerzel, Testseite: Sortentabelle) */
  function alsZeilen(e, kuerzelVon) {
    const z = [];
    const kz = (s) => (kuerzelVon && kuerzelVon(s)) || s;
    if (e.automat || e.kuerzel) z.push(["Automat", [e.automat, e.kuerzel].filter(Boolean).join(" · ")]);
    if (e.ergebnis === "ok") z.push(["Ergebnis", "Alles in Ordnung"]);
    for (const p of e.geraet) z.push(["Gerätestörung", p.text + (p.nr.length ? " – Schacht/Modul/Motor " + p.nr.join(", ") : "") + (p.sorte ? " – Sorte " + kz(p.sorte) : "") + (p.abstreifer ? " – Abstreifer " + ABSTREIFER[p.abstreifer] : "")]);
    const euro = (v) => v.toLocaleString("de-DE", { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 }) + " €";
    const sorteText = (k) => k.kuerzel + (k.name ? " · " + k.name : "");
    for (const s of e.sorten || []) {
      if (s.bestaetigt) z.push(["Sorte", sorteText(s.bestaetigt) + (s.schacht ? " · Schacht " + s.schacht : "")]);
      else z.push(["Sorte (gehört)", (s.text ? "„" + s.text + "“" : "?") + (s.preis != null ? " · " + euro(s.preis) : "") + (s.schacht ? " · Schacht " + s.schacht : "")
        + (s.wahl && s.wahl.vorschlag ? " → Vorschlag " + sorteText(s.wahl.vorschlag) : "")]);
    }
    /* "nicht verkauft" = Päckchen gefunden (Mirko 13.10.2026) */
    for (const p of e.paeckchen) z.push(["Päckchen gefunden", p.anzahl + (p.schacht ? " – Schacht " + p.schacht : "") + (p.sorte ? " – Sorte " + kz(p.sorte) : "")]);
    for (const m of e.mona) z.push(["Mona-App", m.text]);
    for (const s of e.sonstiges) z.push(["Sonstiges", s]);
    return z;
  }

  const api = { verstehen, zusammenfuehren, alsZeilen, zahlWort, woerter, koelner, klangAbstand, sorteFinden, packungspreis, STICHWOERTER, HOERFEHLER };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else wurzel.Verstehen = api;
})(typeof window !== "undefined" ? window : globalThis);
