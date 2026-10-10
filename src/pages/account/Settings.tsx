import { Link } from 'react-router-dom';
import { ChevronRight, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import PageMeta from '../../components/PageMeta';
import AppearanceSection from '../../components/settings/AppearanceSection';
import DataSection from '../../components/settings/DataSection';
import DeleteAccountSection from '../../components/settings/DeleteAccountSection';
import NotificationsSection from '../../components/settings/NotificationsSection';
import PasswordSection from '../../components/settings/PasswordSection';
import PrivacySection from '../../components/settings/PrivacySection';
import RecoverySection from '../../components/settings/RecoverySection';
import SessionsSection from '../../components/settings/SessionsSection';
import { cn, focusRing } from '../../components/ui/cn';

/** Impostazioni dell'account (modulo M2.7): accesso e sicurezza, avvisi, privacy, dati. */
export default function Settings() {
  const { user } = useAuth();
  return (
    <div className="flex flex-col gap-6">
      <PageMeta title="Impostazioni | RoomDate" noindex />
      <div>
        <h1 className="font-display text-3xl font-bold text-foreground md:text-4xl">Impostazioni</h1>
        <p className="mt-2 text-foreground-muted">Account {user?.email}</p>
      </div>

      {user?.isAdmin && (
        <Link
          to="/moderazione"
          data-testid="moderation-link"
          className={cn('flex items-center gap-3 rounded-card border border-line bg-surface p-5 font-bold text-foreground shadow-card hover:bg-surface-muted [&_svg]:size-5', focusRing)}
        >
          <ShieldCheck aria-hidden="true" className="text-primary" />
          <span className="flex-1">Area moderazione: segnalazioni da esaminare</span>
          <ChevronRight aria-hidden="true" />
        </Link>
      )}

      <PasswordSection />
      <RecoverySection />
      <SessionsSection />
      <NotificationsSection />
      <PrivacySection />
      <AppearanceSection />
      <DataSection />
      <DeleteAccountSection />
    </div>
  );
}
