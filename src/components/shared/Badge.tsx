import type { ReactNode } from 'react';

type Tone = 'neutral' | 'green' | 'amber' | 'red' | 'blue';

const TONE: Record<Tone, string> = {
  neutral: 'bg-[var(--color-surface-raised)] text-[var(--color-text-secondary)] border-[var(--color-border)]',
  green: 'bg-[var(--color-accent-green)]/15 text-[var(--color-accent-green)] border-[var(--color-accent-green)]/40',
  amber: 'bg-[var(--color-accent-amber)]/15 text-[var(--color-accent-amber)] border-[var(--color-accent-amber)]/40',
  red: 'bg-[var(--color-accent-red)]/15 text-[var(--color-accent-red)] border-[var(--color-accent-red)]/40',
  blue: 'bg-[var(--color-accent)]/15 text-[var(--color-accent)] border-[var(--color-accent)]/40',
};

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: Tone }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${TONE[tone]}`}>
      {children}
    </span>
  );
}
