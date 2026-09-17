import { lifestyleTag } from '../../api/options';

interface Props {
  tags: string[];
  /** Numero massimo di abitudini mostrate (tutte se assente). */
  limit?: number;
  className?: string;
}

/** Abitudini di un profilo con emoji ed etichetta. Le chiavi sconosciute non vengono mostrate. */
export default function LifestyleTags({ tags, limit, className = '' }: Props) {
  const known = tags.map(lifestyleTag).filter((t) => t !== undefined);
  return (
    <>
      {known.slice(0, limit).map((tag) => (
        <span key={tag.key} className={className}>
          {tag.emoji} {tag.label}
        </span>
      ))}
    </>
  );
}
