import { useState } from 'react';
import { cn } from './cn';

type AvatarSize = 'sm' | 'md' | 'lg' | 'xl';

const sizes: Record<AvatarSize, string> = {
  sm: 'size-8 text-sm',
  md: 'size-11 text-base',
  lg: 'size-16 text-2xl',
  xl: 'size-24 text-4xl',
};

interface AvatarProps {
  /** Nome della persona: l'iniziale sostituisce la foto e il nome ne è la descrizione. */
  name: string;
  src?: string | null;
  size?: AvatarSize;
  className?: string;
}

export default function Avatar({ name, src, size = 'md', className }: AvatarProps) {
  const [failed, setFailed] = useState(false);
  const initial = (name.trim().charAt(0) || '?').toUpperCase();
  return (
    <span
      className={cn('inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand font-bold text-white', sizes[size], className)}
      role="img"
      aria-label={name || 'Utente'}
    >
      {src && !failed ? (
        <img src={src} alt="" className="size-full object-cover" onError={() => setFailed(true)} />
      ) : (
        <span aria-hidden="true">{initial}</span>
      )}
    </span>
  );
}
