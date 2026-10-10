import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { changePassword } from '../../api/auth';
import { preparePasswordChange } from '../../auth/accountKeys';
import { useAuth } from '../../auth/AuthContext';
import { passwordProblem } from '../../auth/passwordPolicy';
import { z } from '../../forms/zod';
import PasswordStrength from '../auth/PasswordStrength';
import Button from '../ui/Button';
import { Field } from '../ui/Field';
import PasswordInput from '../ui/PasswordInput';
import SettingsSection from './SettingsSection';

const schema = z.object({
  currentPassword: z.string().check(z.minLength(1, 'Scrivi la password attuale')),
  newPassword: z.string(),
});
type Values = z.infer<typeof schema>;

/**
 * Cambio password. La password non arriva mai al server: il browser ricava le chiavi d'accesso e
 * cifra di nuovo la chiave dei messaggi con la password nuova, così restano leggibili.
 */
export default function PasswordSection() {
  const { user } = useAuth();
  const email = user?.email ?? '';
  const firstName = user?.firstName ?? '';
  const { register, handleSubmit, watch, reset, setError, formState: { errors, isSubmitting } } = useForm<Values>({
    resolver: zodResolver(schema.check(z.superRefine(({ newPassword }, ctx) => {
      const problem = newPassword ? passwordProblem(newPassword, email, firstName) : 'Scegli la nuova password';
      if (problem) ctx.addIssue({ code: 'custom', path: ['newPassword'], message: problem });
    }))),
    mode: 'onTouched',
    defaultValues: { currentPassword: '', newPassword: '' },
  });
  const newPassword = watch('newPassword');

  const save = async ({ currentPassword, newPassword: next }: Values) => {
    try {
      const prepared = await preparePasswordChange(email, currentPassword, next);
      if (!prepared.ok) {
        setError('currentPassword', { type: 'server', message: 'Password attuale errata.' });
        return;
      }
      await changePassword({
        currentPassword: prepared.currentPassword,
        newPassword: prepared.newPassword,
        kdf: prepared.kdf,
        keys: prepared.keys,
      });
      prepared.commit();
      reset();
      toast.success('Password cambiata. Sugli altri dispositivi dovrai accedere di nuovo.');
    } catch (err) {
      setError('currentPassword', { type: 'server', message: err instanceof Error ? err.message : 'Cambio non riuscito. Riprova.' });
    }
  };

  return (
    <SettingsSection
      id="password"
      title="Password"
      description="Serve anche ad aprire i tuoi messaggi cifrati: cambiandola restano leggibili. L’email dell’account non si può cambiare."
    >
      <form noValidate onSubmit={handleSubmit(save)} className="flex max-w-md flex-col gap-5">
        {/* Per il gestore delle password: sa di quale account si tratta */}
        <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
        <Field label="Password attuale" error={errors.currentPassword?.message}>
          <PasswordInput autoComplete="current-password" {...register('currentPassword')} />
        </Field>
        <Field
          label="Nuova password"
          error={errors.newPassword?.message}
          hint={<PasswordStrength password={newPassword} email={email} firstName={firstName} />}
        >
          <PasswordInput autoComplete="new-password" {...register('newPassword')} />
        </Field>
        <Button type="submit" loading={isSubmitting} className="self-start">Cambia password</Button>
      </form>
    </SettingsSection>
  );
}
