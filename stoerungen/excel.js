/* =====================================================================
   stoerungen/excel.js - Störungsliste: echte .xlsx-Datei, auf dem Gerät
   erzeugt (11.10.2026). Ohne Bibliothek und ohne Netz: Eine .xlsx ist ein
   ZIP mit ein paar XML-Dateien. Gespeichert wird ohne Kompression
   ("stored"), das können Excel, Numbers und openpyxl lesen.
   Texte als inlineStr - so bleibt "018" Text und verliert die Null nicht.
   ===================================================================== */
(function (wurzel) {
  "use strict";
  const MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  const enc = new TextEncoder();
  const KOPF = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
  const xml = (s) => String(s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  function spalte(n) { let s = ""; n += 1; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; }
  function zelle(wert, ref, stil) {
    const s = stil ? ' s="' + stil + '"' : "";
    if (typeof wert === "number" && isFinite(wert)) return '<c r="' + ref + '"' + s + "><v>" + wert + "</v></c>";
    if (wert === "" || wert == null) return "";
    return '<c r="' + ref + '"' + s + ' t="inlineStr"><is><t xml:space="preserve">' + xml(wert) + "</t></is></c>";
  }
  function blattXml(b) {
    const fett = new Set(b.fett || []), breiten = [];
    b.zeilen.forEach((z) => z.forEach((w, i) => { breiten[i] = Math.max(breiten[i] || 8, Math.min(60, String(w == null ? "" : w).length + 2)); }));
    const cols = breiten.length ? "<cols>" + breiten.map((w, i) => '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"/>').join("") + "</cols>" : "";
    const rows = b.zeilen.map((z, r) => '<row r="' + (r + 1) + '">' + z.map((w, c) => zelle(w, spalte(c) + (r + 1), fett.has(r) ? 1 : 0)).join("") + "</row>").join("");
    return KOPF + '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' + cols + "<sheetData>" + rows + "</sheetData></worksheet>";
  }
  const STYLES = KOPF + '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
    + '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>'
    + '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>'
    + '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
    + '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
    + '<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>'
    + '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';

  /* ---- ZIP ohne Kompression ---- */
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(b) { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  function zip(dateien) {
    const teile = [], zentral = []; let pos = 0;
    for (const d of dateien) {
      const name = enc.encode(d.name), crc = crc32(d.daten), n = d.daten.length;
      const lokal = new DataView(new ArrayBuffer(30));
      lokal.setUint32(0, 0x04034b50, true); lokal.setUint16(4, 20, true); lokal.setUint16(6, 0x0800, true);
      lokal.setUint16(8, 0, true); lokal.setUint16(10, 0, true); lokal.setUint16(12, 0x21, true);
      lokal.setUint32(14, crc, true); lokal.setUint32(18, n, true); lokal.setUint32(22, n, true);
      lokal.setUint16(26, name.length, true); lokal.setUint16(28, 0, true);
      teile.push(new Uint8Array(lokal.buffer), name, d.daten);
      const z = new DataView(new ArrayBuffer(46));
      z.setUint32(0, 0x02014b50, true); z.setUint16(4, 20, true); z.setUint16(6, 20, true); z.setUint16(8, 0x0800, true);
      z.setUint16(10, 0, true); z.setUint16(12, 0, true); z.setUint16(14, 0x21, true);
      z.setUint32(16, crc, true); z.setUint32(20, n, true); z.setUint32(24, n, true);
      z.setUint16(28, name.length, true); z.setUint16(30, 0, true); z.setUint16(32, 0, true);
      z.setUint16(34, 0, true); z.setUint16(36, 0, true); z.setUint32(38, 0, true); z.setUint32(42, pos, true);
      zentral.push(new Uint8Array(z.buffer), name);
      pos += 30 + name.length + n;
    }
    const groesse = zentral.reduce((s, x) => s + x.length, 0);
    const ende = new DataView(new ArrayBuffer(22));
    ende.setUint32(0, 0x06054b50, true); ende.setUint16(8, dateien.length, true); ende.setUint16(10, dateien.length, true);
    ende.setUint32(12, groesse, true); ende.setUint32(16, pos, true);
    const alle = teile.concat(zentral, [new Uint8Array(ende.buffer)]);
    const gesamt = new Uint8Array(alle.reduce((s, x) => s + x.length, 0)); let o = 0;
    for (const x of alle) { gesamt.set(x, o); o += x.length; }
    return gesamt;
  }

  function erzeuge(blaetter) {
    const n = blaetter.length;
    const dateien = [
      ["[Content_Types].xml", KOPF + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>'
        + '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
        + '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
        + blaetter.map((_, i) => '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>').join("")
        + "</Types>"],
      ["_rels/.rels", KOPF + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
      ["xl/workbook.xml", KOPF + '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>'
        + blaetter.map((b, i) => '<sheet name="' + xml(b.name) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>').join("") + "</sheets></workbook>"],
      ["xl/_rels/workbook.xml.rels", KOPF + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        + blaetter.map((_, i) => '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>').join("")
        + '<Relationship Id="rId' + (n + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'],
      ["xl/styles.xml", STYLES],
    ].concat(blaetter.map((b, i) => ["xl/worksheets/sheet" + (i + 1) + ".xml", blattXml(b)]));
    return zip(dateien.map(([name, text]) => ({ name, daten: enc.encode(text) })));
  }

  const X = { MIME, erzeuge };
  if (typeof module !== "undefined" && module.exports) module.exports = X; else wurzel.StoerExcel = X;
})(typeof window !== "undefined" ? window : globalThis);
