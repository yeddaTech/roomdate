import { useEffect } from 'react';
import { useForm, type DefaultValues, type FieldValues, type Path, type Resolver } from 'react-hook-form';
import type { ServerErrors } from './model';

interface Options<T extends FieldValues> {
  resolver: Resolver<T>;
  defaults: DefaultValues<T>;
  /** Errori dei campi di questo passo arrivati dal server. */
  serverErrors: ServerErrors;
  /** Riceve i valori a ogni modifica: tornando indietro (anche con il browser) non si perdono. */
  onChange: (values: Partial<T>) => void;
}

/**
 * Modulo di un passo. L'errore compare quando si lascia il campo e da lì si aggiorna mentre si
 * corregge ("onTouched"); dopo un "Avanti" non riuscito tutti i campi si aggiornano mentre si scrive.
 */
export function useStepForm<T extends FieldValues>({ resolver, defaults, serverErrors, onChange }: Options<T>) {
  const form = useForm<T>({ resolver, mode: 'onTouched', defaultValues: defaults });
  const { watch, setError, setFocus, clearErrors, getFieldState } = form;

  useEffect(() => {
    const subscription = watch((values, { name }) => {
      onChange(values as Partial<T>);
      // Un errore del server sparisce appena si modifica il campo. Se restasse fino all'uscita dal
      // campo, sparirebbe proprio al clic su "Avanti": il pulsante salirebbe e il clic andrebbe a vuoto
      if (name && getFieldState(name).error?.type === 'server') clearErrors(name);
    });
    return () => subscription.unsubscribe();
  }, [watch, onChange, getFieldState, clearErrors]);

  useEffect(() => {
    const entries = Object.entries(serverErrors) as [Path<T>, string][];
    for (const [field, message] of entries) setError(field, { type: 'server', message });
    if (entries.length > 0) setFocus(entries[0][0]);
  }, [serverErrors, setError, setFocus]);

  return form;
}
