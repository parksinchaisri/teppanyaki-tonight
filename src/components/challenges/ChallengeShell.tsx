import { useMemo, useState, type ReactNode } from 'react';
import type { ChallengeResult, SimConfig } from '../../engine/types';
import { runChallenge } from '../../engine/simulation';
import type { ChallengeDef, ParamDefaults } from '../../challenges/definitions';
import { useApp } from '../../store/appContext';
import { submitResult } from '../../firebase/leaderboard';
import { submitReflection } from '../../firebase/reflections';
import { logAttempt } from '../../firebase/attempts';
import { confidenceRatingEnabledFor, maxAttemptsFor, reflectionsRequiredFor } from '../../firebase/types';
import { isAwaitingTimer, isRoundClosed } from '../../firebase/liveSession';
import { useCountdown } from '../shared/useCountdown';
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

// A challenge's own config panel, factored out so Theater Mode's briefing can
// project the real controls read-only instead of a hand-written summary.
export interface ControlProps {
  config: SimConfig;
  patch: (p: Partial<SimConfig>) => void;
}

export interface ChallengeContentProps {
  state: ChallengeUIState;
  onChange: ChallengeOnChange;
  // Theater's live demo: the real component, really simulating, but writing
  // nothing anywhere. See the demoMode note on ChallengeShell.
  demoMode?: boolean;
}

interface Props extends ChallengeContentProps {
  def: ChallengeDef;
  renderControls: (config: SimConfig, patch: (p: Partial<SimConfig>) => void) => ReactNode;
  wide?: boolean; // Final Challenge uses a full-width multi-column config layout
  // Applied to the config immediately before it is simulated and saved. The
  // Final Challenge uses it to substitute class defaults for levers the
  // instructor has switched off.
  sanitizeConfig?: (c: SimConfig) => SimConfig;
  // Theater's "Demo This Challenge": this exact component, fully interactive,
  // driving the real engine — but inert as far as anything persistent is
  // concerned. Every write in this file is behind `!demoMode`: the three
  // Firestore calls (logAttempt, submitResult, submitReflection), the shared
  // attempt counter, and the two localStorage flags. Attempt limits and the
  // live-session gates are lifted too, so the instructor can run it as often as
  // the demonstration needs. The instructor's browser may well be carrying a
  // real student session in localStorage, so `session == null` is not something
  // this can lean on.
  demoMode?: boolean;
}

export function ChallengeShell({
  def,
  renderControls,
  state,
  onChange,
  wide,
  sanitizeConfig,
  demoMode = false,
}: Props) {
  const { session, settings, params, markCompleted, markReflected, attemptCounts, bumpAttempt, liveState } =
    useApp();
  const [showCompare, setShowCompare] = useState(false);
  const [status, setStatus] = useState<{ kind: 'idle' | 'ok' | 'err'; msg: string }>({ kind: 'idle', msg: '' });
  // Non-null while the confidence prompt is open (the pending run is waiting on it).
  const [askingConfidence, setAskingConfidence] = useState(false);

  const attemptsUsed = attemptCounts[def.key] ?? 0;
  const maxAttempts = maxAttemptsFor(settings, def.key);
  const limitReached = !demoMode && attemptsUsed >= maxAttempts;
  const askConfidence = confidenceRatingEnabledFor(settings, def.key);

  // The instructor has closed this round — simulating is over, but everything
  // already run stays viewable.
  const roundClosed = !demoMode && isRoundClosed(settings, liveState, def.key);
  // The round is unlocked for reading but has not started — hold Simulate until
  // the instructor starts the timer.
  const awaitingTimer = !demoMode && isAwaitingTimer(settings, liveState, def.key);
  const simulateBlocked = limitReached || roundClosed || awaitingTimer;
  // The shared class clock, shown only while this challenge's round is running.
  const timerActive =
    !demoMode &&
    settings.liveSessionMode &&
    liveState.phase === 'timed_round' &&
    liveState.currentChallenge === def.key &&
    liveState.timer?.endsAt != null;

  const { config, runs } = state;
  const patch = (p: Partial<SimConfig>) => onChange((s) => ({ ...s, config: { ...s.config, ...p } }));
  const selectRun = (i: number) => onChange((s) => ({ ...s, selectedRun: i }));

  const selected = runs.find((r) => r.id === state.selectedId) ?? null;
  const best = useMemo(
    () => (runs.length ? runs.reduce((a, b) => (b.result.avgProfit > a.result.avgProfit ? b : a)) : null),
    [runs],
  );

  // A brand-new configuration run. Consumes one attempt and appends a row to the
  // permanent `attempts` audit trail. Re-selecting a saved config does neither.
  function simulate(confidenceRating: number | null) {
    if (simulateBlocked) return;
    const effective = sanitizeConfig ? sanitizeConfig(config) : config;
    const result: ChallengeResult = runChallenge(effective, def.key, {
      ...params,
      strictBatching: settings.strictBatching,
    });
    const id = uuid();
    const saved: SavedRun = { id, label: `Config ${runs.length + 1}`, config: structuredClone(effective), result };
    onChange((s) => ({ ...s, runs: [...s.runs, saved], selectedId: id, selectedRun: representativeRun(result) }));

    // Demo runs are not anybody's attempts: they neither consume the shared
    // counter nor reach the audit trail.
    if (demoMode) return;

    const attemptNumber = bumpAttempt(def.key);
    if (session) {
      void logAttempt({
        classCode: session.classCode,
        studentId: session.studentId,
        displayName: session.displayName,
        challengeKey: def.key,
        attemptNumber,
        config: saved.config,
        result,
        confidenceRating,
      }).catch(() => {});
    }
  }

  function handleSimulateClick() {
    if (simulateBlocked) return;
    if (askConfidence) setAskingConfidence(true);
    else simulate(null);
  }

  function selectConfig(r: SavedRun) {
    onChange((s) => ({ ...s, selectedId: r.id, selectedRun: representativeRun(r.result) }));
  }

  async function handleSubmit() {
    if (!best) return;
    if (demoMode) {
      setStatus({ kind: 'ok', msg: 'Demo — nothing was submitted or saved.' });
      return;
    }
    if (!session) return;
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
    if (state.reflection.trim().length < 10) return;
    if (demoMode) {
      onChange((s) => ({ ...s, reflectSubmitted: true }));
      return;
    }
    if (!session) return;
    await submitReflection({
      classCode: session.classCode,
      studentId: session.studentId,
      studentName: session.displayName,
      challengeKey: def.key,
      questionText: def.reflectionQuestion,
      response: state.reflection.trim(),
    });
    onChange((s) => ({ ...s, reflectSubmitted: true }));
    markReflected(def.key); // unblocks the next challenge when reflections gate progress
  }

  // ── Shared sub-blocks ──────────────────────────────────────────────────────

  const simulateButton = (
    <div className="space-y-2">
      <button
        onClick={handleSimulateClick}
        disabled={simulateBlocked}
        className="w-full rounded-md bg-[var(--color-accent)] px-4 py-2.5 font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
      >
        ▶ Simulate 20 nights
      </button>
      {roundClosed ? (
        <p className="text-center text-xs text-[var(--color-accent-amber)]">This round has ended.</p>
      ) : awaitingTimer ? (
        <p className="text-center text-xs text-[var(--color-accent-amber)]">
          Get ready — your instructor will start the timer shortly.
        </p>
      ) : limitReached ? (
        <p className="text-center text-xs text-[var(--color-accent-amber)]">
          Attempt limit reached ({attemptsUsed}/{maxAttempts}) for this challenge.
        </p>
      ) : demoMode ? (
        <p className="text-center text-xs text-[var(--color-text-muted)]">
          Demo — run it as many times as you like.
        </p>
      ) : (
        maxAttempts < 10 && (
          <p className="text-center text-xs text-[var(--color-text-muted)]">
            Attempt {attemptsUsed + 1} of {maxAttempts}
          </p>
        )
      )}
      {askingConfidence && (
        <ConfidencePrompt
          onCancel={() => setAskingConfidence(false)}
          onPick={(rating) => {
            setAskingConfidence(false);
            simulate(rating);
          }}
        />
      )}
    </div>
  );

  const savedConfigsList = runs.length > 0 && (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
          Saved configs
        </h3>
        {runs.length >= 2 && (
          <button onClick={() => setShowCompare(true)} className="text-xs text-[var(--color-accent)]">
            Compare My Runs →
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

  // Normally the reflection sits under a selected result. When reflections gate
  // progress it must always be reachable — a student who refreshes has no
  // selected run in memory, and if the round has closed they cannot make one,
  // which would strand them behind a gate they can never clear.
  const reflectionBlock = reflectionsRequiredFor(settings, def.key) &&
    (selected || settings.reflectionGatesProgress) && (
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
          {state.reflectSubmitted ? 'Reflection saved ✓' : 'Save Reflection'}
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
    <div className="flex items-start justify-between gap-4">
      <div>
        {demoMode && <DemoBanner />}
        <h2 className="text-2xl font-bold">{def.title}</h2>
        <p className="mt-2 max-w-3xl text-sm text-[var(--color-text-secondary)]">{def.description}</p>
      </div>
      {timerActive && <CountdownBadge endsAt={liveState.timer?.endsAt ?? null} />}
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
                Compare My Runs →
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

// Stays on screen for the whole demo, so a screenshot of this panel can never
// be mistaken for a real submission.
function DemoBanner() {
  return (
    <p className="mb-3 inline-block rounded-md border border-[var(--color-accent-amber)] bg-[var(--color-accent-amber)]/15 px-3 py-1.5 text-sm font-semibold uppercase tracking-wide text-[var(--color-accent-amber)]">
      🎬 Demo — not scored, nothing is saved
    </p>
  );
}

// The same shared class clock Theater Mode projects, so students can pace
// themselves without switching windows.
function CountdownBadge({ endsAt }: { endsAt: number | null }) {
  const { label, expired } = useCountdown(endsAt);
  return (
    <div
      className={`shrink-0 rounded-lg border px-4 py-2 text-center ${
        expired
          ? 'animate-pulse border-[var(--color-accent-red)] bg-[var(--color-accent-red)]/10'
          : 'border-[var(--color-border)] bg-[var(--color-surface)]'
      }`}
    >
      <div className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">
        {expired ? "Time's up" : 'Time left'}
      </div>
      <div
        className={`font-mono text-2xl tabular-nums ${expired ? 'text-[var(--color-accent-red)]' : ''}`}
      >
        {label}
      </div>
    </div>
  );
}

// Shown when `confidenceRatingEnabled` is on for this challenge: the run does
// not start until the student commits to a 1–5 rating.
function ConfidencePrompt({ onPick, onCancel }: { onPick: (rating: number) => void; onCancel: () => void }) {
  return (
    <div className="rounded-md border border-[var(--color-accent)]/50 bg-[var(--color-accent)]/10 p-3">
      <p className="text-xs text-[var(--color-text-secondary)]">
        How confident are you that this strategy will perform well?
      </p>
      <div className="mt-2 flex items-center gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            onClick={() => onPick(n)}
            className="flex-1 rounded-md border border-[var(--color-border)] py-1.5 font-mono text-sm hover:border-[var(--color-accent)] hover:bg-[var(--color-accent)]/15"
          >
            {n}
          </button>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-between text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">
        <span>Not at all</span>
        <span>Very</span>
      </div>
      <button onClick={onCancel} className="mt-2 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]">
        Cancel
      </button>
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
        Submit Best to Leaderboard
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
