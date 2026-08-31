import { CHALLENGE_BY_KEY } from '../challenges/definitions';
import type { ParamOverrides, SimConfig } from '../engine/types';
import { finalChallengeLevers, type ClassSettings } from '../firebase/types';
import { BatchingControls } from '../components/challenges/Batching';
import { BarSizeControls } from '../components/challenges/BarSize';
import { DiningTimeControls } from '../components/challenges/DiningTime';
import { AdvertisingControls } from '../components/challenges/Advertising';
import { AdvancedBatchingControls } from '../components/challenges/AdvancedBatching';
import { FinalChallengeControls } from '../components/challenges/FinalChallenge';

const noop = () => {};

// Projects the challenge's actual config panel — the same component students
// will be using in a moment — rather than a hand-written summary that could
// drift out of step with the real controls. Rendered inert and scaled up for
// the room.
export function BriefingControlsPreview({
  challengeKey,
  settings,
  params,
}: {
  challengeKey: string;
  settings: ClassSettings;
  params: ParamOverrides;
}) {
  const def = CHALLENGE_BY_KEY[challengeKey];
  if (!def) return null;
  const config: SimConfig = def.makeDefault({
    defaultBarSeats: params.defaultBarSeats,
    defaultTables: params.defaultTables,
  });

  let panel: React.ReactNode = null;
  if (challengeKey === 'batching') panel = <BatchingControls config={config} patch={noop} />;
  else if (challengeKey === 'barSize') panel = <BarSizeControls config={config} patch={noop} />;
  else if (challengeKey === 'diningTime') panel = <DiningTimeControls config={config} patch={noop} />;
  else if (challengeKey === 'advertising') panel = <AdvertisingControls config={config} patch={noop} />;
  else if (challengeKey === 'advancedBatching') panel = <AdvancedBatchingControls config={config} patch={noop} />;
  else if (challengeKey === 'finalChallenge') {
    const levers = finalChallengeLevers(settings);
    const showBar = levers.barSize || levers.diningTime;
    const columnCount = [levers.batching, showBar, levers.advertising].filter(Boolean).length;
    panel = (
      <FinalChallengeControls
        config={config}
        patch={noop}
        levers={levers}
        columnCount={columnCount}
        gridCols={columnCount >= 3 ? 'md:grid-cols-3' : columnCount === 2 ? 'md:grid-cols-2' : 'md:grid-cols-1'}
      />
    );
  }
  if (!panel) return null;

  return (
    <div className="mx-auto mt-5 w-full max-w-5xl">
      <p className="mb-3 text-sm uppercase tracking-[0.2em] text-[var(--color-accent)]">What you can change</p>
      {/* Inert: no pointer events, not focusable, nothing to submit. */}
      {/* Capped so the tallest panel (Advanced Batching: 3 periods x 4 modes)
          scrolls inside its own box instead of pushing the briefing off the
          projected screen. */}
      <fieldset
        disabled
        aria-hidden
        className="pointer-events-none max-h-[44vh] select-none overflow-y-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 text-left"
      >
        {/* `zoom` rather than `transform: scale()`: a transform enlarges the
            painted result without changing the layout box, so the panel drew
            outside its own container on every challenge. zoom reflows, so the
            box grows with the content and nothing overhangs. */}
        <div style={{ zoom: 1.1 }}>{panel}</div>
      </fieldset>
    </div>
  );
}
