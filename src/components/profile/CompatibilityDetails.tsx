import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { CircleCheck, Info, TriangleAlert } from 'lucide-react';
import { lifestyleTag } from '../../api/options';
import type { Compatibility, Profile, PublicProfile } from '../../api/types';
import { cn, focusRing } from '../ui/cn';

interface Props {
  compatibility: Compatibility;
  /** Il profilo che si guarda. */
  other: PublicProfile;
  /** Il proprio profilo, per i confronti con i numeri; può non essere ancora caricato. */
  me?: Profile;
}

type Tone = 'match' | 'warning' | 'info';

function Reason({ tone, children }: { tone: Tone; children: ReactNode }) {
  const icon = tone === 'match' ? <CircleCheck className="text-success-soft-foreground" /> : tone === 'warning' ? <TriangleAlert className="text-warning-soft-foreground" /> : <Info className="text-foreground-subtle" />;
  return (
    <li className="flex items-start gap-3 text-foreground [&_svg]:mt-0.5 [&_svg]:size-5 [&_svg]:shrink-0">
      <span aria-hidden="true">{icon}</span>
      <span>{children}</span>
    </li>
  );
}

/**
 * Cosa avete in comune, spiegato voce per voce. Il server confronta solo città, budget (simili se
 * differiscono al massimo di 100 €) e abitudini indicate da entrambi: non c'è un punteggio.
 */
export default function CompatibilityDetails({ compatibility: c, other, me }: Props) {
  const name = other.firstName || 'questa persona';
  const tags = c.sharedTags.map(lifestyleTag).filter((t) => t !== undefined);
  const missing = me ? [!me.city && 'la città', me.budgetMax <= 0 && 'il budget', me.lifestyleTags.length === 0 && 'le abitudini'].filter(Boolean) : [];

  return (
    <section aria-labelledby="in-comune" data-testid="compatibility" className="flex flex-col gap-4">
      <h2 id="in-comune" className="text-xl font-bold text-foreground">Cosa avete in comune</h2>
      <ul className="flex flex-col gap-3">
        {c.sameCity && <Reason tone="match">Cercate entrambi a <strong>{other.city}</strong>.</Reason>}
        {!c.sameCity && me?.city && other.city && (
          <Reason tone="info">Città diverse: tu cerchi a {me.city}, {name} a {other.city}.</Reason>
        )}
        {c.similarBudget && (
          <Reason tone="match">
            Budget simili{me && me.budgetMax > 0 ? <>: il tuo è {me.budgetMax} €, il suo {other.budgetMax} €</> : ''} (al massimo 100 € di differenza).
          </Reason>
        )}
        {!c.similarBudget && me && me.budgetMax > 0 && other.budgetMax > 0 && (
          <Reason tone="info">Budget diversi: il tuo è {me.budgetMax} €, il suo {other.budgetMax} €.</Reason>
        )}
        {tags.length > 0 && (
          <Reason tone="match">
            {tags.length === 1 ? 'Un’abitudine in comune: ' : 'Abitudini in comune: '}
            {tags.map((t) => `${t.emoji} ${t.label}`).join(', ')}.
          </Reason>
        )}
        {c.smokingMismatch && (
          <Reason tone="warning">Uno di voi fuma e l&apos;altro no: meglio parlarne prima di decidere.</Reason>
        )}
        {!c.sameCity && !c.similarBudget && tags.length === 0 && !c.smokingMismatch && (
          <Reason tone="info">Per ora nessun elemento in comune tra quelli che avete indicato.</Reason>
        )}
      </ul>
      {missing.length > 0 && (
        <p className="text-sm text-foreground-muted">
          Nel tuo profilo mancano {missing.join(', ').replace(/, ([^,]*)$/, ' e $1')}: aggiungili nel{' '}
          <Link to="/dashboard" className={cn('rounded-sm font-bold text-primary hover:text-primary-hover', focusRing)}>tuo profilo</Link>{' '}
          per un confronto più completo.
        </p>
      )}
      <p className="rounded-control bg-surface-muted p-4 text-sm leading-relaxed text-foreground-muted">
        <strong className="text-foreground">Come lo calcoliamo.</strong> Nessun punteggio né algoritmo nascosto: confrontiamo
        solo la città, il budget (simile se la differenza è al massimo 100 €) e le abitudini che avete indicato entrambi.
      </p>
    </section>
  );
}
