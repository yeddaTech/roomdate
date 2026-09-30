import type { Ref } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { passwordProblem } from '../../auth/passwordPolicy';
import EmailSuggestion from '../../components/auth/EmailSuggestion';
import PasswordStrength from '../../components/auth/PasswordStrength';
import { Field, Input } from '../../components/ui/Field';
import PasswordInput from '../../components/ui/PasswordInput';
import { suggestEmail } from '../../forms/emailSuggestion';
import { email, personName } from '../../forms/rules';
import { z } from '../../forms/zod';
import type { RegistrationData, ServerErrors } from './model';
import StepFrame from './StepFrame';
import { useStepForm } from './useStepForm';

const schema = z.object({
  firstName: personName('Il nome'),
  lastName: personName('Il cognome'),
  email,
  password: z.string(),
}).check(z.superRefine(({ password, email: address, firstName }, ctx) => {
  // La password non arriva al server (ne riceve solo una chiave ricavata): le regole si controllano qui
  const problem = password ? passwordProblem(password, address, firstName) : 'Scegli una password';
  if (problem) ctx.addIssue({ code: 'custom', path: ['password'], message: problem });
}));
type Values = z.infer<typeof schema>;

interface Props {
  data: RegistrationData;
  serverErrors: ServerErrors;
  headingRef: Ref<HTMLHeadingElement>;
  onChange: (values: Partial<RegistrationData>) => void;
  onNext: (values: Values) => void;
}

export default function StepAccount({ data, serverErrors, headingRef, onChange, onNext }: Props) {
  const { register, handleSubmit, watch, setValue, formState: { errors, touchedFields } } = useStepForm<Values>({
    resolver: zodResolver(schema),
    defaults: { firstName: data.firstName, lastName: data.lastName, email: data.email, password: data.password },
    serverErrors,
    onChange,
  });
  const [address, password, firstName] = watch(['email', 'password', 'firstName']);
  const suggestion = touchedFields.email ? suggestEmail(address) : null;

  return (
    <StepFrame
      title="Il tuo account"
      description="Gli altri vedono solo il tuo nome: cognome ed email restano privati."
      headingRef={headingRef}
      onSubmit={handleSubmit(onNext)}
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Nome" error={errors.firstName?.message}>
          <Input autoComplete="given-name" {...register('firstName')} />
        </Field>
        <Field label="Cognome" error={errors.lastName?.message}>
          <Input autoComplete="family-name" {...register('lastName')} />
        </Field>
      </div>
      <Field
        label="Email"
        error={errors.email?.message}
        hint={suggestion && <EmailSuggestion suggestion={suggestion} onAccept={(value) => setValue('email', value, { shouldValidate: true })} />}
      >
        <Input type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false} {...register('email')} />
      </Field>
      <Field
        label="Password"
        error={errors.password?.message}
        // Con l'errore in vista l'indicatore ripeterebbe la stessa cosa
        hint={!errors.password && <PasswordStrength password={password} email={address} firstName={firstName} />}
      >
        <PasswordInput autoComplete="new-password" {...register('password')} />
      </Field>
    </StepFrame>
  );
}
