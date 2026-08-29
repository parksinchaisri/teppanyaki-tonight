import { CHALLENGE_BY_KEY } from '../../challenges/definitions';
import { PARAMS } from '../../engine/params';
import { barSeatsToTables } from '../../engine/simulation';
import type { BatchingMode } from '../../engine/types';
import { RadioGroup } from '../shared/RadioGroup';
import { Slider } from '../shared/Slider';
import { ChallengeShell, type ChallengeContentProps, type ControlProps } from './ChallengeShell';

export function BarSize({ state, onChange }: ChallengeContentProps) {
  return (
    <ChallengeShell
      def={CHALLENGE_BY_KEY.barSize}
      state={state}
      onChange={onChange}
      renderControls={(config, patch) => <BarSizeControls config={config} patch={patch} />}
    />
  );
}

export function BarSizeControls({ config, patch }: ControlProps) {
        const on = config.batching.early === 'eight';
        const tables = barSeatsToTables(config.barSeats);
        return (
          <div className="space-y-5">
            <RadioGroup
              label="Batching"
              value={on ? 'eight' : 'none'}
              options={[
                { value: 'eight', label: 'Use Batching' },
                { value: 'none', label: 'No Batching' },
              ]}
              onChange={(v: BatchingMode) => patch({ batching: { early: v, peak: v, late: v } })}
              columns={2}
            />
            <Slider
              label="Bar seats"
              value={config.barSeats}
              min={PARAMS.BAR_SEATS_MIN}
              max={PARAMS.BAR_SEATS_MAX}
              step={1}
              onChange={(v) => patch({ barSeats: v, tables: barSeatsToTables(v) })}
              format={(v) => `${v} bar seats  →  ${barSeatsToTables(v)} dining tables`}
            />
            <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--color-text-secondary)]">Dining tables (derived)</span>
                <span className="font-mono text-lg text-[var(--color-text-primary)]">{tables}</span>
              </div>
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                Every 8 bar seats you add costs you 1 dining table. {config.barSeats} bar seats → {tables} tables ×{' '}
                {PARAMS.TABLE_CAPACITY} = {tables * PARAMS.TABLE_CAPACITY} dining seats.
              </p>
            </div>
          </div>
        );
      }
