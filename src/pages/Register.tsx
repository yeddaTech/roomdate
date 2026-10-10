import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { register } from '../api/auth';
import { ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import type { AuthLocationState } from '../auth/authLocation';
import { prepareRegistration } from '../auth/accountKeys';
import AuthShell from '../components/auth/AuthShell';
import RecoveryCodePanel from '../components/RecoveryCodePanel';
import Alert from '../components/ui/Alert';
import Card from '../components/ui/Card';
import StepIndicator from '../components/ui/StepIndicator';
import { cn, focusRing } from '../components/ui/cn';
import { budgetValue } from '../forms/rules';
import { LAST_STEP, STEPS, emptyRegistration, errorsOfStep, stepOfField, type RegistrationData, type ServerErrors } from './register/model';
import StepAccount from './register/StepAccount';
import StepLifestyle, { type LifestyleValues } from './register/StepLifestyle';
import StepProfile from './register/StepProfile';
import StepRole from './register/StepRole';

// Registrazione a passi: account → chi sei → profilo → stile di vita. Il passo è nell'URL
// (?passo=2), così "Indietro" del browser e del telefono torna al passo precedente; i dati restano
// in memoria (la password non va mai in sessionStorage) e con un ricaricamento si riparte dal primo.

interface Created {
  code: string;
  /** null finché l'accesso automatico è in corso. */
  signedIn: boolean | null;
}

interface StepState extends AuthLocationState {
  /** Passo da cui si è arrivati con "Avanti": "Indietro" torna lì con la cronologia. */
  fromStep?: number;
}

export default function Register() {
  const { status, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = (location.state ?? {}) as StepState;
  const [params, setParams] = useSearchParams();
  // La pagina da riaprire alla fine: si legge una volta, perché i passi cambiano lo stato della cronologia
  const [from] = useState(locationState.from);

  const [data, setData] = useState<RegistrationData>(emptyRegistration);
  const [reached, setReached] = useState(1);
  const [serverErrors, setServerErrors] = useState<ServerErrors>({});
  const [formError, setFormError] = useState<ReactNode>(null);
  const [created, setCreated] = useState<Created | null>(null);

  const requested = Number(params.get('passo')) || 1;
  const step = Math.min(Math.max(requested, 1), reached);
  const stepErrors = useMemo(() => errorsOfStep(serverErrors, step), [serverErrors, step]);

  // Un passo non ancora raggiunto (es. dopo un ricaricamento) riporta all'ultimo raggiungibile
  useEffect(() => {
    if (requested !== step && !created) setParams(step > 1 ? { passo: String(step) } : {}, { replace: true, state: location.state });
  }, [requested, step, created, setParams, location.state]);

  // Cambiando passo il focus va sul titolo del passo; dopo un errore del server resta sul campo
  const heading = useRef<HTMLHeadingElement>(null);
  const shown = useRef<number | string>(step);
  const keepFieldFocus = useRef(false);
  const view = created ? 'chiave' : step;
  useEffect(() => {
    if (shown.current === view) return;
    shown.current = view;
    if (keepFieldFocus.current) keepFieldFocus.current = false;
    else heading.current?.focus();
  }, [view]);

  const update = useCallback((values: Partial<RegistrationData>) => setData((d) => ({ ...d, ...values })), []);

  const goTo = (next: number, { replace = false } = {}) => {
    setReached((r) => Math.max(r, next));
    setParams(next > 1 ? { passo: String(next) } : {}, { replace, state: { from, fromStep: replace ? undefined : step } satisfies StepState });
  };

  const next = (values: Partial<RegistrationData>) => {
    update(values);
    setFormError(null);
    // Gli errori del server su questo passo sono superati: i valori sono cambiati e validi
    setServerErrors((errors) => Object.fromEntries(Object.entries(errors).filter(([field]) => stepOfField(field) !== step)));
    goTo(step + 1);
  };

  const back = () => {
    if (locationState.fromStep === step - 1) navigate(-1);
    else goTo(step - 1, { replace: true });
  };

  const create = async (values: LifestyleValues) => {
    const all = { ...data, ...values };
    setData(all);
    setFormError(null);

    let recoveryCode: string;
    try {
      const prepared = await prepareRegistration(all.password);
      recoveryCode = prepared.recoveryCode;
      await register({
        firstName: all.firstName,
        lastName: all.lastName,
        email: all.email,
        password: prepared.authKey,
        kdf: prepared.kdf,
        keys: prepared.keys,
        recovery: prepared.recovery,
        userType: all.userType || 'cerca',
        city: all.city,
        birthdate: all.birthdate,
        // Chi affitta non indica un budget personale
        budgetMax: all.userType === 'cerca' ? budgetValue(all.budgetMax) : 0,
        occupation: all.occupation,
        bio: all.bio,
        lifestyleTags: all.lifestyleTags,
      });
    } catch (error) {
      if (error instanceof ApiError && error.fields.length > 0) {
        // Il server ha trovato un campo da correggere: si torna al passo che lo contiene
        const errors: ServerErrors = {};
        for (const { field, message } of error.fields) {
          if (stepOfField(field) !== null) errors[field as keyof RegistrationData] ??= message;
        }
        const target = Math.min(...Object.keys(errors).map((field) => stepOfField(field) ?? LAST_STEP));
        if (Number.isFinite(target)) {
          setServerErrors(errors);
          keepFieldFocus.current = target !== step;
          if (target !== step) goTo(target, { replace: true });
          return;
        }
      }
      if (error instanceof ApiError && error.code === 'registration_failed') {
        // Messaggio volutamente generico (di solito l'email è già registrata): non rivela chi è iscritto
        setFormError(
          <Alert tone="danger" title="Non è stato possibile creare l'account">
            Se hai già un account con questa email, <Link to="/accedi" state={{ email: all.email } satisfies AuthLocationState} className={cn('font-bold underline', focusRing)}>accedi</Link> oppure{' '}
            <Link to="/recupero" state={{ email: all.email } satisfies AuthLocationState} className={cn('font-bold underline', focusRing)}>recupera la password</Link>.
            Altrimenti controlla l&apos;email al primo passo.
          </Alert>,
        );
      } else {
        setFormError(
          <Alert tone="danger">
            {error instanceof ApiError ? error.message : 'Non è stato possibile creare le chiavi di sicurezza. Riprova.'}
          </Alert>,
        );
      }
      return;
    }

    // Account creato: si mostra la chiave di recupero (unica occasione per salvarla) e intanto si accede
    setCreated({ code: recoveryCode, signedIn: null });
    try {
      await login(all.email, all.password);
      setCreated((c) => c && { ...c, signedIn: true });
    } catch {
      setCreated((c) => c && { ...c, signedIn: false });
    }
  };

  const finish = () => {
    if (!created?.signedIn) {
      toast.success('Account creato: ora accedi con la tua email e la password.');
      navigate('/accedi', { replace: true, state: { email: data.email, from } satisfies AuthLocationState });
      return;
    }
    toast.success(`Ciao ${data.firstName}, il tuo account è pronto.`);
    navigate(from ?? (data.userType === 'affitta' ? '/annunci' : '/ricerca'), { replace: true });
  };

  // Chi ha già una sessione non ha niente da registrare (tranne chi è appena entrato qui sotto)
  if (status === 'authenticated' && !created) return <Navigate to="/" replace />;

  const stepProps = { data, serverErrors: stepErrors, headingRef: heading, onChange: update };

  return (
    <AuthShell metaTitle="Registrati | RoomDate" tagline={<>Trova la tua stanza, <em className="font-normal">trova casa.</em></>} width="lg">
      <Card className="flex flex-col gap-8">
        {created ? (
          <RecoveryCodePanel
            code={created.code}
            headingLevel="h1"
            headingRef={heading}
            doneLabel={created.signedIn === false ? "Vai all'accesso" : 'Continua'}
            doneLoading={created.signedIn === null}
            onDone={finish}
          />
        ) : (
          <>
            <div className="flex flex-col gap-6">
              <h1 className="font-display text-3xl font-bold text-foreground md:text-4xl">Crea il tuo account</h1>
              <StepIndicator steps={STEPS.map((s) => s.title)} current={step} label="Passi della registrazione" />
            </div>
            {step === 1 && <StepAccount {...stepProps} onNext={next} />}
            {step === 2 && <StepRole {...stepProps} onNext={next} onBack={back} />}
            {step === 3 && data.userType && <StepProfile {...stepProps} role={data.userType} onNext={next} onBack={back} />}
            {step === 4 && <StepLifestyle {...stepProps} onSubmit={create} onBack={back} alert={formError} />}
          </>
        )}
      </Card>
    </AuthShell>
  );
}
