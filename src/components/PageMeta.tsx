interface Props {
  /** Titolo della scheda del browser, es. "Ricerca | RoomDate". */
  title: string;
  /** Descrizione per i motori di ricerca; se manca resta quella di index.html. */
  description?: string;
  /** Pagine private o di servizio: i motori di ricerca non le indicizzano. */
  noindex?: boolean;
}

/**
 * Titolo e meta della pagina. React 19 sposta da solo questi elementi nell'<head>, anche se la
 * pagina li disegna in mezzo al contenuto: non serve più react-helmet-async.
 */
export default function PageMeta({ title, description, noindex = false }: Props) {
  return (
    <>
      <title>{title}</title>
      {description && <meta name="description" content={description} />}
      {noindex && <meta name="robots" content="noindex, nofollow" />}
    </>
  );
}
