import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useLocation } from 'react-router-dom';
import { CircleCheck } from 'lucide-react';
import { ApiError } from '../api/client';
import type { AuthLocationState } from '../auth/authLocation';
import { recoverAccount } from '../auth/accountKeys';
import { passwordProblem } from '../auth/passwordPolicy';
import AuthShell from '../components/auth/AuthShell';
import EmailSuggestion from '../components/auth/EmailSuggestion';
import PasswordStrength from '../components/auth/PasswordStrength';
import Alert from '../components/ui/Alert';
import Button from '../components/ui/Button';
import { buttonClasses } from '../components/ui/buttonClasses';
import Card from '../components/ui/Card';
import { cn, focusRing } from '../components/ui/cn';
import { Field, Input } from '../components/ui/Field';
import PasswordInput from '../components/ui/PasswordInput';
import { suggestEmail } from '../forms/emailSuggestion';
import { email } from '../forms/rules';
import { z } from '../forms/zod';
import { normalizeRecoveryCode } from '../utils/crypto';

const schema = z.object({
  email,
  code: z.string().check(
    z.trim(),
    z.minLength(1, 'Inserisci la chiave di recupero'),
    z.refine((value) => normalizeRecoveryCode(value) !== null, 'La chiave non è valida: sono 24 caratteri, controlla di averla copiata per intero'),
  ),
  password: z.string(),
}).check(z.superRefine(({ password, email: address }, ctx) => {
  const problem = password ? passwordProblem(password, address, '') : 'Scegli la nuova password';
  if (problem) ctx.addIssue({ code: 'custom', path: ['password'], message: problem });
}));
type Values = z.infer<typeof schema>;

/**
 * Password dimenticata: con l'email e la chiave di recupero si imposta una password nuova.
 * I messaggi restano leggibili, perché la chiave privata si apre con il codice nel browser.
 */
export default function RecoverAccount() {
  const location = useLocation();
  const state = (location.state ?? {}) as AuthLocationState;
  const [formError, setFormError] = useState<string | null>(null);
  const [doneEmail, setDoneEmail] = useState<string | null>(null);
  const { register, handleSubmit, setValue, watch, formState: { errors, isSubmitting, touchedFields } } = useForm<Values>({
    resolver: zodResolver(schema),
    mode: 'onTouched',
    defaultValues: { email: state.email ?? '', code: '', password: '' },
  });
  const [address, password] = watch(['email', 'password']);
  const suggestion = touchedFields.email ? suggestEmail(address) : null;

  const onSubmit = async (values: Values) => {
    setFormError(null);
    try {
      await recoverAccount(values.email, values.code, values.password);
      setDoneEmail(values.email);
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : 'Recupero non riuscito. Riprova tra poco.');
    }
  };

  return (
    <AuthShell metaTitle="Recupera l'accesso | RoomDate" tagline={<>Nuova password, <em className="font-normal">stessi messaggi.</em></>}>
      <Card className="flex flex-col gap-6">
        {doneEmail ? (
          <div className="flex flex-col gap-5" data-testid="recovery-done">
            <CircleCheck className="size-12 text-success-soft-foreground" aria-hidden="true" />
            <h1 className="font-display text-3xl font-bold text-foreground">Password aggiornata</h1>
            <p className="leading-relaxed text-foreground-muted">
              Ora puoi accedere con la nuova password: i tuoi messaggi sono ancora tutti leggibili.
              Per sicurezza abbiamo chiuso l&apos;accesso su tutti i dispositivi. Se pensi che qualcun
              altro abbia visto la tua chiave di recupero, creane una nuova nelle Impostazioni.
            </p>
            <Link to="/accedi" state={{ email: doneEmail } satisfies AuthLocationState} className={buttonClasses({ size: 'lg', className: 'w-full' })}>
              Vai all&apos;accesso
            </Link>
          </div>
        ) : (
          <>
            <div>
              <h1 className="font-display text-3xl font-bold text-foreground md:text-4xl">Password dimenticata?</h1>
              <p className="mt-2 leading-relaxed text-foreground-muted">
                Inserisci la tua email e la chiave di recupero che hai salvato alla registrazione. Senza
                chiave non si può reimpostare la password: i messaggi sono cifrati sul tuo dispositivo e
                nemmeno noi possiamo aprirli.
              </p>
            </div>

            {formError && <Alert tone="danger">{formError}</Alert>}

            <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
              <Field
                label="Email"
                error={errors.email?.message}
                hint={suggestion && <EmailSuggestion suggestion={suggestion} onAccept={(value) => setValue('email', value, { shouldValidate: true })} />}
              >
                <Input type="email" inputMode="email" autoComplete="username" autoCapitalize="none" spellCheck={false} {...register('email')} />
              </Field>
              <Field label="Chiave di recupero" error={errors.code?.message} hint="24 caratteri, con o senza trattini: le maiuscole non contano.">
                <Input
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  placeholder="XXXX-XXXX-XXXX-…"
                  // Sul telefono i 29 caratteri stanno in riga solo senza spaziatura extra
                  className="font-mono text-sm uppercase sm:text-base sm:tracking-wider"
                  {...register('code')}
                />
              </Field>
              <Field
                label="Nuova password"
                error={errors.password?.message}
                hint={!errors.password && <PasswordStrength password={password} email={address} />}
              >
                <PasswordInput autoComplete="new-password" {...register('password')} />
              </Field>
              <Button type="submit" size="lg" loading={isSubmitting} className="mt-1 w-full">
                {isSubmitting ? 'Verifica in corso…' : 'Imposta la nuova password'}
              </Button>
            </form>

            <p className="text-sm leading-relaxed text-foreground-muted">
              Hai perso anche la chiave? Senza chiave e senza password nessuno può aprire i tuoi messaggi,
              nemmeno noi. Puoi chiedere la cancellazione dell&apos;account al contatto indicato
              nell&apos;<Link to="/privacy" className={cn('rounded-sm font-bold text-primary hover:text-primary-hover', focusRing)}>Informativa sulla privacy</Link>{' '}
              e poi registrarti di nuovo con la stessa email.
            </p>
          </>
        )}
      </Card>
    </AuthShell>
  );
}
