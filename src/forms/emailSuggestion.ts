// Suggerimento per gli errori di battitura più comuni nel dominio dell'email ("gmial.com").
// Non c'è ancora una verifica dell'indirizzo via email: un errore qui renderebbe l'account
// difficile da ritrovare, quindi conviene accorgersene subito.

const COMMON_DOMAINS = [
  'gmail.com', 'hotmail.com', 'hotmail.it', 'outlook.com', 'outlook.it', 'live.com', 'live.it',
  'yahoo.com', 'yahoo.it', 'icloud.com', 'libero.it', 'virgilio.it', 'alice.it', 'tim.it',
  'tiscali.it', 'fastwebnet.it', 'email.it', 'proton.me', 'protonmail.com',
];

// Domini veri a una lettera da uno comune ("tin.it" e "tim.it"): per questi nessun suggerimento
const OTHER_KNOWN_DOMAINS = [
  'tin.it', 'mail.com', 'gmx.com', 'gmx.it', 'gmx.net', 'aol.com', 'msn.com', 'me.com', 'mac.com',
  'inwind.it', 'iol.it', 'poste.it', 'pec.it', 'yandex.com', 'hotmail.fr', 'outlook.fr', 'yahoo.fr',
];

/** Distanza di Damerau-Levenshtein (con lo scambio di due lettere vicine, "gmial" → "gmail"). */
function distance(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[a.length][b.length];
}

/** L'indirizzo corretto, se il dominio sembra un errore di battitura di uno comune; altrimenti null. */
export function suggestEmail(value: string): string | null {
  const address = value.trim().toLowerCase();
  const at = address.lastIndexOf('@');
  if (at < 1) return null;
  const domain = address.slice(at + 1);
  if (domain.length < 4 || COMMON_DOMAINS.includes(domain) || OTHER_KNOWN_DOMAINS.includes(domain)) return null;

  let best: string | null = null;
  let bestDistance = 3;
  for (const candidate of COMMON_DOMAINS) {
    const d = distance(domain, candidate);
    if (d < bestDistance) {
      best = candidate;
      bestDistance = d;
    }
  }
  // Con domini corti due correzioni sono troppe: "tim.it" e "tin.it" sono entrambi veri
  if (!best || (bestDistance === 2 && domain.length < 8)) return null;
  return `${address.slice(0, at)}@${best}`;
}
