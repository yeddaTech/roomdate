import type { Ref } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { CITIES, OCCUPATIONS } from '../../api/options';
import { latestAdultBirthdate } from '../../api/users';
import { Field, Input, Select, Textarea } from '../../components/ui/Field';
import { MAX_BIO_LENGTH, bio, birthdate, budget, city, occupation } from '../../forms/rules';
import { z } from '../../forms/zod';
import type { RegistrationData, Role, ServerErrors } from './model';
import StepFrame from './StepFrame';
import { useStepForm } from './useStepForm';

const schema = z.object({ city, birthdate, budgetMax: budget, occupation, bio });
type Values = z.infer<typeof schema>;

interface Props {
  data: RegistrationData;
  role: Role;
  serverErrors: ServerErrors;
  headingRef: Ref<HTMLHeadingElement>;
  onChange: (values: Partial<RegistrationData>) => void;
  onNext: (values: Values) => void;
  onBack: () => void;
}

export default function StepProfile({ data, role, serverErrors, headingRef, onChange, onNext, onBack }: Props) {
  const { register, handleSubmit, watch, formState: { errors } } = useStepForm<Values>({
    resolver: zodResolver(schema),
    defaults: { city: data.city, birthdate: data.birthdate, budgetMax: data.budgetMax, occupation: data.occupation, bio: data.bio },
    serverErrors,
    onChange,
  });
  const bioLength = watch('bio').length;

  return (
    <StepFrame
      title="Il tuo profilo"
      description={role === 'cerca'
        ? 'Aiuta chi affitta e i futuri coinquilini a capire chi sei.'
        : 'Chi cerca casa vede il tuo profilo accanto ai tuoi annunci.'}
      headingRef={headingRef}
      onSubmit={handleSubmit(onNext)}
      onBack={onBack}
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Città" error={errors.city?.message}>
          <Select {...register('city')}>
            <option value="">Scegli…</option>
            {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
        </Field>
        <Field label="Data di nascita" error={errors.birthdate?.message} hint="Si vede solo l'età. Bisogna avere almeno 18 anni.">
          <Input type="date" autoComplete="bday" min="1900-01-01" max={latestAdultBirthdate()} {...register('birthdate')} />
        </Field>
      </div>
      {role === 'cerca' && (
        <Field label="Budget massimo al mese (€)" error={errors.budgetMax?.message} hint="Facoltativo. Serve a mostrarti le stanze adatte.">
          <Input inputMode="numeric" autoComplete="off" placeholder="Es. 500" {...register('budgetMax')} />
        </Field>
      )}
      <Field label="Occupazione" error={errors.occupation?.message}>
        <Select {...register('occupation')}>
          <option value="">Preferisco non indicarla</option>
          {OCCUPATIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
        </Select>
      </Field>
      <Field
        label="Presentazione"
        error={errors.bio?.message}
        hint={`Facoltativa: due righe su di te, i tuoi orari, cosa cerchi. ${bioLength}/${MAX_BIO_LENGTH}`}
      >
        <Textarea rows={4} {...register('bio')} />
      </Field>
    </StepFrame>
  );
}
