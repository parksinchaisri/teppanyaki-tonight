import { CHALLENGE_BY_KEY } from '../../challenges/definitions';
import { ChallengeShell, type ChallengeContentProps, type ControlProps } from './ChallengeShell';
import { PeriodBatchingControl } from './controls';

export function AdvancedBatching({ state, onChange }: ChallengeContentProps) {
  return (
    <ChallengeShell
      def={CHALLENGE_BY_KEY.advancedBatching}
      state={state}
      onChange={onChange}
      renderControls={(config, patch) => <AdvancedBatchingControls config={config} patch={patch} />}
    />
  );
}

export function AdvancedBatchingControls({ config, patch }: ControlProps) {
  return (
        <div className="space-y-5">
          <PeriodBatchingControl
            label="Open → 7 PM"
            value={config.batching.early}
            onChange={(m) => patch({ batching: { ...config.batching, early: m } })}
          />
          <PeriodBatchingControl
            label="7 PM → 8 PM (peak)"
            value={config.batching.peak}
            onChange={(m) => patch({ batching: { ...config.batching, peak: m } })}
          />
          <PeriodBatchingControl
            label="8 PM → close"
            value={config.batching.late}
            onChange={(m) => patch({ batching: { ...config.batching, late: m } })}
          />
        </div>
      );
}
