import type { ComponentProps } from 'react';
import { Tabs as TabsPrimitive } from 'radix-ui';
import { cn, focusRing } from './cn';

// Schede su Radix: frecce della tastiera per spostarsi, ruoli ARIA tablist/tab/tabpanel.

export const Tabs = TabsPrimitive.Root;

export function TabsList({ className, ...props }: ComponentProps<typeof TabsPrimitive.List>) {
  return <TabsPrimitive.List className={cn('inline-flex flex-wrap gap-2', className)} {...props} />;
}

export function TabsTrigger({ className, ...props }: ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        'inline-flex h-10 items-center gap-2 rounded-full border border-line bg-surface px-5 text-sm font-bold text-foreground-muted transition-colors duration-150',
        'hover:text-foreground data-[state=active]:border-foreground data-[state=active]:bg-foreground data-[state=active]:text-background [&_svg]:size-4',
        focusRing, className,
      )}
      {...props}
    />
  );
}

export function TabsContent({ className, ...props }: ComponentProps<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content className={cn('mt-6', focusRing, className)} {...props} />;
}
