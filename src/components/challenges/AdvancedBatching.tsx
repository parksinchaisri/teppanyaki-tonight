import { CHALLENGE_BY_KEY } from '../../challenges/definitions';
import { ChallengeShell, type ChallengeContentProps, type ControlProps } from './ChallengeShell';
import { PeriodBatchingControl } from './controls';

export function AdvancedBatching({ state, onChange, demoMode }: ChallengeContentProps) {
  return (
    <ChallengeShell
      def={CHALLENGE_BY_KEY.advancedBatching}
      state={state}
      onChange={onChange}
      demoMode={demoMode}
      renderControls={(config, patch) => <AdvancedBatchingControls config={config} patch={patch} />}
    />
  );
}

// `layout` is 'stack' everywhere a student uses this panel — it lives in a
// narrow sidebar there, so the three periods have to run down the page. The
// briefing projects the same panel at full width, where a stack of three
// four-option groups is taller than the screen; 'two-column' folds it so all
// three periods are visible at once without scrolling.
export function AdvancedBatchingControls({
  config,
  patch,
  layout = 'stack',
}: ControlProps & { layout?: 'stack' | 'two-column' }) {
  const early = (
    <PeriodBatchingControl
      label="Open → 7 PM"
      value={config.batching.early}
      onChange={(m) => patch({ batching: { ...config.batching, early: m } })}
      columns={layout === 'two-column' ? 2 : 1}
    />
  );
  const peak = (
    <PeriodBatchingControl
      label="7 PM → 8 PM (peak)"
      value={config.batching.peak}
      onChange={(m) => patch({ batching: { ...config.batching, peak: m } })}
      columns={layout === 'two-column' ? 2 : 1}
    />
  );
  const late = (
    <PeriodBatchingControl
      label="8 PM → close"
      value={config.batching.late}
      onChange={(m) => patch({ batching: { ...config.batching, late: m } })}
      columns={layout === 'two-column' ? 2 : 1}
    />
  );

  if (layout === 'two-column') {
    return (
      <div className="grid grid-cols-2 gap-x-8 gap-y-5">
        <div className="space-y-5">
          {early}
          {peak}
        </div>
        <div>{late}</div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {early}
      {peak}
      {late}
    </div>
  );
}
