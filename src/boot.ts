// Il primo codice dell'app, separato e minuscolo: index.html lo carica con async, quindi si esegue
// appena arriva, mentre il resto dell'app si scarica ancora (src/api/early.ts).
import { startPageRequests } from './api/early';

startPageRequests(window.location);
