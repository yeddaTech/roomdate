import { LIFESTYLE_TAGS, toggleLifestyleTag } from '../../api/options';
import { cn } from '../ui/cn';

interface Props {
  value: string[];
  onChange: (tags: string[]) => void;
}

/**
 * Scelta delle abitudini: caselle di spunta native con l'aspetto di chip, quindi Tab e Spazio
 * funzionano da sé. "Fumatore" e "Non fumatore" si escludono a vicenda.
 */
export default function LifestyleTagsPicker({ value, onChange }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {LIFESTYLE_TAGS.map((tag) => (
        <label
          key={tag.key}
          className={cn(
            'inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-full border border-control bg-surface px-4 text-sm font-bold text-foreground-muted transition-colors duration-150',
            'hover:border-foreground hover:text-foreground',
            'has-checked:border-foreground has-checked:bg-foreground has-checked:text-background',
            'has-focus-visible:ring-2 has-focus-visible:ring-focus has-focus-visible:ring-offset-2 has-focus-visible:ring-offset-background',
          )}
        >
          <input
            type="checkbox"
            name="lifestyleTags"
            value={tag.key}
            checked={value.includes(tag.key)}
            onChange={() => onChange(toggleLifestyleTag(value, tag.key))}
            className="sr-only"
          />
          <span aria-hidden="true">{tag.emoji}</span>
          {tag.label}
        </label>
      ))}
    </div>
  );
}
