import { useState, type Ref } from 'react';
import { Check, Copy, Download, KeyRound } from 'lucide-react';
import Button from './ui/Button';
import Checkbox from './ui/Checkbox';

interface Props {
  code: string;
  /** Testo del pulsante finale, attivo solo dopo la conferma di aver salvato il codice. */
  doneLabel: string;
  onDone: () => void;
  /** Il pulsante finale aspetta un'operazione in corso (es. l'accesso subito dopo la registrazione). */
  doneLoading?: boolean;
  /** h1 quando il pannello è tutta la pagina, h2 dentro un'altra pagina. */
  headingLevel?: 'h1' | 'h2';
  headingRef?: Ref<HTMLHeadingElement>;
}

/**
 * Mostra la chiave di recupero una sola volta: il server non la conosce e non può rimostrarla.
 * Per proseguire bisogna confermare di averla salvata.
 */
export default function RecoveryCodePanel({ code, doneLabel, onDone, doneLoading = false, headingLevel = 'h2', headingRef }: Props) {
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const Heading = headingLevel;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      // Appunti non disponibili: il codice resta selezionabile a mano
    }
  };

  const download = () => {
    const text = [
      'Chiave di recupero RoomDate',
      '',
      code,
      '',
      'Serve se dimentichi la password: con questa chiave e la tua email imposti una password nuova',
      'senza perdere i messaggi. Conservala in un posto sicuro e non condividerla con nessuno.',
    ].join('\n');
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'roomdate-chiave-di-recupero.txt';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-6" data-testid="recovery-panel">
      <div className="flex flex-col gap-3">
        <span className="flex size-12 items-center justify-center rounded-full bg-primary-soft text-primary-soft-foreground" aria-hidden="true">
          <KeyRound className="size-6" />
        </span>
        <Heading ref={headingRef} tabIndex={-1} className="font-display text-2xl font-bold text-foreground outline-none md:text-3xl">
          Salva la tua chiave di recupero
        </Heading>
        <p className="leading-relaxed text-foreground-muted">
          Se dimentichi la password, questa chiave è l&apos;unico modo per rientrare senza perdere i messaggi:
          nemmeno noi possiamo recuperarli, perché sono cifrati sul tuo dispositivo. Salvala adesso, per
          esempio in un gestore di password o su carta: non la vedrai più.
        </p>
      </div>

      <p
        data-testid="recovery-code"
        className="select-all break-all rounded-control border border-line bg-surface-muted px-4 py-5 text-center font-mono text-xl font-bold tracking-wider text-foreground md:text-2xl"
      >
        {code}
      </p>

      <div className="flex flex-wrap gap-3">
        <Button variant="secondary" onClick={copy}>
          {copied ? <Check /> : <Copy />} {copied ? 'Copiata' : 'Copia'}
        </Button>
        <Button variant="secondary" onClick={download}><Download /> Scarica come file</Button>
        <span className="sr-only" aria-live="polite">{copied ? 'Chiave copiata negli appunti' : ''}</span>
      </div>

      <Checkbox name="recoverySaved" checked={saved} onChange={(e) => setSaved(e.target.checked)}>
        Ho salvato la chiave di recupero in un posto sicuro.
      </Checkbox>

      <Button size="lg" onClick={onDone} disabled={!saved} loading={doneLoading} className="w-full">
        {doneLabel}
      </Button>
    </div>
  );
}
