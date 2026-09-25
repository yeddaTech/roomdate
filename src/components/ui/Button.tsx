import type { ComponentProps } from 'react';
import { buttonClasses, type ButtonSize, type ButtonVariant } from './buttonClasses';
import Spinner from './Spinner';

interface ButtonProps extends ComponentProps<'button'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Mostra lo spinner e disattiva il pulsante finché l'operazione non finisce. */
  loading?: boolean;
}

export default function Button({ variant, size, loading = false, className, children, disabled, type = 'button', ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClasses({ variant, size, className })}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
}
