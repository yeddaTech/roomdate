import * as z from 'zod/mini';

// Unico punto da cui si importa zod, nella variante "mini": stesse regole, ma il bundler scarta
// ciò che non si usa (19 KB invece di 80). La CSP del sito vieta eval: la variante completa lo
// userebbe per compilare gli schemi (violazioni della CSP, verificato), la mini oggi no.
// jitless lo esclude comunque, anche con versioni future o passando alla variante completa.
z.config({ jitless: true });

export { z };
