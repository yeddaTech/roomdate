import { LIFESTYLE_TAGS, toggleLifestyleTag } from '../../api/options';

interface Props {
  value: string[];
  onChange: (tags: string[]) => void;
}

/** Scelta delle abitudini: "Fumatore" e "Non fumatore" si escludono a vicenda. */
export default function LifestyleTagsPicker({ value, onChange }: Props) {
  return (
    <div className="flex flex-wrap gap-3">
      {LIFESTYLE_TAGS.map((tag) => (
        <label key={tag.key} className="relative cursor-pointer group">
          <input
            type="checkbox"
            name="lifestyleTags"
            value={tag.key}
            checked={value.includes(tag.key)}
            onChange={() => onChange(toggleLifestyleTag(value, tag.key))}
            className="peer sr-only"
          />
          <span className="block px-5 py-2.5 bg-white border border-neutral-200 rounded-full text-sm font-semibold text-neutral-500 peer-checked:bg-neutral-900 peer-checked:text-white peer-checked:border-neutral-900 peer-focus-visible:ring-2 peer-focus-visible:ring-orange-300 transition-all shadow-xs group-hover:border-neutral-300">
            {tag.emoji} {tag.label}
          </span>
        </label>
      ))}
    </div>
  );
}
