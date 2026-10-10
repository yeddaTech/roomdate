import { amenityLabel } from '../../api/options';
import { amenityIcon } from './amenityIcons';

/** I servizi della stanza, con un'icona ciascuno. */
export default function AmenityList({ amenities }: { amenities: string[] }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {amenities.map((key) => (
        <li key={key} className="flex items-center gap-3 text-foreground">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-muted text-foreground-muted [&_svg]:size-5" aria-hidden="true">
            {amenityIcon(key)}
          </span>
          {amenityLabel(key)}
        </li>
      ))}
    </ul>
  );
}
