import { useLocation } from 'react-router-dom';
import { SITE_URL } from '../site';

interface Props {
  /** Titolo della scheda del browser, es. "Ricerca | RoomDate". */
  title: string;
  /** Descrizione per i motori di ricerca (le pagine indicizzabili dovrebbero averla). */
  description?: string;
  /** Pagine private, di servizio o con dati delle persone: i motori di ricerca non le indicizzano. */
  noindex?: boolean;
  /**
   * Indirizzo canonico, con i soli parametri che cambiano davvero la pagina (es. la città della
   * ricerca); se manca, quello della pagina senza parametri.
   */
  canonical?: string;
}

/**
 * Titolo e meta della pagina. React 19 sposta da solo questi elementi nell'<head>, anche se la
 * pagina li disegna in mezzo al contenuto: non serve più react-helmet-async. L'anteprima dei link
 * (Open Graph) invece sta in index.html e, per gli annunci, la fa il server: i programmi dei social
 * non eseguono JavaScript.
 */
export default function PageMeta({ title, description, noindex = false, canonical }: Props) {
  const { pathname } = useLocation();
  return (
    <>
      <title>{title}</title>
      {description && <meta name="description" content={description} />}
      {noindex
        ? <meta name="robots" content="noindex, nofollow" />
        : <link rel="canonical" href={`${SITE_URL}${canonical ?? pathname}`} />}
    </>
  );
}
