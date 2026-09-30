import type { ReactNode, Ref } from 'react';
import { Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ExternalLink } from 'lucide-react';
import LifestyleTagsPicker from '../../components/profile/LifestyleTagsPicker';
import Checkbox from '../../components/ui/Checkbox';
import { cn, focusRing } from '../../components/ui/cn';
import { z } from '../../forms/zod';
import type { RegistrationData, ServerErrors } from './model';
import StepFrame from './StepFrame';
import { useStepForm } from './useStepForm';

const schema = z.object({
  lifestyleTags: z.array(z.string()),
  acceptTerms: z.boolean().check(z.refine(Boolean, "Per creare l'account accetta i Termini di servizio e l'Informativa sulla privacy")),
});
export type LifestyleValues = z.infer<typeof schema>;

interface Props {
  data: RegistrationData;
  serverErrors: ServerErrors;
  headingRef: Ref<HTMLHeadingElement>;
  onChange: (values: Partial<RegistrationData>) => void;
  onSubmit: (values: LifestyleValues) => Promise<void>;
  onBack: () => void;
  /** Errore generale della creazione dell'account. */
  alert?: ReactNode;
}

/** Link ai documenti legali in una nuova scheda: aprirli qui farebbe perdere i dati già scritti. */
function LegalLink({ to, children }: { to: string; children: string }) {
  return (
    <a href={to} target="_blank" rel="noopener" className={cn('rounded-sm font-bold text-primary underline-offset-2 hover:underline', focusRing)}>
      {children}
      <ExternalLink className="ml-0.5 inline size-3.5 align-[-2px]" aria-hidden="true" />
      <span className="sr-only"> (si apre in una nuova scheda)</span>
    </a>
  );
}

export default function StepLifestyle({ data, serverErrors, headingRef, onChange, onSubmit, onBack, alert }: Props) {
  const { control, register, handleSubmit, formState: { errors, isSubmitting } } = useStepForm<LifestyleValues>({
    resolver: zodResolver(schema),
    defaults: { lifestyleTags: data.lifestyleTags, acceptTerms: data.acceptTerms },
    serverErrors,
    onChange,
  });

  return (
    <StepFrame
      title="Il tuo stile di vita"
      description="Facoltativo, ma aiuta a trovare persone con abitudini compatibili con le tue."
      headingRef={headingRef}
      onSubmit={handleSubmit(onSubmit)}
      onBack={onBack}
      submitLabel={isSubmitting ? "Creazione dell'account…" : "Crea l'account"}
      submitting={isSubmitting}
      alert={alert}
    >
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-3 text-sm font-bold text-foreground">Le tue abitudini</legend>
        <Controller
          name="lifestyleTags"
          control={control}
          render={({ field }) => <LifestyleTagsPicker value={field.value} onChange={field.onChange} />}
        />
      </fieldset>
      <Checkbox error={errors.acceptTerms?.message} {...register('acceptTerms')}>
        Ho letto e accetto i <LegalLink to="/termini">Termini di servizio</LegalLink> e l&apos;
        <LegalLink to="/privacy">Informativa sulla privacy</LegalLink>.
      </Checkbox>
    </StepFrame>
  );
}
