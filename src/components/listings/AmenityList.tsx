import type { ReactNode } from 'react';
import { AirVent, ArrowUpDown, Bath, Check, Fence, Heater, PawPrint, Sofa, UtensilsCrossed, WashingMachine, Wifi } from 'lucide-react';
import { amenityLabel } from '../../api/options';

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

/** I servizi della stanza, con un'icona ciascuno. */
export default function AmenityList({ amenities }: { amenities: string[] }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {amenities.map((key) => (
        <li key={key} className="flex items-center gap-3 text-foreground">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-muted text-foreground-muted [&_svg]:size-5" aria-hidden="true">
            {icons[key] ?? <Check />}
          </span>
          {amenityLabel(key)}
        </li>
      ))}
    </ul>
  );
}
