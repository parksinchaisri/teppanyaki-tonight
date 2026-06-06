import { useMemo, useState, type ReactNode } from 'react';
import type { ChallengeResult, SimConfig } from '../../engine/types';
import { runChallenge } from '../../engine/simulation';
import type { ChallengeDef, ParamDefaults } from '../../challenges/definitions';
import { useApp } from '../../store/appContext';
import { submitResult } from '../../firebase/leaderboard';
import { submitReflection } from '../../firebase/reflections';
import { firebaseConfigured } from '../../firebase/config';
import { money, pct, uuid } from '../../lib/format';
import { OutcomesTable } from '../results/OutcomesTable';
import { DualCharts } from '../results/DualCharts';
import { ProfitHistogram } from '../results/ProfitHistogram';
import { ComparePanel, type SavedRun } from '../results/ComparePanel';
import { AutoDebrief } from '../shared/AutoDebrief';
import { UtilizationMeter } from '../shared/UtilizationMeter';
import { AnimationPanel } from '../animation/AnimationPanel';
import { Badge } from '../shared/Badge';

// Per-challenge UI state, lifted to ChallengesTab so it survives tab switches.
export interface ChallengeUIState {
  config: SimConfig;
  runs: SavedRun[];
  selectedId: string | null;
  selectedRun: number;
  reflection: string;
  reflectSubmitted: boolean;
}

export type ChallengeOnChange = (updater: (s: ChallengeUIState) => ChallengeUIState) => void;

export function makeInitialChallengeState(def: ChallengeDef, paramDefaults?: ParamDefaults): ChallengeUIState {
  return {
    config: def.makeDefault(paramDefaults),
    runs: [],
    selectedId: null,
    selectedRun: 0,
    reflection: '',
    reflectSubmitted: false,
  };
}

export interface ChallengeContentProps {
  state: ChallengeUIState;
  onChange: ChallengeOnChange;
}

interface Props extends ChallengeContentProps {
  def: ChallengeDef;
  renderControls: (config: SimConfig, patch: (p: Partial<SimConfig>) => void) => ReactNode;
  wide?: boolean; // Final Challenge uses a full-width multi-column config layout
}

export function ChallengeShell({ def, renderControls, state, onChange, wide }: Props) {
  const { session, settings, params, markCompleted } = useApp();
  const [showCompare, setShowCompare] = useState(false);
  const [status, setStatus] = useState<{ kind: 'idle' | 'ok' | 'err'; msg: string }>({ kind: 'idle', msg: '' });

  const { config, runs } = state;
  const patch = (p: Partial<SimConfig>) => onChange((s) => ({ ...s, config: { ...s.config, ...p } }));
  const selectRun = (i: number) => onChange((s) => ({ ...s, selectedRun: i }));

  const selected = runs.find((r) => r.id === state.selectedId) ?? null;
  const best = useMemo(
    () => (runs.length ? runs.reduce((a, b) => (b.result.avgProfit > a.result.avgProfit ? b : a)) : null),
    [runs],
  );

  function simulate() {
    const result: ChallengeResult = runChallenge(config, def.key, {
      ...params,
      strictBatching: settings.strictBatching,
    });
    const id = uuid();
    const saved: SavedRun = { id, label: `Config ${runs.length + 1}`, config: structuredClone(config), result };
    onChange((s) => ({ ...s, runs: [...s.runs, saved], selectedId: id, selectedRun: representativeRun(result) }));
  }

  function selectConfig(r: SavedRun) {
    onChange((s) => ({ ...s, selectedId: r.id, selectedRun: representativeRun(r.result) }));
  }

  async function handleSubmit() {
    if (!best || !session) return;
    setStatus({ kind: 'idle', msg: 'Submitting…' });
    try {
      await submitResult({
        classCode: session.classCode,
        studentId: session.studentId,
        studentName: session.displayName,
        challengeKey: def.key,
        avgProfit: best.result.avgProfit,
        maxProfit: best.result.maxProfit,
        config: best.config,
      });
      markCompleted(def.key);
      setStatus({
        kind: 'ok',
        msg: firebaseConfigured
          ? `Submitted ${money(best.result.avgProfit)} to the leaderboard.`
          : 'Recorded locally (leaderboard disabled in demo mode).',
      });
    } catch {
      setStatus({ kind: 'err', msg: 'Submission failed. Try again.' });
    }
  }

  async function handleReflection() {
    if (!session || state.reflection.trim().length < 10) return;
    await submitReflection({
      classCode: session.classCode,
      studentId: session.studentId,
      studentName: session.displayName,
      challengeKey: def.key,
      questionText: def.reflectionQuestion,
      response: state.reflection.trim(),
    });
    onChange((s) => ({ ...s, reflectSubmitted: true }));
  }

  // ── Shared sub-blocks ──────────────────────────────────────────────────────

  const simulateButton = (
    <button
      onClick={simulate}
      className="w-full rounded-md bg-[var(--color-accent)] px-4 py-2.5 font-medium text-white"
    >
      ▶ Simulate 20 nights
    </button>
  );

  const savedConfigsList = runs.length > 0 && (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
          Saved configs
        </h3>
        {runs.length >= 2 && (
          <button onClick={() => setShowCompare(true)} className="text-xs text-[var(--color-accent)]">
            Compare →
          </button>
        )}
      </div>
      <div className="space-y-1.5">
        {runs.map((r) => (
          <button
            key={r.id}
            onClick={() => selectConfig(r)}
            className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-sm ${
              state.selectedId === r.id
                ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10'
                : 'border-[var(--color-border)] hover:border-[var(--color-text-muted)]'
            }`}
          >
            <span className="flex items-center gap-2">
              {r.label}
              {best?.id === r.id && <Badge tone="green">best</Badge>}
            </span>
            <span className="font-mono">{money(r.result.avgProfit)}</span>
          </button>
        ))}
      </div>
      <SubmitBlock best={best} status={status} onSubmit={handleSubmit} />
    </div>
  );

  const reflectionBlock = settings.reflectionsRequired && selected && (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
      <h3 className="text-sm font-semibold">Reflection</h3>
      <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{def.reflectionQuestion}</p>
      <textarea
        value={state.reflection}
        onChange={(e) => onChange((s) => ({ ...s, reflection: e.target.value }))}
        rows={4}
        placeholder="Write at least a sentence or two…"
        className="mt-3 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-3 text-sm outline-none focus:border-[var(--color-accent)]"
      />
      <div className="mt-2 flex items-center gap-3">
        <button
          onClick={handleReflection}
          disabled={state.reflection.trim().length < 10 || state.reflectSubmitted}
          className="rounded-md bg-[var(--color-surface-raised)] px-4 py-2 text-sm font-medium disabled:opacity-40"
        >
          {state.reflectSubmitted ? 'Reflection saved ✓' : 'Submit reflection'}
        </button>
        {state.reflection.trim().length > 0 && state.reflection.trim().length < 10 && (
          <span className="text-xs text-[var(--color-accent-amber)]">A little more detail, please.</span>
        )}
      </div>
    </div>
  );

  const resultsBlock = !selected ? (
    <div className="rounded-xl border border-dashed border-[var(--color-border)] p-10 text-center text-[var(--color-text-secondary)]">
      Set your controls{wide ? ' above' : ' on the right'}, then press{' '}
      <span className="text-[var(--color-text-primary)]">Simulate</span> to run the evening 20 times.
    </div>
  ) : (
    <ResultsView
      saved={selected}
      selectedRun={state.selectedRun}
      onSelectRun={selectRun}
      showUtil={settings.utilizationVisible}
      showDebrief={settings.autoDebrief}
      challengeKey={def.key}
    />
  );

  const header = (
    <div>
      <h2 className="text-2xl font-bold">{def.title}</h2>
      <p className="mt-2 max-w-3xl text-sm text-[var(--color-text-secondary)]">{def.description}</p>
    </div>
  );

  // ── Wide layout (Final Challenge): full-width config grid above Simulate ────
  if (wide) {
    return (
      <div className="space-y-5">
        {header}

        {runs.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
            <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
              Saved
            </span>
            {runs.map((r) => (
              <button
                key={r.id}
                onClick={() => selectConfig(r)}
                className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm ${
                  state.selectedId === r.id
                    ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10'
                    : 'border-[var(--color-border)] hover:border-[var(--color-text-muted)]'
                }`}
              >
                {r.label}
                {best?.id === r.id && <Badge tone="green">best</Badge>}
                <span className="font-mono text-xs text-[var(--color-text-secondary)]">{money(r.result.avgProfit)}</span>
              </button>
            ))}
            {runs.length >= 2 && (
              <button onClick={() => setShowCompare(true)} className="ml-auto text-xs text-[var(--color-accent)]">
                Compare →
              </button>
            )}
          </div>
        )}

        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          {renderControls(config, patch)}
        </div>

        <div className="mx-auto max-w-md">{simulateButton}</div>

        {runs.length > 0 && (
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            <SubmitBlock best={best} status={status} onSubmit={handleSubmit} />
          </div>
        )}

        {resultsBlock}
        {reflectionBlock}
        {showCompare && <ComparePanel runs={runs} onClose={() => setShowCompare(false)} />}
      </div>
    );
  }

  // ── Default layout: results left, config panel right ───────────────────────
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_330px]">
      <div className="order-2 space-y-5 lg:order-1">
        {header}
        {resultsBlock}
        {reflectionBlock}
      </div>

      <div className="order-1 space-y-4 lg:order-2">
        <div className="lg:sticky lg:top-20 space-y-4">
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
              Controls
            </h3>
            <div className="space-y-5">{renderControls(config, patch)}</div>
            <div className="mt-5">{simulateButton}</div>
          </div>
          {savedConfigsList}
        </div>
      </div>

      {showCompare && <ComparePanel runs={runs} onClose={() => setShowCompare(false)} />}
    </div>
  );
}

function SubmitBlock({
  best,
  status,
  onSubmit,
}: {
  best: SavedRun | null;
  status: { kind: 'idle' | 'ok' | 'err'; msg: string };
  onSubmit: () => void;
}) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-3">
      <button
        onClick={onSubmit}
        disabled={!best}
        className="w-auto rounded-md bg-[var(--color-accent-green)] px-8 py-2 font-medium text-black disabled:opacity-40"
      >
        Submit best to leaderboard
      </button>
      <span
        className={`text-xs ${
          status.kind === 'err' ? 'text-[var(--color-accent-red)]' : 'text-[var(--color-text-muted)]'
        }`}
      >
        {status.msg || `Submits your best average profit (${best ? money(best.result.avgProfit) : '—'}).`}
      </span>
    </div>
  );
}

// Pick the saved 20-run replicate whose profit is closest to the average — a
// representative "typical night" to show in charts and animation by default.
function representativeRun(result: ChallengeResult): number {
  let best = 0;
  let bestDiff = Infinity;
  result.runs.forEach((r, i) => {
    const d = Math.abs(r.profit - result.avgProfit);
    if (d < bestDiff) {
      bestDiff = d;
      best = i;
    }
  });
  return best;
}

function ResultsView({
  saved,
  selectedRun,
  onSelectRun,
  showUtil,
  showDebrief,
  challengeKey,
}: {
  saved: SavedRun;
  selectedRun: number;
  onSelectRun: (i: number) => void;
  showUtil: boolean;
  showDebrief: boolean;
  challengeKey: string;
}) {
  const result = saved.result;
  const run = result.runs[selectedRun];
  return (
    <div className="space-y-5">
      {/* 1 · Config summary bar — compact 2×2 dashboard readout */}
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Avg profit" value={money(result.avgProfit)} tone={result.avgProfit < 0 ? 'red' : 'green'} />
        <Stat label="Best night" value={money(result.maxProfit)} />
        <Stat label="Avg lost guests" value={result.avgLost.toFixed(0)} />
        <Stat label="Chef utilisation" value={pct(result.avgChefUtil)} />
      </div>

      {/* 2 · Floor animation */}
      <div>
        <h3 className="mb-2 text-sm font-semibold">
          Watch the night · Run {selectedRun + 1} ({money(run.profit)})
        </h3>
        <AnimationPanel run={run} config={saved.config} challengeKey={challengeKey} />
      </div>

      {/* 3 · Utilisation meter */}
      {showUtil && <UtilizationMeter result={result} />}

      {/* 4 · Auto-debrief */}
      {showDebrief && <AutoDebrief result={result} />}

      {/* 5 · Profit histogram */}
      <ProfitHistogram
        primary={{ label: saved.label, color: 'var(--color-accent)', profits: result.runs.map((r) => r.profit) }}
      />

      {/* 6 · Dual charts */}
      <DualCharts run={run} />

      {/* 7 · Outcomes table */}
      <OutcomesTable result={result} selectedRun={selectedRun} onSelectRun={onSelectRun} />
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'green' | 'red' }) {
  const color = tone === 'red' ? 'var(--color-accent-red)' : tone === 'green' ? 'var(--color-accent-green)' : 'var(--color-text-primary)';
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3">
      <div className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">{label}</div>
      <div className="mt-0.5 font-mono text-2xl" style={{ color }}>
        {value}
      </div>
    </div>
  );
}
