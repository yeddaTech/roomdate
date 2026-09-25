import { useState, type FormEvent } from 'react';
import { useSendReport } from '../api/hooks';
import { REPORT_REASONS } from '../api/options';
import type { ReportEvidence, ReportReason } from '../api/types';
import Button from './ui/Button';
import { Dialog, DialogClose, DialogContent, DialogFooter } from './ui/Dialog';
import { Field, Select, Textarea } from './ui/Field';

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
  const [reason, setReason] = useState<ReportReason | ''>('');
  const [details, setDetails] = useState('');
  const [attach, setAttach] = useState(false);
  const report = useSendReport();
  const evidence = conversation ? evidenceFrom(conversation.received) : [];

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
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      {report.isSuccess ? (
        <DialogContent data-testid="report-dialog" title="Segnalazione inviata"
          description="Grazie. Un moderatore la esaminerà e, se viola i Termini, prenderà provvedimenti. Se non vuoi più sentire questa persona puoi anche bloccarla.">
          <DialogFooter>
            <DialogClose asChild><Button>Chiudi</Button></DialogClose>
          </DialogFooter>
        </DialogContent>
      ) : (
        <DialogContent data-testid="report-dialog" title={title}>
          <form onSubmit={submit} className="flex flex-col gap-4">
            <Field label="Motivo">
              <Select name="reason" required value={reason} onChange={(e) => setReason(e.target.value as ReportReason)}>
                <option value="">Scegli un motivo…</option>
                {REPORT_REASONS.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
              </Select>
            </Field>
            <Field label={<>Cosa è successo? <span className="font-medium text-foreground-muted">(facoltativo)</span></>}>
              <Textarea name="details" rows={3} maxLength={1000} value={details} onChange={(e) => setDetails(e.target.value)} />
            </Field>
            {evidence.length > 0 && (
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  name="attachMessages"
                  checked={attach}
                  onChange={(e) => setAttach(e.target.checked)}
                  className="mt-0.5 size-5 cursor-pointer accent-primary"
                />
                <span className="text-sm font-medium text-foreground">
                  {evidence.length === 1 ? "Allega l'ultimo messaggio ricevuto." : `Allega gli ultimi ${evidence.length} messaggi ricevuti.`}{' '}
                  I messaggi sono cifrati: senza allegarli il moderatore non può leggerli.
                </span>
              </label>
            )}
            {report.error && <p role="alert" className="text-sm font-bold text-danger">{report.error.message}</p>}
            <DialogFooter>
              <DialogClose asChild><Button variant="secondary">Annulla</Button></DialogClose>
              <Button type="submit" variant="danger" disabled={!reason} loading={report.isPending}>Invia segnalazione</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      )}
    </Dialog>
  );
}
