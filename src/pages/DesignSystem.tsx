import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Heart, Inbox, MessageCircle, Search, Trash2 } from 'lucide-react';
import PageMeta from '../components/PageMeta';
import Avatar from '../components/ui/Avatar';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Chip from '../components/ui/Chip';
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogTrigger } from '../components/ui/Dialog';
import EmptyState from '../components/ui/EmptyState';
import { Field, Input, Select, Textarea } from '../components/ui/Field';
import { Sheet, SheetContent, SheetTrigger } from '../components/ui/Sheet';
import Skeleton from '../components/ui/Skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/Tabs';
import { useConfirm } from '../components/ui/confirm';

// Vetrina del design system (solo in sviluppo, /design-system): ogni componente in tema chiaro
// e scuro, per controllarne aspetto, stati e contrasti.

function Showcase() {
  const confirm = useConfirm();
  const [tags, setTags] = useState(['non_fumatore']);
  const toggle = (key: string) => setTags((t) => (t.includes(key) ? t.filter((k) => k !== key) : [...t, key]));

  return (
    <div className="flex flex-col gap-8">
      <Card className="flex flex-col gap-4">
        <h2 className="font-display text-2xl font-bold">Pulsanti</h2>
        <div className="flex flex-wrap gap-3">
          <Button>Primario</Button>
          <Button variant="secondary">Secondario</Button>
          <Button variant="ghost">Discreto</Button>
          <Button variant="danger"><Trash2 /> Elimina</Button>
          <Button variant="brand">Cerca stanza</Button>
          <Button loading>Salvataggio</Button>
          <Button disabled>Disattivato</Button>
          <Button size="icon" variant="secondary" aria-label="Preferito"><Heart /></Button>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button size="sm">Piccolo</Button>
          <Button size="lg">Grande</Button>
        </div>
      </Card>

      <Card className="flex flex-col gap-4">
        <h2 className="font-display text-2xl font-bold">Campi</h2>
        <Field label="Email" hint="Non la mostriamo a nessuno.">
          <Input type="email" placeholder="nome@esempio.it" />
        </Field>
        <Field label="Città" error="Scegli la città dall'elenco">
          <Select defaultValue="">
            <option value="">Seleziona…</option>
            <option>Milano</option>
          </Select>
        </Field>
        <Field label="Presentazione">
          <Textarea placeholder="Due righe su di te" />
        </Field>
        <div className="flex flex-wrap gap-2">
          {['non_fumatore', 'animali', 'ordinato'].map((key) => (
            <Chip key={key} selected={tags.includes(key)} onClick={() => toggle(key)}>{key.replace('_', ' ')}</Chip>
          ))}
        </div>
      </Card>

      <Card className="flex flex-col gap-4">
        <h2 className="font-display text-2xl font-bold">Stati</h2>
        <div className="flex flex-wrap items-center gap-2">
          <Badge>Bozza</Badge>
          <Badge tone="primary">Nuovo</Badge>
          <Badge tone="success">Pubblicato</Badge>
          <Badge tone="warning">In attesa</Badge>
          <Badge tone="danger">Sospeso</Badge>
        </div>
        <div className="flex items-center gap-3">
          <Avatar name="Giulia" size="sm" />
          <Avatar name="Marco" />
          <Avatar name="Sara" size="lg" />
          <Avatar name="Luca" size="xl" />
        </div>
        <div className="flex flex-col gap-2">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-32 w-full rounded-card" />
        </div>
        <EmptyState
          icon={<Inbox />}
          title="Nessuna conversazione"
          description="Quando contatti qualcuno da un annuncio o da un profilo, la chat compare qui."
          action={<Button variant="secondary"><Search /> Cerca una stanza</Button>}
        />
        <p className="text-foreground">Testo principale · <span className="text-foreground-muted">secondario</span> · <span className="text-foreground-subtle">tenue</span></p>
      </Card>

      <Card className="flex flex-col gap-4">
        <h2 className="font-display text-2xl font-bold">Finestre e notifiche</h2>
        <div className="flex flex-wrap gap-3">
          <Dialog>
            <DialogTrigger asChild><Button variant="secondary">Apri finestra</Button></DialogTrigger>
            <DialogContent title="Segnala annuncio" description="Un moderatore la esaminerà.">
              <Field label="Motivo"><Select><option>Spam</option></Select></Field>
              <DialogFooter>
                <DialogClose asChild><Button variant="secondary">Annulla</Button></DialogClose>
                <Button variant="danger">Invia segnalazione</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Sheet>
            <SheetTrigger asChild><Button variant="secondary">Apri pannello</Button></SheetTrigger>
            <SheetContent title="Filtri" description="Restringi la ricerca.">
              <Field label="Budget massimo"><Input type="number" /></Field>
            </SheetContent>
          </Sheet>
          <Button
            variant="secondary"
            onClick={async () => {
              const ok = await confirm({ title: 'Eliminare l\'annuncio?', description: 'Le foto verranno cancellate.', confirmLabel: 'Elimina', tone: 'danger' });
              toast(ok ? 'Confermato' : 'Annullato');
            }}
          >
            Chiedi conferma
          </Button>
          <Button variant="secondary" onClick={() => toast.success('Profilo aggiornato')}>Toast di successo</Button>
          <Button variant="secondary" onClick={() => toast.error('Errore di connessione al server.')}>Toast di errore</Button>
        </div>
        <Tabs defaultValue="chat">
          <TabsList aria-label="Esempio">
            <TabsTrigger value="chat"><MessageCircle /> Chat</TabsTrigger>
            <TabsTrigger value="preferiti"><Heart /> Preferiti</TabsTrigger>
          </TabsList>
          <TabsContent value="chat"><p className="text-foreground-muted">Contenuto della scheda Chat.</p></TabsContent>
          <TabsContent value="preferiti"><p className="text-foreground-muted">Contenuto della scheda Preferiti.</p></TabsContent>
        </Tabs>
      </Card>
    </div>
  );
}

// Con ?errore=1 la vetrina va in errore mentre si disegna: serve a provare la pagina d'errore
function CrashForTesting(): never {
  throw new Error('Errore di prova della vetrina del design system');
}

export default function DesignSystem() {
  const [params] = useSearchParams();
  if (params.get('errore')) return <CrashForTesting />;
  return (
    <div className="bg-background text-foreground">
      <PageMeta title="Design system | RoomDate" noindex />
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 lg:grid-cols-2">
        <section aria-label="Tema chiaro" className="flex flex-col gap-6">
          <h1 className="font-display text-4xl font-bold">Design system</h1>
          <Showcase />
        </section>
        <section aria-label="Tema scuro" className="dark flex flex-col gap-6 rounded-card bg-background p-4 text-foreground">
          <h1 className="font-display text-4xl font-bold">Tema scuro</h1>
          <Showcase />
        </section>
      </div>
    </div>
  );
}
