/* =============================================================
   ECHTE Konfiguration – Mirkos Spesen-Sync.

   Die Kennung bei authDomain/projectId/storageBucket ist die feste
   technische Kennung des Firebase-Projekts. Sie laesst sich nicht
   umbenennen und bleibt bewusst so (Entscheidung Mirko).

   Diese Datei ist per .gitignore vom Hochladen ausgenommen, damit die
   Werte nicht versehentlich oeffentlich werden. Der apiKey ist bei
   Firebase kein Geheimnis – der Schutz liegt in firestore.rules
   (nur mirkorieb@t-online.de darf lesen/schreiben).

   Solange der Sync laeuft, nichts hier aendern.
   ============================================================= */

window.SPESEN_FIREBASE_CONFIG = {
  apiKey: "AIzaSyA5Rh1lAcRqGUN3schrAQH_CuZ-hHJXz7s",
  authDomain: "hall-cd0f1.firebaseapp.com",
  projectId: "hall-cd0f1",
  storageBucket: "hall-cd0f1.firebasestorage.app",
  messagingSenderId: "977634186310",
  appId: "1:977634186310:web:df1209ec519321864e6647",
  measurementId: "G-XGJ33PHXJS",
};
