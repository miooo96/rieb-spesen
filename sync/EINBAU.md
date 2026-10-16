# Auto-Sync – Version „nur für mich"

> **Stand (aktualisiert 01.10.2026):** Der Sync ist **gebaut, eingerichtet und
> live**. Das Firebase-Projekt steht (Kennung: `projectId` in
> `sync/firebase-config.js`), `sync/firebase-config.js` hat
> echte Werte und wird **mit hochgeladen** (deployt), damit Handy und PC auf
> der Webseite (damals die alte Adresse) denselben Stand sehen.
>
> Diese Fassung ist **auf Mirkos E-Mail verriegelt** (`mirkorieb@t-online.de`
> in `firestore.rules`). Selbst wenn sich jemand anders anmeldet, kann er
> nichts lesen oder speichern – reines Ein-Mann-Werkzeug, keine
> Datenschutz-Freigabe nötig.
>
> **Aktivierung:** Der Sync läuft nur, wenn in den Stammdaten der Name
> „Mirko Rieb" steht (`istMirko`). Kollegen sehen **keinen** Anmelde-Knopf und
> kein Firebase – ihr Rechner verhält sich exakt wie bisher, rein lokal.
> Not-Aus auf einem Gerät: die Seite einmal mit `?sync=aus` aufrufen.
>
> **Anmeldung:** E-Mail **+ Passwort** (kein Mailversand mehr, daher kein
> Tageslimit). Umgestellt vom früheren E-Mail-Link am 01.10.2026.

---

## ✅ Sicherheit geprüft (01.10.2026)

Von außen **ohne Anmeldung** gegen die echte Datenbank getestet
(Firestore-REST-API, das Projekt aus `sync/firebase-config.js`):

| Versuch | Ergebnis |
|---|---|
| Unangemeldet **lesen** (fremder Pfad) | `403 PERMISSION_DENIED` |
| Unangemeldet **schreiben** (fremder Pfad) | `403 PERMISSION_DENIED` |
| Unangemeldet **lesen** unter fremder User-ID | `403 PERMISSION_DENIED` |

→ Die Datenbank ist **nicht** im offenen Test-Modus. Fremde kommen weder lesend
noch schreibend hinein. Die Regel ist scharf.

> **Noch nicht von hier aus geprüft:** dass Mirkos **eigenes** Konto schreiben
> darf (dafür bräuchte es sein Login). Der einfache Gegenbeweis ist der Betrieb
> selbst: Sobald der Sync auf zwei Geräten Daten überträgt, ist beides belegt –
> die Regel sperrt Fremde **und** lässt Mirko herein. Scheitert der eigene Login
> dagegen, läuft gar kein Sync – das würde sofort auffallen.

---

## Das Firebase-Projekt (einmalig, bereits erledigt)

Das Projekt (Kennung: `projectId` in `sync/firebase-config.js`) liegt in der
Firebase-Konsole mit Mirkos Google-Konto. Die
Schritte, so wie sie gemacht wurden – als Nachschlagewerk, falls das Projekt
je neu aufgesetzt werden muss:

1. **Projekt anlegen** – console.firebase.google.com → „Projekt hinzufügen".
2. **Web-App registrieren** (`</>`), **kein** Hosting. Die `firebaseConfig`-Werte
   stehen in `sync/firebase-config.js`.
3. **Anmeldung einschalten** – Authentication → Anbieter **E-Mail/Passwort**
   aktivieren. Dann Authentication → Settings → Authorized domains →
   die Adresse der Webseite eintragen (damals die alte Adresse).
4. **Datenbank einschalten (EU!)** – Firestore Database → Standort
   **`europe-west3` (Frankfurt)**, Produktionsmodus. Reiter **Rules** → Inhalt
   von `sync/firestore.rules` einfügen → **Veröffentlichen**. (Dort steht die
   E-Mail-Verriegelung.)
5. **Konfiguration** – `sync/firebase-config.js` mit den echten Werten (liegt
   vor).

> ⚠ **Wenn die Regel in `firestore.rules` geändert wird, muss sie in der
> Firebase-Konsole (Schritt 4) neu veröffentlicht werden.** Die Datei im Repo
> allein wirkt nicht – scharf ist nur, was in der Konsole steht.

---

## Testen (zwei echte Geräte, dieselbe E-Mail)
1. Unten rechts „☁︎ Anmelden" → E-Mail + Passwort → Marke wird grün.
2. Gerät A: Arbeitszeit eintragen → taucht auf Gerät B nach wenigen Sekunden auf.
3. Gerät B offline schalten, etwas ändern, wieder online → geht von allein hoch.
4. Monat einreichen → bleibt auf beiden gesperrt.

## Wieder abschalten
Auf einem Gerät: Seite mit `?sync=aus` aufrufen. Komplett aus: Namen in den
Stammdaten ≠ „Mirko Rieb" setzen, **oder** `sync/firebase-config.js` löschen,
**oder** die Zeile `<script type="module" src="sync/firebase-sync.js">` aus
`index.html` entfernen. Danach ist alles wieder rein lokal, ohne Datenverlust.

## Nicht mit dabei
„Neue Ware zählen" (`kfz-kaefig-v1`) und die im Tool abgelegten **PDFs**
(kommen als Version 2 über Firebase Storage). Für die PDFs bis dahin weiter
„Backup speichern".
