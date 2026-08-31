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

  // Panels are nudged up a notch for the room, and capped so nothing can push
  // the briefing off a projector. Advanced Batching is the one panel that fills
  // both columns; it needs its own numbers to clear the cap on an 800px-tall
  // screen (see the layout note in AdvancedBatching.tsx).
  let zoom = 1.1;
  let box = 'max-h-[44vh] p-5';
  let panel: React.ReactNode = null;
  if (challengeKey === 'batching') panel = <BatchingControls config={config} patch={noop} />;
  else if (challengeKey === 'barSize') panel = <BarSizeControls config={config} patch={noop} />;
  else if (challengeKey === 'diningTime') panel = <DiningTimeControls config={config} patch={noop} />;
  else if (challengeKey === 'advertising') panel = <AdvertisingControls config={config} patch={noop} />;
  else if (challengeKey === 'advancedBatching') {
    panel = <AdvancedBatchingControls config={config} patch={noop} layout="two-column" />;
    zoom = 1;
    box = 'max-h-[48vh] p-4';
  } else if (challengeKey === 'finalChallenge') {
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
      {/* Every panel is authored to fit inside its cap, so the overflow rule is
          only a backstop: a future panel that outgrows the screen scrolls in its
          own box rather than pushing the briefing off the projector. */}
      <fieldset
        disabled
        aria-hidden
        className={`pointer-events-none select-none overflow-y-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] text-left ${box}`}
      >
        {/* `zoom` rather than `transform: scale()`: a transform enlarges the
            painted result without changing the layout box, so the panel drew
            outside its own container on every challenge. zoom reflows, so the
            box grows with the content and nothing overhangs. */}
        <div style={{ zoom }}>{panel}</div>
      </fieldset>
    </div>
  );
}
