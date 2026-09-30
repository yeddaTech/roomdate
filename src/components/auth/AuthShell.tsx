import type { ReactNode } from 'react';
import { BadgeEuro, LockKeyhole, MessagesSquare } from 'lucide-react';
import PageMeta from '../PageMeta';
import { cn } from '../ui/cn';

interface Props {
  /** Titolo della scheda del browser. */
  metaTitle: string;
  /** Frase del pannello di marchio, visibile su schermi larghi. */
  tagline: ReactNode;
  /** Larghezza del modulo: "md" per accesso e recupero, "lg" per la registrazione. */
  width?: 'md' | 'lg';
  children: ReactNode;
}

const promises = [
  { icon: <LockKeyhole />, text: 'Messaggi cifrati end-to-end: nemmeno noi possiamo leggerli' },
  { icon: <MessagesSquare />, text: 'Contatto diretto con chi affitta o cerca casa' },
  { icon: <BadgeEuro />, text: 'Gratis, senza commissioni' },
];

/**
 * Impaginazione comune di accesso, registrazione e recupero: il modulo al centro e, sugli schermi
 * larghi, un pannello di marchio con le tre promesse del sito (tutte vere).
 */
export default function AuthShell({ metaTitle, tagline, width = 'md', children }: Props) {
  return (
    <div className="flex flex-1">
      <PageMeta title={metaTitle} noindex />
      <aside className="relative hidden w-5/12 max-w-xl overflow-hidden bg-brand-deep p-12 text-white lg:flex lg:flex-col lg:justify-center xl:p-16">
        <p className="font-display text-4xl leading-tight font-bold xl:text-5xl">{tagline}</p>
        <ul className="mt-10 flex flex-col gap-4">
          {promises.map(({ icon, text }) => (
            <li key={text} className="flex items-center gap-3 font-medium text-white [&_svg]:size-5 [&_svg]:shrink-0">
              {icon}
              {text}
            </li>
          ))}
        </ul>
      </aside>
      <div className="flex flex-1 justify-center px-4 py-8 sm:px-6 md:py-12 lg:items-center">
        <div className={cn('w-full', width === 'lg' ? 'max-w-xl' : 'max-w-md')}>{children}</div>
      </div>
    </div>
  );
}
