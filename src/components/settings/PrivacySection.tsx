import { useState } from 'react';
import { toast } from 'sonner';
import { useBlocks, useMyProfile, useUnblockUser, useUpdateMyProfile } from '../../api/hooks';
import type { BlockedUser } from '../../api/types';
import Alert from '../ui/Alert';
import Button from '../ui/Button';
import Checkbox from '../ui/Checkbox';
import Skeleton from '../ui/Skeleton';
import SettingsSection from './SettingsSection';
import { whenLabel } from './when';

/** Chi può vedere il profilo, e le persone bloccate. */
export default function PrivacySection() {
  const profile = useMyProfile();
  const update = useUpdateMyProfile();
  const blocks = useBlocks();
  const unblock = useUnblockUser();
  // La casella cambia subito; se il salvataggio non riesce torna com'era
  const [pending, setPending] = useState<boolean | null>(null);

  const setPublic = async (isPublic: boolean) => {
    const current = profile.data;
    // Niente "disabled" mentre salva: la casella perderebbe il focus
    if (!current || update.isPending) return;
    setPending(isPublic);
    try {
      await update.mutateAsync({
        userType: current.userType,
        city: current.city,
        birthdate: current.birthdate,
        budgetMax: current.budgetMax,
        occupation: current.occupation,
        bio: current.bio,
        lifestyleTags: current.lifestyleTags,
        isPublic,
      });
      toast.success(isPublic ? 'Il tuo profilo ora è pubblico.' : 'Il tuo profilo ora è privato.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Salvataggio non riuscito. Riprova.');
    } finally {
      setPending(null);
    }
  };

  const unblockUser = async (blocked: BlockedUser) => {
    try {
      await unblock.mutateAsync(blocked.userId);
      toast.success(`${blocked.firstName} è stato sbloccato.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Operazione non riuscita.');
    }
  };

  return (
    <SettingsSection id="privacy" title="Privacy">
      <div className="flex flex-col gap-2">
        {profile.data ? (
          <Checkbox
            checked={pending ?? profile.data.isPublic}
            onChange={(e) => setPublic(e.target.checked)}
            data-testid="profile-public"
          >
            <span className="font-bold">Profilo pubblico</span>
            <span className="block text-foreground-muted">
              Compare tra i coinquilini e chiunque può aprirlo. Da privato non lo vede nessuno e nessuno può iniziare una chat con
              te; le conversazioni già avviate continuano, e i tuoi annunci restano visibili.
            </span>
          </Checkbox>
        ) : profile.isError ? <Alert tone="danger">{profile.error.message}</Alert> : <Skeleton className="h-16" />}
      </div>

      <div className="flex flex-col gap-3 border-t border-line pt-5">
        <h3 className="font-bold text-foreground">Persone bloccate</h3>
        <p className="text-sm text-foreground-muted">Con chi hai bloccato non potete scrivervi né trovarvi nelle ricerche. Sbloccando torna tutto come prima.</p>
        {blocks.isPending ? (
          <Skeleton className="h-14" />
        ) : blocks.isError ? (
          <Alert tone="danger">{blocks.error.message}</Alert>
        ) : blocks.data.length === 0 ? (
          <p className="text-sm text-foreground-muted" data-testid="no-blocks">Non hai bloccato nessuno.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {blocks.data.map((blocked) => (
              <li key={blocked.userId} data-testid="blocked-user" className="flex flex-wrap items-center justify-between gap-3 rounded-control border border-line px-4 py-3">
                <div>
                  <p className="font-bold text-foreground">{blocked.firstName}</p>
                  <p className="text-sm text-foreground-muted">Bloccato {whenLabel(blocked.createdAt)}</p>
                </div>
                <Button variant="secondary" size="sm" onClick={() => unblockUser(blocked)} disabled={unblock.isPending}>Sblocca</Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </SettingsSection>
  );
}
