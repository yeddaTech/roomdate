import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import type { AuthLocationState } from '../auth/authLocation';
import AuthShell from '../components/auth/AuthShell';
import EmailSuggestion from '../components/auth/EmailSuggestion';
import Alert from '../components/ui/Alert';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { cn, focusRing } from '../components/ui/cn';
import { Field, Input } from '../components/ui/Field';
import PasswordInput from '../components/ui/PasswordInput';
import { suggestEmail } from '../forms/emailSuggestion';
import { loginEmail } from '../forms/rules';
import { z } from '../forms/zod';

const schema = z.object({
  email: loginEmail,
  // Nessun minimo di lunghezza: gli account creati prima delle regole attuali hanno password più corte
  password: z.string().check(z.minLength(1, 'Inserisci la password')),
});
type Values = z.infer<typeof schema>;

export default function Login() {
  const { status, login } = useAuth();
  const location = useLocation();
  const state = (location.state ?? {}) as AuthLocationState;
  const [formError, setFormError] = useState<string | null>(null);
  const { register, handleSubmit, setValue, watch, formState: { errors, isSubmitting, touchedFields } } = useForm<Values>({
    resolver: zodResolver(schema),
    mode: 'onTouched',
    defaultValues: { email: state.email ?? '', password: '' },
  });
  const email = watch('email');
  const suggestion = touchedFields.email ? suggestEmail(email) : null;

  // Chi ha già una sessione (anche appena aperta qui sotto) va dove voleva andare
  if (status === 'authenticated') return <Navigate to={state.from ?? '/'} replace />;

  const onSubmit = async (values: Values) => {
    setFormError(null);
    try {
      const { keysUnlocked } = await login(values.email, values.password);
      if (!keysUnlocked) {
        toast.warning('Accesso effettuato, ma la chiave dei messaggi non si è aperta: potresti non riuscire a leggerli.');
      }
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : 'Accesso non riuscito. Riprova tra poco.');
    }
  };

  return (
    <AuthShell metaTitle="Accedi | RoomDate" tagline={<>Riprendi da <em className="font-normal">dove avevi lasciato.</em></>}>
      <Card className="flex flex-col gap-6">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground md:text-4xl">Accedi</h1>
          <p className="mt-2 text-foreground-muted">I tuoi annunci e i tuoi messaggi ti aspettano.</p>
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
          <div className="flex flex-col gap-2">
            <Field label="Password" error={errors.password?.message}>
              <PasswordInput autoComplete="current-password" {...register('password')} />
            </Field>
            <Link
              to="/recupero"
              state={{ email: email.trim() } satisfies AuthLocationState}
              className={cn('self-end rounded-sm text-sm font-bold text-primary hover:text-primary-hover', focusRing)}
            >
              Password dimenticata?
            </Link>
          </div>
          <Button type="submit" size="lg" loading={isSubmitting} className="mt-1 w-full">
            {isSubmitting ? 'Accesso in corso…' : 'Accedi'}
          </Button>
        </form>

        <p className="text-center text-sm text-foreground-muted">
          Non hai ancora un account?{' '}
          <Link to="/registrati" state={{ from: state.from } satisfies AuthLocationState} className={cn('rounded-sm font-bold text-primary hover:text-primary-hover', focusRing)}>
            Registrati gratis
          </Link>
        </p>
      </Card>
    </AuthShell>
  );
}
