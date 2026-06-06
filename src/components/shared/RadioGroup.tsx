interface Option<T extends string> {
  value: T;
  label: string;
  hint?: string;
}

interface RadioGroupProps<T extends string> {
  label?: string;
  value: T;
  options: Option<T>[];
  onChange: (v: T) => void;
  columns?: number;
}

export function RadioGroup<T extends string>({ label, value, options, onChange, columns = 1 }: RadioGroupProps<T>) {
  return (
    <div className="flex flex-col gap-2">
      {label && <span className="text-sm text-[var(--color-text-secondary)]">{label}</span>}
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {options.map((opt) => {
          const active = opt.value === value;
          return (
            <button
              key={opt.value}
              onClick={() => onChange(opt.value)}
              className={`rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                active
                  ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/15 text-[var(--color-text-primary)]'
                  : 'border-[var(--color-border)] bg-[var(--color-surface-raised)] text-[var(--color-text-secondary)] hover:border-[var(--color-text-muted)]'
              }`}
            >
              <div className="font-medium">{opt.label}</div>
              {opt.hint && <div className="text-xs text-[var(--color-text-muted)]">{opt.hint}</div>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
