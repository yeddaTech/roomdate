import { useState } from 'react';
import { Link } from 'react-router-dom';
import PageMeta from '../components/PageMeta';
import { useAuth } from '../auth/AuthContext';
import { useAdminReports, useResolveReport, useRestoreListing, useUnsuspendUser } from '../api/hooks';
import { REPORT_REASONS } from '../api/options';
import type { AdminReport, ModerationAction } from '../api/types';
import { useConfirm } from '../components/ui/confirm';

// Area di moderazione (modulo M3.3): segnalazioni da esaminare e decisioni prese. Le API
// verificano da sé che chi chiama sia un amministratore.

const dateTime = new Intl.DateTimeFormat('it-IT', { dateStyle: 'medium', timeStyle: 'short' });

function reasonLabel(key: string) {
  return REPORT_REASONS.find((r) => r.key === key)?.label ?? key;
}

const STATUS_LABELS: Record<AdminReport['status'], string> = {
  open: 'Da esaminare',
  dismissed: 'Archiviata',
  resolved: 'Provvedimento preso',
};

function ReportCard({ report }: { report: AdminReport }) {
  const [note, setNote] = useState('');
  const resolve = useResolveReport();
  const unsuspend = useUnsuspendUser();
  const restore = useRestoreListing();
  const error = resolve.error ?? unsuspend.error ?? restore.error;
  const { target, listing } = report;

  const confirm = useConfirm();

  const act = async (action: ModerationAction, question?: { title: string; description: string; confirmLabel: string }) => {
    if (question && !(await confirm({ ...question, tone: 'danger' }))) return;
    resolve.mutate({ id: report.id, action, note: note.trim() });
  };

  return (
    <li data-testid="admin-report" className="bg-surface rounded-3xl border border-line shadow-xs p-6 flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-extrabold text-foreground">{reasonLabel(report.reason)}</span>
        <span className="text-xs font-bold text-foreground-subtle">{STATUS_LABELS[report.status]} · {dateTime.format(new Date(report.createdAt))}</span>
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="font-bold text-foreground-subtle">Segnalato</dt>
        <dd className="text-foreground font-medium">
          {target.firstName} {target.lastName}
          {target.suspended && <span className="ml-2 text-[11px] font-bold text-danger bg-danger-soft border border-danger/30 px-2 py-0.5 rounded-full">sospeso</span>}
          {target.openReports > 1 && <span className="ml-2 text-[11px] font-bold text-primary bg-primary-soft border border-primary/30 px-2 py-0.5 rounded-full">{target.openReports} segnalazioni aperte</span>}
        </dd>
        {listing && (
          <>
            <dt className="font-bold text-foreground-subtle">Annuncio</dt>
            <dd className="text-foreground font-medium">
              <Link to={`/dettagli/${listing.id}`} className="underline hover:text-primary">{listing.title || `#${listing.id}`}</Link>
              {listing.removed && <span className="ml-2 text-[11px] font-bold text-danger bg-danger-soft border border-danger/30 px-2 py-0.5 rounded-full">rimosso</span>}
            </dd>
          </>
        )}
        <dt className="font-bold text-foreground-subtle">Da</dt>
        <dd className="text-foreground font-medium">{report.reporter?.firstName ?? 'account eliminato'}</dd>
      </dl>

      {report.details && <p className="text-foreground-muted font-medium whitespace-pre-wrap wrap-break-word">{report.details}</p>}

      {report.evidence.length > 0 && (
        <div className="bg-background border border-line rounded-2xl p-4 flex flex-col gap-2">
          <p className="text-xs font-bold text-foreground-subtle">
            Messaggi ricevuti allegati da chi segnala (decifrati nel suo browser: il testo non è verificabile dal server)
          </p>
          {report.evidence.map((m, i) => (
            <blockquote key={i} className="text-sm text-foreground border-l-4 border-control pl-3 whitespace-pre-wrap wrap-break-word">
              <span className="block text-[11px] font-bold text-foreground-subtle">{dateTime.format(new Date(m.sentAt))}</span>
              {m.text}
            </blockquote>
          ))}
        </div>
      )}

      {report.status === 'open' ? (
        <div className="flex flex-col gap-3">
          <textarea
            name="note"
            rows={2}
            maxLength={500}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Nota sulla decisione (facoltativa, resta nell'archivio)"
            className="w-full bg-surface border border-line rounded-2xl px-4 py-3 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-hidden resize-none"
          />
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={resolve.isPending} onClick={() => act('dismiss')}
              className="bg-surface border border-line text-foreground px-5 py-2.5 rounded-full text-sm font-bold hover:border-control cursor-pointer disabled:opacity-50">
              Archivia
            </button>
            {listing && !listing.removed && (
              <button type="button" disabled={resolve.isPending}
                onClick={() => act('remove_listing', {
                  title: `Rimuovere l'annuncio "${listing.title}"?`,
                  description: 'Lo vedrà solo il proprietario, che potrà soltanto eliminarlo.',
                  confirmLabel: 'Rimuovi annuncio',
                })}
                className="bg-primary text-primary-foreground px-5 py-2.5 rounded-full text-sm font-bold hover:bg-primary-hover cursor-pointer disabled:opacity-50">
                Rimuovi annuncio
              </button>
            )}
            {!target.suspended && !target.isAdmin && (
              <button type="button" disabled={resolve.isPending}
                onClick={() => act('suspend_user', {
                  title: `Sospendere l'account di ${target.firstName}?`,
                  description: 'Verrà disconnesso, non potrà più accedere e sparirà da ricerche e annunci.',
                  confirmLabel: 'Sospendi account',
                })}
                className="bg-danger text-danger-foreground px-5 py-2.5 rounded-full text-sm font-bold hover:bg-danger-hover cursor-pointer disabled:opacity-50">
                Sospendi account
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {report.resolution && <p className="text-sm text-foreground-muted font-medium">Nota: {report.resolution}</p>}
          <div className="flex flex-wrap gap-2">
            {target.suspended && (
              <button type="button" disabled={unsuspend.isPending} onClick={() => unsuspend.mutate(target.id)}
                className="bg-surface border border-line text-foreground px-5 py-2.5 rounded-full text-sm font-bold hover:border-control cursor-pointer disabled:opacity-50">
                Riattiva account
              </button>
            )}
            {listing?.removed && (
              <button type="button" disabled={restore.isPending} onClick={() => restore.mutate(listing.id)}
                className="bg-surface border border-line text-foreground px-5 py-2.5 rounded-full text-sm font-bold hover:border-control cursor-pointer disabled:opacity-50">
                Ripristina annuncio
              </button>
            )}
          </div>
        </div>
      )}
      {error && <p role="alert" className="text-sm font-bold text-danger">{error.message}</p>}
    </li>
  );
}

export default function Moderation() {
  const { user } = useAuth();
  const [status, setStatus] = useState<'open' | 'closed'>('open');
  const reports = useAdminReports(status);
  const items = reports.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <div className="bg-background font-sans">
      <PageMeta title="Moderazione | RoomDate" noindex />
      <div className="max-w-3xl mx-auto px-4 py-10 md:py-16">
        <Link to="/impostazioni" className="text-sm font-bold text-foreground-subtle hover:text-foreground">← Impostazioni</Link>
        <h1 className="text-3xl font-extrabold text-foreground tracking-tight mt-4 mb-2">🛡️ Moderazione</h1>
        <p className="text-foreground-subtle font-medium mb-8">
          Le decisioni si applicano subito: un account sospeso viene disconnesso, un annuncio rimosso sparisce dalle ricerche.
          Le segnalazioni chiuse si cancellano dopo 180 giorni.
        </p>

        {!user?.isAdmin ? (
          <p className="text-foreground-muted font-medium">Quest&apos;area è riservata agli amministratori.</p>
        ) : (
          <>
            <div className="flex gap-2 mb-6" role="tablist">
              {(['open', 'closed'] as const).map((s) => (
                <button key={s} type="button" role="tab" aria-selected={status === s} onClick={() => setStatus(s)}
                  className={`px-5 py-2.5 rounded-full text-sm font-bold cursor-pointer ${status === s ? 'bg-foreground text-background' : 'bg-surface border border-line text-foreground-muted'}`}>
                  {s === 'open' ? 'Da esaminare' : 'Chiuse'}
                </button>
              ))}
            </div>

            {reports.isPending ? (
              <p className="text-foreground-subtle font-medium">Caricamento...</p>
            ) : reports.isError ? (
              <p className="text-danger font-medium">{reports.error.message}</p>
            ) : items.length === 0 ? (
              <p className="text-foreground-subtle font-medium" data-testid="no-reports">
                {status === 'open' ? 'Nessuna segnalazione da esaminare.' : 'Nessuna segnalazione chiusa.'}
              </p>
            ) : (
              <ul className="flex flex-col gap-4">
                {items.map((report) => <ReportCard key={report.id} report={report} />)}
              </ul>
            )}
            {reports.hasNextPage && (
              <button type="button" onClick={() => reports.fetchNextPage()} disabled={reports.isFetchingNextPage}
                className="mt-6 self-center bg-surface border border-line text-foreground-muted px-6 py-3 rounded-full font-bold cursor-pointer">
                {reports.isFetchingNextPage ? 'Caricamento...' : 'Mostra altre'}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
