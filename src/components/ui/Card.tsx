import type { ComponentProps } from 'react';
import { cn } from './cn';

/** Contenitore con sfondo, bordo leggero e ombra: l'unità di base delle pagine. */
export default function Card({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('rounded-card border border-line bg-surface p-6 shadow-card md:p-8', className)} {...props} />;
}
