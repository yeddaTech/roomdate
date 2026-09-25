import PageMeta from '../components/PageMeta';
import { Link, useNavigate } from 'react-router-dom';

export default function Privacy() {
  const navigate = useNavigate();

  return (
    <div className="bg-[#FAFAFA] font-sans text-neutral-900 py-12 px-6 selection:bg-orange-200">
      <PageMeta title="Informativa sulla Privacy e Sicurezza | RoomDate" />

      <div className="max-w-3xl mx-auto bg-white p-8 md:p-12 rounded-3xl shadow-xs border border-neutral-100 relative overflow-hidden">
        
        {/* Sottile orb decorativo */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-orange-400/5 blur-[80px] rounded-full pointer-events-none"></div>

        {/* Bottone Indietro */}
        <button 
          onClick={() => navigate(-1)} 
          className="mb-8 bg-neutral-50 border border-neutral-200 hover:bg-neutral-100 text-neutral-700 px-5 py-2.5 rounded-full text-sm font-bold transition-all cursor-pointer shadow-xs"
        >
          ← Torna indietro
        </button>

        <h1 className="font-serif text-3xl md:text-4xl font-extrabold text-neutral-900 mb-2 tracking-tight">
          Informativa sulla Privacy e Sicurezza
        </h1>
        <p className="text-sm text-neutral-400 font-medium mb-8">Ultimo aggiornamento: Settembre 2026</p>

        <div className="flex flex-col gap-8 leading-relaxed text-neutral-600 font-medium">
          
          <section className="bg-neutral-50 p-6 rounded-3xl border border-neutral-100">
            <h2 className="font-serif text-xl font-extrabold text-neutral-900 mb-3">1. Titolare del Trattamento</h2>
            <p className="text-neutral-600">
              La piattaforma <strong>RoomDate</strong> è un'applicazione in fase di sviluppo (MVP). Il Titolare del Trattamento dei dati personali è la Direzione di RoomDate. Per qualsiasi richiesta relativa alla privacy o per esercitare i propri diritti, è possibile contattare il Titolare all'indirizzo email: <a href="mailto:esyoun70@gmail.com" className="text-orange-500 font-bold hover:text-orange-600 transition-colors">esyoun70@gmail.com</a>.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-extrabold text-neutral-900 mb-3">2. Dati Raccolti e Luogo del Trattamento</h2>
            <p className="mb-3">Raccogliamo solo i dati strettamente necessari all'utilizzo della piattaforma:</p>
            <ul className="list-disc pl-5 flex flex-col gap-2 mb-4 text-neutral-600">
              <li>Dati di registrazione (nome, cognome, email, data di nascita). La password non viene inviata ai nostri server: il browser ne ricava una chiave d&apos;accesso, di cui conserviamo solo l&apos;hash.</li>
              <li>Dati del profilo (città, occupazione, budget, presentazione, abitudini di vita). Se il profilo è pubblico sono visibili agli altri utenti insieme al nome; cognome, email e data di nascita restano privati (agli altri utenti mostriamo solo gli anni compiuti).</li>
              <li>Informazioni sugli annunci inseriti (titolo, città, zona, tipo di stanza, prezzo, descrizione).</li>
              <li>I messaggi della chat, conservati sul server in forma cifrata end-to-end, e le chiavi di cifratura dell&apos;utente. La chiave privata è a sua volta cifrata con una chiave che il browser ricava dalla password e che non riceviamo mai: non possiamo leggere i messaggi.</li>
              <li>Se crei una chiave di recupero: un&apos;impronta che ci permette di riconoscerla e una copia della chiave privata cifrata con la chiave stessa. La chiave di recupero non ci viene mai inviata.</li>
              <li>Un registro di sicurezza con accessi, tentativi falliti, cambi di password ed eliminazioni di account, conservato per 90 giorni. Email e indirizzo IP vi compaiono solo come impronte non reversibili, che servono a rallentare chi tenta di indovinare le password.</li>
              <li>Gli utenti che hai bloccato e le segnalazioni che invii o che ricevi. Se, segnalando qualcuno dalla chat, scegli di allegare i messaggi che ti ha inviato, il loro testo viene salvato in chiaro perché il moderatore possa leggerlo.</li>
            </ul>
            <p>
              RoomDate è riservato ai maggiorenni: la data di nascita serve anche a verificare che tu abbia almeno 18 anni.
            </p>
            <p>
              I dati raccolti vengono elaborati tramite l&apos;infrastruttura cloud di Vercel e conservati in un database gestito da Neon. Il database e le funzioni del server si trovano in Unione Europea (Francoforte, Germania), e le foto degli annunci sono archiviate da Cloudflare in uno spazio soggetto alla giurisdizione UE. Le pagine del sito, che non contengono dati personali, sono distribuite dalla rete globale di Vercel.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-extrabold text-neutral-900 mb-3">3. Cookie e Strumenti di Tracciamento</h2>
            <p className="mb-3">
              RoomDate utilizza solo strumenti tecnici necessari al funzionamento della piattaforma: un cookie di sessione (<code>__Host-roomdate_session</code>, valido fino a 30 giorni e 7 giorni dall&apos;ultimo utilizzo) per mantenere l&apos;accesso, e la memoria locale del browser (<code>localStorage</code> e IndexedDB) per conservare le chiavi di cifratura della chat, cancellate all&apos;uscita. Per questi strumenti non è richiesto il consenso.
            </p>
            <p>
              RoomDate non utilizza cookie analitici, di profilazione o pubblicitari. I caratteri tipografici sono ospitati sul sito stesso, senza richieste a servizi esterni. Per la chat in tempo reale il sito usa Pusher, che riceve i dati tecnici della connessione, come l&apos;indirizzo IP.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-extrabold text-neutral-900 mb-3">4. Visibilità dei Dati e Bot AI</h2>
            <p>
              Gli annunci immobiliari e i profili contrassegnati come "pubblici" sono accessibili liberamente sulla rete. Tali dati possono essere indicizzati dai motori di ricerca tradizionali e scansionati da bot di Intelligenza Artificiale (AIO) al solo scopo di favorire il matching e la visibilità degli annunci stessi. L'utente può richiedere la rimozione o la modifica dei propri dati in qualsiasi momento.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-extrabold text-neutral-900 mb-3">5. Sicurezza e Limitazione di Responsabilità</h2>
            <p className="mb-3">
              RoomDate adotta misure di sicurezza tecniche (come la cifratura delle password e connessioni sicure) per proteggere i tuoi dati. Tuttavia, RoomDate funge esclusivamente da <strong>intermediario tecnologico</strong>. 
            </p>
            <div className="bg-rose-50/50 p-5 rounded-2xl border border-rose-100 text-rose-800 text-sm leading-relaxed">
              ⚠️ <strong>Nota di sicurezza per gli utenti:</strong> Non inviare mai denaro, caparre o documenti d'identità sensibili all'interno della chat privata prima di aver visionato di persona l'immobile e aver sottoscritto un regolare contratto di locazione. RoomDate non si assume alcuna responsabilità per transazioni o accordi economici presi privatamente tra gli utenti.
            </div>
          </section>

          <section>
            <h2 className="font-serif text-xl font-extrabold text-neutral-900 mb-3">6. Blocchi, Segnalazioni e Moderazione</h2>
            <p>
              Puoi bloccare un utente: da quel momento nessuno dei due può scrivere all&apos;altro né trovarlo nelle ricerche, e puoi sbloccarlo quando vuoi dalle impostazioni. Puoi anche segnalare un utente o un annuncio che viola i Termini di utilizzo.
            </p>
            <p>
              Le segnalazioni sono esaminate da persone, gli amministratori di RoomDate, senza decisioni automatiche. Vedono il motivo e la descrizione che hai scritto, il nome dell&apos;utente segnalato, l&apos;annuncio e gli eventuali messaggi che hai scelto di allegare: le altre conversazioni restano cifrate e non possono leggerle. Possono archiviare la segnalazione, rimuovere l&apos;annuncio (resta visibile solo al proprietario) o sospendere l&apos;account (che non può più accedere e sparisce da ricerche e annunci).
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-extrabold text-neutral-900 mb-3">7. Per Quanto Tempo Conserviamo i Dati</h2>
            <ul className="list-disc pl-5 flex flex-col gap-2 mb-4 text-neutral-600">
              <li>Profilo, annunci con le foto, chiavi di cifratura e blocchi: finché non elimini l&apos;account o quei contenuti. Le foto caricate ma mai aggiunte a un annuncio vengono cancellate dopo un giorno.</li>
              <li>Sessioni di accesso: al massimo 30 giorni, o 7 giorni dall&apos;ultimo utilizzo.</li>
              <li>Registro di sicurezza: 90 giorni.</li>
              <li>Segnalazioni: finché sono aperte e poi 180 giorni dalla decisione, insieme ai messaggi allegati. Quelle ricevute da un account eliminato vengono cancellate con l&apos;account; quelle inviate restano ai moderatori, senza il nome di chi le ha inviate.</li>
              <li>Messaggi della chat: finché uno dei partecipanti è iscritto. Se elimini l&apos;account, i messaggi che hai inviato restano, cifrati e senza il tuo nome, nelle conversazioni degli altri partecipanti, come un messaggio già consegnato; una conversazione rimasta senza partecipanti viene cancellata con tutti i messaggi.</li>
              <li>Per un breve periodo i dati cancellati possono restare nelle copie di sicurezza tecniche del database, che servono a ripristinarlo in caso di guasto e vengono sovrascritte automaticamente.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-serif text-xl font-extrabold text-neutral-900 mb-3">8. Diritti dell&apos;Utente</h2>
            <p>
              In conformità con il GDPR hai il diritto di accedere ai tuoi dati, chiederne la rettifica, la portabilità o la cancellazione definitiva (&quot;diritto all&apos;oblio&quot;). Puoi farlo direttamente dal sito: in Impostazioni, &quot;Scarica i miei dati&quot; ti dà un file con tutto ciò che conserviamo su di te (i messaggi li decifra il tuo browser), dal profilo puoi correggere i tuoi dati e in Impostazioni puoi eliminare l&apos;account. Per qualsiasi altra richiesta puoi scrivere al Titolare all&apos;indirizzo indicato sopra.
            </p>
          </section>

        </div>

        <div className="mt-12 pt-8 border-t border-neutral-100 text-center">
          <Link to="/" className="text-orange-500 font-bold hover:text-orange-600 transition-colors inline-block">Torna alla Home Page</Link>
        </div>

      </div>
    </div>
  );
}