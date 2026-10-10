import ThemeSelect from '../layout/ThemeSelect';
import SettingsSection from './SettingsSection';

/** Tema chiaro, scuro o come il dispositivo: vale per questo browser. */
export default function AppearanceSection() {
  return (
    <SettingsSection id="aspetto" title="Aspetto" description="Vale per questo browser. «Automatico» segue l’impostazione del dispositivo.">
      <ThemeSelect className="max-w-sm" />
    </SettingsSection>
  );
}
