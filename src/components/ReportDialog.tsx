import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { useSendReport } from '../api/hooks';
import { REPORT_REASONS } from '../api/options';
import type { ReportEvidence, ReportReason } from '../api/types';

// Limiti del server: 20 messaggi allegati, ciascuno di al massimo 1000 caratteri
const MAX_EVIDENCE = 20;
const MAX_EVIDENCE_LENGTH = 1000;

interface Props {
  /** Chi o cosa si segnala: un utente o un annuncio. */
  target: { userId: string } | { listingId: number };
  /** Titolo del riquadro, es. "Segnala Marco". */
  title: string;
  /**
   * Dalla chat: la conversazione e i messaggi ricevuti dall'utente segnalato, già decifrati.
   * Chi segnala può allegarli: il server da solo non li può leggere.
   */
  conversation?: { id: number; received: ReportEvidence[] };
  onClose: () => void;
}

/** Riduce i messaggi ricevuti a ciò che il server accetta: gli ultimi 20, tagliati a 1000 caratteri. */
function evidenceFrom(received: ReportEvidence[]): ReportEvidence[] {
  return received
    .filter((m) => m.text.trim() !== '')
    .slice(-MAX_EVIDENCE)
    .map((m) => ({
      sentAt: m.sentAt,
      text: m.text.length > MAX_EVIDENCE_LENGTH ? `${m.text.slice(0, MAX_EVIDENCE_LENGTH - 1)}…` : m.text,
    }));
}

export default function ReportDialog({ target, title, conversation, onClose }: Props) {
  const titleId = useId();
  const [reason, setReason] = useState<ReportReason | ''>('');
  const [details, setDetails] = useState('');
  const [attach, setAttach] = useState(false);
  const report = useSendReport();
  const firstField = useRef<HTMLSelectElement>(null);
  const evidence = conversation ? evidenceFrom(conversation.received) : [];

  useEffect(() => {
    firstField.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!reason) return;
    report.mutate({
      ...target,
      reason,
      details: details.trim(),
      ...(conversation && attach && evidence.length > 0 ? { conversationId: conversation.id, evidence } : {}),
    });
  };

  return (
    <div className="fixed inset-0 z-[2000] bg-neutral-900/40 flex items-center justify-center p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-testid="report-dialog"
        className="bg-white rounded-3xl shadow-xl w-full max-w-md p-6 md:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        {report.isSuccess ? (
          <div className="flex flex-col gap-4">
            <h2 id={titleId} className="text-xl font-extrabold text-neutral-900">Segnalazione inviata</h2>
            <p className="text-neutral-600 font-medium">
              Grazie. Un moderatore la esaminerà e, se viola i Termini, prenderà provvedimenti. Se non vuoi più sentire
              questa persona puoi anche bloccarla.
            </p>
            <button type="button" onClick={onClose} className="w-full bg-neutral-900 text-white py-3 rounded-full font-bold hover:bg-neutral-800 cursor-pointer">
              Chiudi
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-4">
            <h2 id={titleId} className="text-xl font-extrabold text-neutral-900">{title}</h2>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-bold text-neutral-700">Motivo</span>
              <select
                ref={firstField}
                name="reason"
                required
                value={reason}
                onChange={(e) => setReason(e.target.value as ReportReason)}
                className="w-full bg-white border border-neutral-200 rounded-2xl px-4 py-3 focus:border-orange-400 focus:ring-2 focus:ring-orange-100 focus:outline-none cursor-pointer"
              >
                <option value="">Scegli un motivo…</option>
                {REPORT_REASONS.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-bold text-neutral-700">Cosa è successo? <span className="font-medium text-neutral-500">(facoltativo)</span></span>
              <textarea
                name="details"
                rows={3}
                maxLength={1000}
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                className="w-full bg-white border border-neutral-200 rounded-2xl px-4 py-3 focus:border-orange-400 focus:ring-2 focus:ring-orange-100 focus:outline-none resize-none"
              />
            </label>
            {evidence.length > 0 && (
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  name="attachMessages"
                  checked={attach}
                  onChange={(e) => setAttach(e.target.checked)}
                  className="mt-0.5 w-5 h-5 accent-orange-500 cursor-pointer"
                />
                <span className="text-sm text-neutral-700 font-medium">
                  {evidence.length === 1 ? "Allega l'ultimo messaggio ricevuto." : `Allega gli ultimi ${evidence.length} messaggi ricevuti.`}{' '}
                  I messaggi sono cifrati: senza allegarli il moderatore non può leggerli.
                </span>
              </label>
            )}
            {report.error && <p role="alert" className="text-sm font-bold text-rose-600">{report.error.message}</p>}
            <div className="flex gap-3">
              <button type="button" onClick={onClose} className="flex-1 bg-white border border-neutral-200 text-neutral-800 py-3 rounded-full font-bold hover:border-neutral-400 cursor-pointer">
                Annulla
              </button>
              <button
                type="submit"
                disabled={!reason || report.isPending}
                className="flex-1 bg-rose-600 text-white py-3 rounded-full font-bold hover:bg-rose-700 disabled:bg-neutral-300 disabled:cursor-not-allowed cursor-pointer"
              >
                {report.isPending ? 'Invio…' : 'Invia segnalazione'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
