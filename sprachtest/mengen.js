/* =====================================================================
   sprachtest/mengen.js - Zählen per Sprache: "40 mal 80, 12 mal 100" (14.10.2026)

   Mirko 14.10.2026 zur Fahrzeug-Inventur: Er trägt "Stangen × Stangenpreis"
   ein und will so sprechen: "anzahl der stange also zum beispiel 40 mal 80".
   Was am meisten Zeit kostet: "das zählen selbst, das sortieren / aufräumen,
   dass alle preise beieinander liegen und nicht 9 euro päckchen bei 10 euro
   päckchen liegen". Deshalb rechnet die App gleiche Preise zusammen - jeder
   Stapel kann angesagt werden, wie er liegt.

   Gesprochen wird über das Mikrofon der iPhone-Tastatur; Apple schreibt Ziffern,
   aber kleine Zahlen gern als Wort ("Dreimal 80"), "mal" auch als "x"/"×",
   Preise mit "€" und Satzzeichen. Nichts davon wird geraten: Was nicht
   eindeutig "Menge mal Preis" ist, steht unter "unklar" und wird angezeigt.

   Reine Logik: Browser (window.SpracheMengen) und Node.
   ===================================================================== */
(function (wurzel) {
  "use strict";
  const V = wurzel.Verstehen || (typeof require === "function" ? require("./verstehen.js") : null);
  const zahlWort = (w) => (V && V.zahlWort ? V.zahlWort(w) : (/^\d+$/.test(w) ? w : null));

  /* Spalten des Inventurblatts (INV_GRUPPEN), die per Stichwort gewählt werden - Lieferscheine nicht */
  const GRUPPEN_WORT = [
    [/^(cigaretten|zigaretten|zigarette|cigarette)$/, "cig"], [/^(zigarren|zigarre|zigarillos?)$/, "zig"], [/^(tabak|rolls?|drehtabak|stopftabak)$/, "tab"],
    [/^rba$/, "rba"], [/^(hülsen|hülse|papier|papers?|blättchen)$/, "hue"], [/^(sonstiges|sonstige)$/, "son"],
  ];
  const MAL = /^(mal|x|zu|a|je)$/;
  const EINHEIT = /^(stangen?|stück|stk|packungen?|päckchen|schachteln?)$/;
  const FUELL = /^(und|dann|noch|plus|euro|eur|mal)$/;

  /* "12,50" / "12.5" / "80" -> Zahl; sonst null */
  function zahl(t) {
    if (/^\d+([.,]\d{1,2})?$/.test(t)) return Number(t.replace(",", "."));
    const w = zahlWort(t);
    return w == null ? null : Number(w);
  }
  function woerter(text) {
    return String(text || "").toLowerCase()
      .replace(/€/g, " euro ")
      .replace(/[×*à]/g, " mal ")
      .replace(/(\d)\s*x\s*(\d)/g, "$1 mal $2")
      /* "Dreimal 80", "40-mal 80", "40mal" -> Zahl + "mal" */
      .replace(/([a-zäöüß]+|\d+)-?mal\b/g, (m, z) => (zahl(z) != null ? z + " mal" : m))
      /* Satzzeichen als Grenze, Dezimalkomma ("12,50") bleibt */
      .replace(/[,.;:!?]+(?=\s|$)/g, " | ")
      .replace(/[^a-z0-9äöüß,.|/]+/g, " ")
      .split(/\s+/).filter(Boolean)
      .flatMap((w) => (w.includes("/") ? w.split("/") : [w]));   // "Hülsen/Papier"
  }

  /* Text -> { posten: [{ gruppe, menge, preis, text }], unklar: ["…"] } */
  function lesen(text, startGruppe) {
    const t = woerter(text), posten = [], unklar = [];
    let gruppe = startGruppe || "cig", rest = [];
    const restWeg = () => { const r = rest.filter((w) => !FUELL.test(w) && !EINHEIT.test(w)); if (r.length) unklar.push(r.join(" ")); rest = []; };
    for (let i = 0; i < t.length; i++) {
      const w = t[i];
      const gw = GRUPPEN_WORT.find(([re]) => re.test(w));
      if (gw) { restWeg(); gruppe = gw[1]; continue; }
      if (w === "|") { restWeg(); continue; }
      const menge = zahl(w);
      if (menge != null) {
        let j = i + 1;
        while (j < t.length && EINHEIT.test(t[j])) j++;
        if (j < t.length && MAL.test(t[j])) {
          let k = j + 1;
          const preis = k < t.length ? zahl(t[k]) : null;
          if (preis != null) {
            let p = preis, ende = k;
            /* "12 Euro 50" -> 12,50 (nicht, wenn danach schon die nächste Menge kommt: "12 Euro 50 mal 80") */
            if (t[k + 1] === "euro" && t[k + 2] != null && zahl(t[k + 2]) != null && zahl(t[k + 2]) < 100 && !MAL.test(t[k + 3] || "")) { p = preis + zahl(t[k + 2]) / 100; ende = k + 2; }
            /* Wörter direkt davor ("Marlboro Rot 4 mal 80") sind nur eine Bezeichnung - kein "unklar" */
            const vorher = rest.filter((x) => !FUELL.test(x) && !EINHEIT.test(x)).join(" "); rest = [];
            if (Number.isInteger(menge) && menge > 0 && p > 0) posten.push({ gruppe, menge, preis: Math.round(p * 100) / 100, text: t.slice(i, ende + 1).join(" "), vorher });
            else unklar.push(t.slice(i, ende + 1).join(" "));
            i = ende;
            continue;
          }
        }
      }
      rest.push(w);
    }
    restWeg();
    return { posten, unklar };
  }

  /* Gleiche Preise je Spalte zusammenrechnen: [{ gruppe, preis, menge, anzahl }] - Reihenfolge wie gesprochen */
  function zusammen(posten) {
    const aus = [];
    for (const p of posten) {
      const da = aus.find((x) => x.gruppe === p.gruppe && x.preis === p.preis);
      if (da) { da.menge += p.menge; da.anzahl++; } else aus.push({ gruppe: p.gruppe, preis: p.preis, menge: p.menge, anzahl: 1 });
    }
    return aus;
  }

  /* ---- Neue Ware zählen (14.10.2026): Kartons und lose Stangen, je Ansage eine Zeile ----
     Im Code (kaeZeilenSumme): Zeile = Kartons × Stangen je Karton + lose Stangen; Kartongrößen 12/16/20/25/30,
     Vorgabe 20 (Mirko 05.09.2026). Gesprochen: "3 Kartons à 20", "3 mal 20", "3 20er Kartons", "12 Stangen",
     "12 lose", "Lieferschein 240". Eine Zahl OHNE "Kartons"/"Stangen" wird nie gezählt ("Regal 1" ist keine Stange). */
  const KARTON = /^(kartons?|kisten?)$/, STANGE = /^(stangen?|lose)$/;
  function ware(text, groessen, standard) {
    const G = groessen || [12, 16, 20, 25, 30], STD = standard || 20;
    const t = woerter(text), posten = [], unklar = [];
    let lieferschein = null, rest = [];
    const restWeg = () => { const r = rest.filter((w) => !FUELL.test(w) && !EINHEIT.test(w) && w !== "laut"); if (r.length) unklar.push(r.join(" ")); rest = []; };
    const nimm = (p) => { p.vorher = rest.filter((x) => !FUELL.test(x) && !EINHEIT.test(x)).join(" "); rest = []; posten.push(p); };
    const er = (w) => { const m = String(w || "").match(/^(\d+)er$/); return m ? Number(m[1]) : null; };
    for (let i = 0; i < t.length; i++) {
      const w = t[i];
      if (w === "|") { restWeg(); continue; }
      if (w === "lieferschein" && t[i + 1] != null && zahl(t[i + 1]) != null) {
        rest = rest.filter((x) => x !== "laut"); restWeg();
        lieferschein = zahl(t[i + 1]); i += 1; if (STANGE.test(t[i + 1] || "")) i += 1;
        continue;
      }
      const n = zahl(w);
      if (n != null && Number.isInteger(n) && n > 0) {
        let j = i + 1, gr = null;
        if (er(t[j]) != null && KARTON.test(t[j + 1] || "")) { gr = er(t[j]); j++; }            // "3 20er Kartons"
        if (KARTON.test(t[j] || "")) {
          j++;
          if (gr == null && (MAL.test(t[j] || "") || t[j] === "mit") && zahl(t[j + 1] || "") != null) { gr = zahl(t[j + 1]); j += 2; }   // "3 Kartons à 20"
          else if (gr == null && er(t[j]) != null) { gr = er(t[j]); j++; }                       // "3 Kartons 20er"
          if (STANGE.test(t[j] || "")) j++;
          const text0 = t.slice(i, j).join(" ");
          if (gr != null && !G.includes(gr)) { restWeg(); unklar.push(text0 + ` (Kartons mit ${gr} Stangen gibt es in der Auswahl nicht)`); }
          else nimm({ art: "karton", kartons: n, groesse: gr == null ? STD : gr, standard: gr == null, text: text0 });
          i = j - 1; continue;
        }
        if (MAL.test(t[j] || "") && zahl(t[j + 1] || "") != null) {                              // "3 mal 20" = 3 Kartons à 20
          const g2 = zahl(t[j + 1]); let k = j + 2; if (STANGE.test(t[k] || "")) k++;
          const text0 = t.slice(i, k).join(" ");
          if (!G.includes(g2)) { restWeg(); unklar.push(text0 + ` (Kartons mit ${g2} Stangen gibt es in der Auswahl nicht)`); }
          else nimm({ art: "karton", kartons: n, groesse: g2, standard: false, text: text0 });
          i = k - 1; continue;
        }
        if (STANGE.test(t[j] || "")) { let k = j + 1; if (STANGE.test(t[k] || "")) k++; nimm({ art: "stangen", anzahl: n, text: t.slice(i, k).join(" ") }); i = k - 1; continue; }
      }
      rest.push(w);
    }
    restWeg();
    return { posten, unklar, lieferschein };
  }

  const api = { lesen, zusammen, woerter, ware };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else wurzel.SpracheMengen = api;
})(typeof window !== "undefined" ? window : globalThis);
