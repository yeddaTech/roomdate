import { useState } from 'react';
import { toast } from 'sonner';
import { Download } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { buildDataExport } from '../../auth/exportData';
import Button from '../ui/Button';
import SettingsSection from './SettingsSection';

/** Copia di tutti i propri dati (GDPR): i messaggi li decifra il browser, sul server sono cifrati. */
export default function DataSection() {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);

  const download = async () => {
    if (!user) return;
    setBusy(true);
    try {
      const url = URL.createObjectURL(await buildDataExport(user.id));
      const link = document.createElement('a');
      link.href = url;
      link.download = `roomdate-dati-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Esportazione non riuscita. Riprova.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SettingsSection
      id="dati"
      title="I tuoi dati"
      description="Scarica in un file tutto quello che RoomDate conserva su di te: profilo, annunci, preferiti, conversazioni, dispositivi, blocchi e segnalazioni. I messaggi li decifra il tuo browser: sul server sono solo in forma cifrata."
    >
      <Button variant="secondary" onClick={download} loading={busy} className="self-start"><Download aria-hidden="true" /> Scarica i miei dati</Button>
    </SettingsSection>
  );
}
