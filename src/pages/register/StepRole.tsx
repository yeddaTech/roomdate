import type { ReactNode, Ref } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { CircleCheck, House, Search } from 'lucide-react';
import { cn } from '../../components/ui/cn';
import { z } from '../../forms/zod';
import type { RegistrationData, ServerErrors } from './model';
import StepFrame from './StepFrame';
import { useStepForm } from './useStepForm';

const schema = z.object({
  userType: z.enum(['cerca', 'affitta'], 'Scegli una delle due opzioni per continuare'),
});
type Values = z.infer<typeof schema>;

interface Props {
  data: RegistrationData;
  serverErrors: ServerErrors;
  headingRef: Ref<HTMLHeadingElement>;
  onChange: (values: Partial<RegistrationData>) => void;
  onNext: (values: Values) => void;
  onBack: () => void;
}

const ERROR_ID = 'ruolo-errore';

function RoleOption({ icon, title, text, children }: { icon: ReactNode; title: string; text: string; children: ReactNode }) {
  return (
    <label
      className={cn(
        'group relative flex cursor-pointer items-center gap-4 rounded-card border-2 border-line bg-surface p-5 transition-colors duration-150',
        'hover:border-control has-checked:border-primary has-checked:bg-primary-soft',
        'has-focus-visible:ring-2 has-focus-visible:ring-focus has-focus-visible:ring-offset-2 has-focus-visible:ring-offset-background',
      )}
    >
      {children}
      <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-surface-muted text-foreground group-has-checked:bg-primary group-has-checked:text-primary-foreground [&_svg]:size-6" aria-hidden="true">
        {icon}
      </span>
      <span className="flex flex-col gap-0.5">
        <span className="font-bold text-foreground">{title}</span>
        <span className="text-sm text-foreground-muted">{text}</span>
      </span>
      <CircleCheck className="ml-auto hidden size-6 shrink-0 text-primary group-has-checked:block" aria-hidden="true" />
    </label>
  );
}

export default function StepRole({ data, serverErrors, headingRef, onChange, onNext, onBack }: Props) {
  const { register, handleSubmit, formState: { errors } } = useStepForm<Values>({
    resolver: zodResolver(schema),
    defaults: data.userType ? { userType: data.userType } : {},
    serverErrors,
    onChange,
  });
  const error = errors.userType?.message;
  const radio = register('userType');

  return (
    <StepFrame
      title="Cosa ti porta su RoomDate?"
      description="Potrai sempre cambiarlo dal profilo."
      headingRef={headingRef}
      onSubmit={handleSubmit(onNext)}
      onBack={onBack}
    >
      <fieldset aria-describedby={error ? ERROR_ID : undefined} className="flex flex-col gap-3">
        <legend className="sr-only">Cosa ti porta su RoomDate?</legend>
        <RoleOption icon={<Search />} title="Cerco una stanza" text="Trova casa e coinquilini con cui ti trovi bene.">
          <input type="radio" value="cerca" className="sr-only" aria-invalid={error ? true : undefined} {...radio} />
        </RoleOption>
        <RoleOption icon={<House />} title="Ho una stanza da affittare" text="Pubblica l'annuncio e scegli a chi rispondere.">
          <input type="radio" value="affitta" className="sr-only" aria-invalid={error ? true : undefined} {...radio} />
        </RoleOption>
        {error && <p id={ERROR_ID} role="alert" className="text-sm font-bold text-danger">{error}</p>}
      </fieldset>
    </StepFrame>
  );
}
