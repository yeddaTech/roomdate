import type { ReactNode } from 'react';
import { AirVent, ArrowUpDown, Bath, Check, Fence, Heater, PawPrint, Sofa, UtensilsCrossed, WashingMachine, Wifi } from 'lucide-react';

// Un'icona per ogni servizio di shared/options.json; uno nuovo senza icona mostra il segno di spunta
const icons: Record<string, ReactNode> = {
  wifi: <Wifi />,
  arredata: <Sofa />,
  lavatrice: <WashingMachine />,
  lavastoviglie: <UtensilsCrossed />,
  aria_condizionata: <AirVent />,
  riscaldamento: <Heater />,
  balcone: <Fence />,
  ascensore: <ArrowUpDown />,
  bagno_privato: <Bath />,
  animali_ammessi: <PawPrint />,
};

/** L'icona del servizio: nella pagina dell'annuncio e nella scelta dei servizi. */
export function amenityIcon(key: string): ReactNode {
  return icons[key] ?? <Check />;
}
