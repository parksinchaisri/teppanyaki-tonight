import { CHALLENGE_BY_KEY } from '../../challenges/definitions';
import { PARAMS } from '../../engine/params';
import { barSeatsToTables, defaultConfig } from '../../engine/simulation';
import type { AdCampaign, BatchingMode, SimConfig } from '../../engine/types';
import { useApp } from '../../store/appContext';
import { finalChallengeLevers } from '../../firebase/types';
import { ChallengeShell, type ChallengeContentProps } from './ChallengeShell';

const MODES: { mode: BatchingMode; label: string }[] = [
  { mode: 'none', label: 'No Batch' },
  { mode: 'four_to_eight', label: '4–8' },
  { mode: 'eight', label: '8' },
  { mode: 'four_share', label: '4-Share' },
];

const PERIODS: { key: 'early' | 'peak' | 'late'; label: string }[] = [
  { key: 'early', label: 'Open→7' },
  { key: 'peak', label: 'Peak' },
  { key: 'late', label: 'Late' },
];

const CAMPAIGNS: { value: AdCampaign; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'awareness', label: 'Awareness' },
  { value: 'discount', label: 'Discount' },
  { value: 'happy_hour', label: 'Happy Hour' },
];

const OPENINGS: { value: number; label: string }[] = [
  { value: 300, label: '5 PM' },
  { value: 360, label: '6 PM' },
  { value: 420, label: '7 PM' },
];

function ColTitle({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="mb-2 border-b border-[var(--color-border)] pb-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--color-accent)]">
      {children}
    </h4>
  );
}

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
        active
          ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/15 text-[var(--color-text-primary)]'
          : 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-text-muted)]'
      }`}
    >
      {children}
    </button>
  );
}

function InlineSlider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  fmt,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  fmt: (v: number) => string;
}) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-10 shrink-0 text-[var(--color-text-secondary)]">{label}</span>
      <input
        type="range"
        className="min-w-0 flex-1"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className="w-14 shrink-0 text-right font-mono text-[var(--color-text-primary)]">{fmt(value)}</span>
    </div>
  );
}

export function FinalChallenge({ state, onChange }: ChallengeContentProps) {
  const { settings, params } = useApp();
  const levers = finalChallengeLevers(settings);
  const classDefaults = defaultConfig(
    {},
    { defaultBarSeats: params.defaultBarSeats, defaultTables: params.defaultTables },
  );

  // A lever the instructor switched off is not just hidden — the engine must run
  // on the class default for that parameter rather than whatever the student's
  // config happens to still hold.
  function sanitizeConfig(c: SimConfig): SimConfig {
    const out = { ...c };
    if (!levers.batching) out.batching = { ...classDefaults.batching };
    if (!levers.barSize) {
      out.barSeats = classDefaults.barSeats;
      out.tables = classDefaults.tables;
    }
    if (!levers.diningTime) {
      out.diningTimeEarly = classDefaults.diningTimeEarly;
      out.diningTimePeak = classDefaults.diningTimePeak;
      out.diningTimeLate = classDefaults.diningTimeLate;
    }
    if (!levers.advertising) {
      out.adBudget = classDefaults.adBudget;
      out.adCampaign = classDefaults.adCampaign;
      out.openingTime = classDefaults.openingTime;
    }
    return out;
  }

  const showBarColumn = levers.barSize || levers.diningTime;
  const columnCount = [levers.batching, showBarColumn, levers.advertising].filter(Boolean).length;
  const gridCols = columnCount >= 3 ? 'md:grid-cols-3' : columnCount === 2 ? 'md:grid-cols-2' : 'md:grid-cols-1';

  return (
    <ChallengeShell
      def={CHALLENGE_BY_KEY.finalChallenge}
      state={state}
      onChange={onChange}
      wide
      sanitizeConfig={sanitizeConfig}
      renderControls={(config, patch) => {
        const tables = barSeatsToTables(config.barSeats);
        return (
          <div className={`grid gap-x-8 gap-y-4 ${gridCols}`}>
            {columnCount === 0 && (
              <p className="text-sm text-[var(--color-text-secondary)]">
                Your instructor has switched off every configurable lever for this challenge — press Simulate to run
                the class default configuration.
              </p>
            )}

            {/* Column 1 — Batching matrix */}
            {levers.batching && (
            <div>
              <ColTitle>Batching</ColTitle>
              <table className="w-full text-xs">
                <thead>
                  <tr>
                    <th />
                    {MODES.map((m) => (
                      <th key={m.mode} className="px-1 pb-1 text-center font-medium text-[var(--color-text-secondary)]">
                        {m.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {PERIODS.map((p) => (
                    <tr key={p.key}>
                      <td className="whitespace-nowrap py-0.5 pr-2 text-[var(--color-text-secondary)]">{p.label}</td>
                      {MODES.map((m) => {
                        const checked = config.batching[p.key] === m.mode;
                        return (
                          <td key={m.mode} className="text-center">
                            <label className="flex cursor-pointer items-center justify-center py-1">
                              <input
                                type="radio"
                                name={`fb-${p.key}`}
                                checked={checked}
                                onChange={() => patch({ batching: { ...config.batching, [p.key]: m.mode } })}
                                className="h-3.5 w-3.5 cursor-pointer accent-[var(--color-accent)]"
                              />
                            </label>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            )}

            {/* Column 2 — Bar & Timing */}
            {showBarColumn && (
            <div>
              <ColTitle>{levers.barSize ? (levers.diningTime ? 'Bar & Timing' : 'Bar') : 'Dining Time'}</ColTitle>
              <div className="space-y-2">
                {levers.barSize && (
                <div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[var(--color-text-secondary)]">Bar seats</span>
                    <span className="font-mono text-[var(--color-text-primary)]">
                      {config.barSeats} seats → {tables} tables
                    </span>
                  </div>
                  <input
                    type="range"
                    className="mt-1 w-full"
                    min={PARAMS.BAR_SEATS_MIN}
                    max={PARAMS.BAR_SEATS_MAX}
                    step={1}
                    value={config.barSeats}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      patch({ barSeats: v, tables: barSeatsToTables(v) });
                    }}
                  />
                </div>
                )}
                {levers.diningTime && (
                  <>
                    <InlineSlider label="Early" value={config.diningTimeEarly} min={45} max={75} onChange={(v) => patch({ diningTimeEarly: v })} fmt={(v) => `${v} min`} />
                    <InlineSlider label="Peak" value={config.diningTimePeak} min={45} max={75} onChange={(v) => patch({ diningTimePeak: v })} fmt={(v) => `${v} min`} />
                    <InlineSlider label="Late" value={config.diningTimeLate} min={45} max={75} onChange={(v) => patch({ diningTimeLate: v })} fmt={(v) => `${v} min`} />
                  </>
                )}
              </div>
            </div>
            )}

            {/* Column 3 — Advertising */}
            {levers.advertising && (
            <div>
              <ColTitle>Advertising</ColTitle>
              <div className="space-y-2.5">
                <InlineSlider
                  label="Budget"
                  value={config.adBudget}
                  min={0}
                  max={4}
                  step={0.1}
                  onChange={(v) => patch({ adBudget: Number(v.toFixed(1)) })}
                  fmt={(v) => `${v.toFixed(1)}×`}
                />
                <div className="flex flex-wrap gap-1.5">
                  {CAMPAIGNS.map((c) => (
                    <Pill key={c.value} active={config.adCampaign === c.value} onClick={() => patch({ adCampaign: c.value })}>
                      {c.label}
                    </Pill>
                  ))}
                </div>
                <div className="flex gap-1.5">
                  {OPENINGS.map((o) => (
                    <Pill key={o.value} active={config.openingTime === o.value} onClick={() => patch({ openingTime: o.value })}>
                      {o.label}
                    </Pill>
                  ))}
                </div>
              </div>
            </div>
            )}
          </div>
        );
      }}
    />
  );
}
