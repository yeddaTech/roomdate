import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '../auth/AuthContext';
import { useAdminReports, useResolveReport, useRestoreListing, useUnsuspendUser } from '../api/hooks';
import { REPORT_REASONS } from '../api/options';
import type { AdminReport, ModerationAction } from '../api/types';

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

  const act = (action: ModerationAction, question?: string) => {
    if (question && !confirm(question)) return;
    resolve.mutate({ id: report.id, action, note: note.trim() });
  };

  return (
    <li data-testid="admin-report" className="bg-white rounded-3xl border border-neutral-100 shadow-sm p-6 flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-extrabold text-neutral-900">{reasonLabel(report.reason)}</span>
        <span className="text-xs font-bold text-neutral-500">{STATUS_LABELS[report.status]} · {dateTime.format(new Date(report.createdAt))}</span>
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="font-bold text-neutral-500">Segnalato</dt>
        <dd className="text-neutral-900 font-medium">
          {target.firstName} {target.lastName}
          {target.suspended && <span className="ml-2 text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">sospeso</span>}
          {target.openReports > 1 && <span className="ml-2 text-[11px] font-bold text-orange-700 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-full">{target.openReports} segnalazioni aperte</span>}
        </dd>
        {listing && (
          <>
            <dt className="font-bold text-neutral-500">Annuncio</dt>
            <dd className="text-neutral-900 font-medium">
              <Link to={`/dettagli/${listing.id}`} className="underline hover:text-orange-600">{listing.title || `#${listing.id}`}</Link>
              {listing.removed && <span className="ml-2 text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">rimosso</span>}
            </dd>
          </>
        )}
        <dt className="font-bold text-neutral-500">Da</dt>
        <dd className="text-neutral-900 font-medium">{report.reporter?.firstName ?? 'account eliminato'}</dd>
      </dl>

      {report.details && <p className="text-neutral-700 font-medium whitespace-pre-wrap break-words">{report.details}</p>}

      {report.evidence.length > 0 && (
        <div className="bg-neutral-50 border border-neutral-100 rounded-2xl p-4 flex flex-col gap-2">
          <p className="text-xs font-bold text-neutral-500">
            Messaggi ricevuti allegati da chi segnala (decifrati nel suo browser: il testo non è verificabile dal server)
          </p>
          {report.evidence.map((m, i) => (
            <blockquote key={i} className="text-sm text-neutral-800 border-l-4 border-neutral-300 pl-3 whitespace-pre-wrap break-words">
              <span className="block text-[11px] font-bold text-neutral-400">{dateTime.format(new Date(m.sentAt))}</span>
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
            className="w-full bg-white border border-neutral-200 rounded-2xl px-4 py-3 text-sm focus:border-orange-400 focus:ring-2 focus:ring-orange-100 focus:outline-none resize-none"
          />
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={resolve.isPending} onClick={() => act('dismiss')}
              className="bg-white border border-neutral-200 text-neutral-800 px-5 py-2.5 rounded-full text-sm font-bold hover:border-neutral-400 cursor-pointer disabled:opacity-50">
              Archivia
            </button>
            {listing && !listing.removed && (
              <button type="button" disabled={resolve.isPending}
                onClick={() => act('remove_listing', `Rimuovere l'annuncio "${listing.title}"? Lo vedrà solo il proprietario, che potrà solo eliminarlo.`)}
                className="bg-orange-600 text-white px-5 py-2.5 rounded-full text-sm font-bold hover:bg-orange-700 cursor-pointer disabled:opacity-50">
                Rimuovi annuncio
              </button>
            )}
            {!target.suspended && !target.isAdmin && (
              <button type="button" disabled={resolve.isPending}
                onClick={() => act('suspend_user', `Sospendere l'account di ${target.firstName}? Verrà disconnesso, non potrà più accedere e sparirà da ricerche e annunci.`)}
                className="bg-rose-600 text-white px-5 py-2.5 rounded-full text-sm font-bold hover:bg-rose-700 cursor-pointer disabled:opacity-50">
                Sospendi account
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {report.resolution && <p className="text-sm text-neutral-600 font-medium">Nota: {report.resolution}</p>}
          <div className="flex flex-wrap gap-2">
            {target.suspended && (
              <button type="button" disabled={unsuspend.isPending} onClick={() => unsuspend.mutate(target.id)}
                className="bg-white border border-neutral-200 text-neutral-800 px-5 py-2.5 rounded-full text-sm font-bold hover:border-neutral-400 cursor-pointer disabled:opacity-50">
                Riattiva account
              </button>
            )}
            {listing?.removed && (
              <button type="button" disabled={restore.isPending} onClick={() => restore.mutate(listing.id)}
                className="bg-white border border-neutral-200 text-neutral-800 px-5 py-2.5 rounded-full text-sm font-bold hover:border-neutral-400 cursor-pointer disabled:opacity-50">
                Ripristina annuncio
              </button>
            )}
          </div>
        </div>
      )}
      {error && <p role="alert" className="text-sm font-bold text-rose-600">{error.message}</p>}
    </li>
  );
}

export default function Moderation() {
  const { user } = useAuth();
  const [status, setStatus] = useState<'open' | 'closed'>('open');
  const reports = useAdminReports(status);
  const items = reports.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <div className="min-h-[100dvh] bg-[#FAFAFA] font-sans">
      <Helmet>
        <title>Moderazione | RoomDate</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <div className="max-w-3xl mx-auto px-4 py-10 md:py-16">
        <Link to="/impostazioni" className="text-sm font-bold text-neutral-500 hover:text-neutral-900">← Impostazioni</Link>
        <h1 className="text-3xl font-extrabold text-neutral-900 tracking-tight mt-4 mb-2">🛡️ Moderazione</h1>
        <p className="text-neutral-500 font-medium mb-8">
          Le decisioni si applicano subito: un account sospeso viene disconnesso, un annuncio rimosso sparisce dalle ricerche.
          Le segnalazioni chiuse si cancellano dopo 180 giorni.
        </p>

        {!user?.isAdmin ? (
          <p className="text-neutral-600 font-medium">Quest&apos;area è riservata agli amministratori.</p>
        ) : (
          <>
            <div className="flex gap-2 mb-6" role="tablist">
              {(['open', 'closed'] as const).map((s) => (
                <button key={s} type="button" role="tab" aria-selected={status === s} onClick={() => setStatus(s)}
                  className={`px-5 py-2.5 rounded-full text-sm font-bold cursor-pointer ${status === s ? 'bg-neutral-900 text-white' : 'bg-white border border-neutral-200 text-neutral-700'}`}>
                  {s === 'open' ? 'Da esaminare' : 'Chiuse'}
                </button>
              ))}
            </div>

            {reports.isPending ? (
              <p className="text-neutral-400 font-medium">Caricamento...</p>
            ) : reports.isError ? (
              <p className="text-rose-600 font-medium">{reports.error.message}</p>
            ) : items.length === 0 ? (
              <p className="text-neutral-500 font-medium" data-testid="no-reports">
                {status === 'open' ? 'Nessuna segnalazione da esaminare.' : 'Nessuna segnalazione chiusa.'}
              </p>
            ) : (
              <ul className="flex flex-col gap-4">
                {items.map((report) => <ReportCard key={report.id} report={report} />)}
              </ul>
            )}
            {reports.hasNextPage && (
              <button type="button" onClick={() => reports.fetchNextPage()} disabled={reports.isFetchingNextPage}
                className="mt-6 self-center bg-white border border-neutral-200 text-neutral-700 px-6 py-3 rounded-full font-bold cursor-pointer">
                {reports.isFetchingNextPage ? 'Caricamento...' : 'Mostra altre'}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
