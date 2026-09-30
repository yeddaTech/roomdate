import type { ReactNode, Ref } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import Button from '../../components/ui/Button';

interface Props {
  title: string;
  description?: ReactNode;
  /** Il titolo riceve il focus quando si cambia passo, così i lettori di schermo lo annunciano. */
  headingRef: Ref<HTMLHeadingElement>;
  onSubmit: () => void;
  /** Assente nel primo passo. */
  onBack?: () => void;
  submitLabel?: string;
  submitting?: boolean;
  /** Messaggio d'errore generale, sopra i campi. */
  alert?: ReactNode;
  children: ReactNode;
}

/** Un passo della registrazione: titolo, campi e i pulsanti "Indietro" e "Avanti". */
export default function StepFrame({ title, description, headingRef, onSubmit, onBack, submitLabel = 'Avanti', submitting = false, alert, children }: Props) {
  return (
    <form noValidate onSubmit={(e) => { e.preventDefault(); onSubmit(); }} className="flex flex-col gap-6">
      <div>
        <h2 ref={headingRef} tabIndex={-1} className="font-display text-2xl font-bold text-foreground outline-none md:text-3xl">{title}</h2>
        {description && <p className="mt-2 text-foreground-muted">{description}</p>}
      </div>
      {alert}
      <div className="flex flex-col gap-5">{children}</div>
      <div className="mt-2 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        {onBack ? (
          <Button variant="ghost" size="lg" onClick={onBack} disabled={submitting}><ArrowLeft /> Indietro</Button>
        ) : <span className="hidden sm:block" />}
        <Button type="submit" size="lg" loading={submitting} className="sm:min-w-40">
          {submitLabel}{!submitting && submitLabel === 'Avanti' && <ArrowRight />}
        </Button>
      </div>
    </form>
  );
}
