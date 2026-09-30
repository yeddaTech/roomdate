// Tema prima del primo disegno, così al buio la pagina non lampeggia di bianco: quello scelto sul
// sito (localStorage, vedi src/theme/theme.ts), altrimenti quello del dispositivo. È un file e non
// uno script scritto nella pagina, perché la CSP del sito vieta gli script inline.
(function () {
  var choice = null;
  try {
    choice = window.localStorage.getItem('roomdate-theme');
  } catch (e) {
    // archivio non disponibile (navigazione privata con blocchi): vale il tema del dispositivo
  }
  var dark = choice === 'dark' || (choice !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
  var meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', dark ? '#1c1824' : '#fafaf9');
})();
