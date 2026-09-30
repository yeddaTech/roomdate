import { useId } from 'react';
import { RotateCcw } from 'lucide-react';
import { CITIES } from '../../api/options';
import Button from '../ui/Button';
import { cn } from '../ui/cn';
import { Field, Input, Select } from '../ui/Field';

export type Intent = 'stanza' | 'coinquilino';

export interface FilterValues {
  city: string;
  roomType: string;
  bills: string;
}

interface Props {
  intent: Intent;
  values: FilterValues;
  /** Il budget come lo si sta scrivendo: la ricerca parte quando si smette di digitare. */
  budget: string;
  onBudgetChange: (value: string) => void;
  onChange: (changes: Partial<FilterValues>) => void;
  onReset: () => void;
  hasFilters: boolean;
}

interface Choice {
  value: string;
  label: string;
}

/** Scelta tra poche opzioni: pulsanti di opzione nativi con l'aspetto di chip. */
function ChoiceGroup({ legend, name, value, choices, onChange }: { legend: string; name: string; value: string; choices: Choice[]; onChange: (value: string) => void }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-bold text-foreground">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {choices.map((choice) => (
          <label
            key={choice.value || 'tutte'}
            className={cn(
              'inline-flex h-10 cursor-pointer items-center rounded-full border border-control bg-surface px-4 text-sm font-bold text-foreground-muted transition-colors duration-150',
              'hover:border-foreground hover:text-foreground has-checked:border-foreground has-checked:bg-foreground has-checked:text-background',
              'has-focus-visible:ring-2 has-focus-visible:ring-focus has-focus-visible:ring-offset-2 has-focus-visible:ring-offset-background',
            )}
          >
            <input type="radio" name={name} value={choice.value} checked={value === choice.value} onChange={() => onChange(choice.value)} className="sr-only" />
            {choice.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/**
 * Filtri della ricerca. Lo stesso modulo sta nella colonna laterale su desktop e nel pannello dal
 * basso sul telefono; i valori vivono nell'URL, qui si mostrano e si cambiano.
 */
export default function SearchFilters({ intent, values, budget, onBudgetChange, onChange, onReset, hasFilters }: Props) {
  const id = useId();
  return (
    <div className="flex flex-col gap-6">
      <Field label="Città">
        <Select value={values.city} onChange={(e) => onChange({ city: e.target.value })}>
          <option value="">Tutte le città</option>
          {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </Select>
      </Field>
      <Field
        label={intent === 'stanza' ? 'Budget massimo al mese (€)' : 'Budget del coinquilino da (€)'}
        hint={intent === 'stanza' ? 'Solo le stanze fino a questo prezzo.' : 'Chi può spendere almeno questa cifra.'}
      >
        <Input inputMode="numeric" autoComplete="off" placeholder="Es. 600" value={budget} onChange={(e) => onBudgetChange(e.target.value)} />
      </Field>
      {intent === 'stanza' && (
        <>
          <ChoiceGroup
            legend="Tipo di stanza"
            name={`${id}-tipo`}
            value={values.roomType}
            onChange={(roomType) => onChange({ roomType })}
            choices={[{ value: '', label: 'Tutte' }, { value: 'singola', label: 'Singola' }, { value: 'doppia', label: 'Doppia' }]}
          />
          <ChoiceGroup
            legend="Spese"
            name={`${id}-spese`}
            value={values.bills}
            onChange={(bills) => onChange({ bills })}
            choices={[{ value: '', label: 'Indifferente' }, { value: 'true', label: 'Incluse' }, { value: 'false', label: 'Escluse' }]}
          />
        </>
      )}
      {hasFilters && (
        <Button variant="ghost" onClick={onReset} className="self-start">
          <RotateCcw /> Azzera i filtri
        </Button>
      )}
    </div>
  );
}
