import { CircleCheck, Info, TriangleAlert } from 'lucide-react';
import type { ListingSummary, Profile } from '../../api/types';

interface Props {
  listing: Pick<ListingSummary, 'price' | 'city'>;
  me: Profile;
}

/**
 * "Per te": la stanza confrontata con quello che cerchi (budget e città del tuo profilo). Solo fatti
 * verificabili, nessun punteggio; senza budget né città nel profilo non mostra nulla.
 */
export default function ListingFit({ listing, me }: Props) {
  const facts: { tone: 'match' | 'warning' | 'info'; text: string }[] = [];
  if (me.budgetMax > 0) {
    facts.push(listing.price <= me.budgetMax
      ? { tone: 'match', text: `Nel tuo budget: ${listing.price} € su un massimo di ${me.budgetMax} €.` }
      : { tone: 'warning', text: `${listing.price - me.budgetMax} € sopra il tuo budget di ${me.budgetMax} €.` });
  }
  if (me.city) {
    facts.push(listing.city === me.city
      ? { tone: 'match', text: `Nella città che cerchi, ${me.city}.` }
      : { tone: 'info', text: `In un'altra città: nel tuo profilo cerchi a ${me.city}.` });
  }
  if (facts.length === 0) return null;

  return (
    <section aria-labelledby="per-te" className="flex flex-col gap-3" data-testid="listing-fit">
      <h2 id="per-te" className="text-xl font-bold text-foreground">Per te</h2>
      <ul className="flex flex-col gap-2">
        {facts.map(({ tone, text }) => (
          <li key={text} className="flex items-start gap-3 text-foreground [&_svg]:mt-0.5 [&_svg]:size-5 [&_svg]:shrink-0">
            <span aria-hidden="true">
              {tone === 'match' ? <CircleCheck className="text-success-soft-foreground" /> : tone === 'warning' ? <TriangleAlert className="text-warning-soft-foreground" /> : <Info className="text-foreground-subtle" />}
            </span>
            {text}
          </li>
        ))}
      </ul>
    </section>
  );
}
