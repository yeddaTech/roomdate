import { cn, focusRing } from '../ui/cn';

/** "Forse intendevi …?" sotto il campo email: un clic corregge l'indirizzo. Va dentro un <p>. */
export default function EmailSuggestion({ suggestion, onAccept }: { suggestion: string; onAccept: (email: string) => void }) {
  return (
    <span>
      Forse intendevi{' '}
      <button
        type="button"
        onClick={() => onAccept(suggestion)}
        className={cn('rounded-sm font-bold text-primary underline underline-offset-2 hover:text-primary-hover', focusRing)}
      >
        {suggestion}
      </button>
      ?
    </span>
  );
}
