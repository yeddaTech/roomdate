import type { ComponentProps } from 'react';
import { cn } from './cn';

/** Segnaposto grigio che pulsa mentre il contenuto si carica. */
export default function Skeleton({ className, ...props }: ComponentProps<'div'>) {
  return <div aria-hidden="true" className={cn('animate-pulse rounded-control bg-surface-muted', className)} {...props} />;
}
