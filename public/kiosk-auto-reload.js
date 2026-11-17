// Kiosk-Selbstaktualisierung: sync-content.sh schreibt alle 5 Min /kiosk-content.json.
// Ändert sich der Inhalt (ohne lastSync), startet die Seite über /kiosk/ neu, damit auch
// ein geänderter Modus greift. Wartet, bis niemand mehr bedient (2 Min ohne Eingabe).
// Ohne kiosk-content.json (Browser, kein Pi) passiert nichts.
(() => {
  const PRUEF_MS = 15 * 60 * 1000;
  const RUHE_MS = 2 * 60 * 1000;
  let stand = null;
  let letzteEingabe = Date.now();
  ['pointerdown', 'keydown', 'touchstart'].forEach((e) =>
    document.addEventListener(e, () => { letzteEingabe = Date.now(); }, { passive: true }));

  const lesen = async () => {
    const r = await fetch('/kiosk-content.json', { cache: 'no-store' });
    if (!r.ok) return null;
    const { lastSync, ...inhalt } = await r.json();
    return JSON.stringify(inhalt);
  };

  const pruefen = async () => {
    try {
      const neu = await lesen();
      if (neu === null) return;
      if (stand === null) { stand = neu; return; }
      if (neu !== stand && Date.now() - letzteEingabe > RUHE_MS) location.replace('/kiosk/');
    } catch (_) {}
  };

  pruefen();
  setInterval(pruefen, PRUEF_MS);
})();
