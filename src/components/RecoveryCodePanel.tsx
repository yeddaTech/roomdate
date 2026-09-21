import { useState } from 'react';

interface Props {
  code: string;
  /** Testo del pulsante finale, attivo solo dopo la conferma di aver salvato il codice. */
  doneLabel: string;
  onDone: () => void;
}

/**
 * Mostra la chiave di recupero una sola volta: il server non la conosce e non può rimostrarla.
 * Per proseguire bisogna confermare di averla salvata.
 */
export default function RecoveryCodePanel({ code, doneLabel, onDone }: Props) {
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

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
    <div className="flex flex-col gap-5" data-testid="recovery-panel">
      <div>
        <h2 className="text-2xl font-extrabold text-neutral-900 tracking-tight mb-2">🔑 La tua chiave di recupero</h2>
        <p className="text-neutral-600 font-medium leading-relaxed">
          Se dimentichi la password, questa chiave è l&apos;unico modo per rientrare senza perdere i messaggi:
          nemmeno noi possiamo recuperarli, perché sono cifrati sul tuo dispositivo. Salvala adesso,
          ad esempio in un gestore di password o stampata: non la vedrai più.
        </p>
      </div>

      <div
        data-testid="recovery-code"
        className="font-mono text-xl md:text-2xl font-bold tracking-wider text-center text-neutral-900 bg-orange-50 border border-orange-200 rounded-2xl px-4 py-5 select-all break-all"
      >
        {code}
      </div>

      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={copy} className="bg-white border border-neutral-200 hover:border-neutral-400 text-neutral-800 px-5 py-2.5 rounded-full font-bold text-sm transition-colors cursor-pointer">
          {copied ? '✅ Copiata' : '📋 Copia'}
        </button>
        <button type="button" onClick={download} className="bg-white border border-neutral-200 hover:border-neutral-400 text-neutral-800 px-5 py-2.5 rounded-full font-bold text-sm transition-colors cursor-pointer">
          ⬇️ Scarica come file
        </button>
      </div>

      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          name="recoverySaved"
          checked={saved}
          onChange={(e) => setSaved(e.target.checked)}
          className="mt-0.5 w-5 h-5 accent-orange-500 cursor-pointer"
        />
        <span className="text-sm text-neutral-700 font-medium">Ho salvato la chiave di recupero in un posto sicuro.</span>
      </label>

      <button
        type="button"
        onClick={onDone}
        disabled={!saved}
        className="w-full bg-neutral-900 text-white py-4 rounded-full font-bold transition-colors hover:bg-neutral-800 disabled:bg-neutral-300 disabled:cursor-not-allowed cursor-pointer"
      >
        {doneLabel}
      </button>
    </div>
  );
}
