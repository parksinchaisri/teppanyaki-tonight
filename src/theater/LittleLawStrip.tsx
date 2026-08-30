// A quiet, persistent R = I / T strip carried across every debrief screen —
// connective tissue between the screens, not a headline. Students meet the law
// immediately before the game with the process boundary drawn around the dining
// room only: I is customers seated and being served, T is dining-room
// throughput time, R is output rate. The bar is deliberately outside it.

export type LLTerm = 'R' | 'I' | 'T';

export interface LittleLawConfig {
  highlight: LLTerm[]; // rendered in the accent colour, bolder
  strikethrough?: LLTerm[]; // struck through — used where R is the wrong objective
  caption: string; // one short line beneath the equation
  muted?: boolean; // whole strip dimmed, for "the equation is static"
}

export function LittleLawStrip({ highlight, strikethrough, caption, muted }: LittleLawConfig) {
  const term = (t: LLTerm) => {
    const isOn = highlight.includes(t);
    const isCut = strikethrough?.includes(t) ?? false;
    return (
      <span
        key={t}
        className={isOn ? 'font-bold text-[var(--color-accent)]' : 'text-[var(--color-text-muted)]'}
        style={isCut ? { textDecoration: 'line-through', textDecorationThickness: '3px' } : undefined}
      >
        {t}
      </span>
    );
  };

  return (
    <div className={`mx-auto max-w-3xl text-center ${muted ? 'opacity-40' : ''}`}>
      <p className="font-mono text-3xl tracking-wide lg:text-4xl">
        {term('R')}
        <span className="mx-2 text-[var(--color-text-muted)]">=</span>
        {term('I')}
        <span className="mx-2 text-[var(--color-text-muted)]">/</span>
        {term('T')}
      </p>
      <p className="mt-2 text-base text-[var(--color-text-secondary)] lg:text-lg">{caption}</p>
    </div>
  );
}
