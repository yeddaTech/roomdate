import { useCallback, useEffect, useRef, useState, type ComponentProps, type Ref } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn, focusRing } from './cn';
import { Input } from './Field';

/**
 * Password con il pulsante "Mostra": si può controllare cosa si è scritto invece di doverlo
 * ripetere in un secondo campo (linee guida NIST 800-63B e GOV.UK). All'invio del modulo torna
 * nascosta, così il gestore delle password la riconosce e nessuno la legge dallo schermo.
 */
export default function PasswordInput({ className, ref, ...props }: ComponentProps<'input'>) {
  const [visible, setVisible] = useState(false);
  const input = useRef<HTMLInputElement | null>(null);

  // Il ref arriva anche da react-hook-form: va passato avanti insieme a quello del componente
  const setRef = useCallback((node: HTMLInputElement | null) => {
    input.current = node;
    if (typeof ref === 'function') ref(node);
    else if (ref) (ref as { current: HTMLInputElement | null }).current = node;
  }, [ref]) as Ref<HTMLInputElement>;

  useEffect(() => {
    const form = input.current?.form;
    if (!form) return;
    const hide = () => setVisible(false);
    form.addEventListener('submit', hide);
    return () => form.removeEventListener('submit', hide);
  }, []);

  return (
    <div className="relative">
      <Input
        ref={setRef}
        type={visible ? 'text' : 'password'}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        className={cn('pr-28', className)}
        {...props}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Nascondi la password' : 'Mostra la password'}
        className={cn(
          'absolute inset-y-1 right-1 inline-flex items-center gap-1.5 rounded-[0.625rem] px-3 text-sm font-bold text-foreground-muted hover:bg-surface-muted hover:text-foreground [&_svg]:size-4',
          focusRing, 'focus-visible:ring-offset-0',
        )}
      >
        {visible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
        {visible ? 'Nascondi' : 'Mostra'}
      </button>
      <span className="sr-only" aria-live="polite">{visible ? 'La password è visibile' : ''}</span>
    </div>
  );
}
