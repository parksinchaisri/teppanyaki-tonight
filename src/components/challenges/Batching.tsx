import { CHALLENGE_BY_KEY } from '../../challenges/definitions';
import type { BatchingMode } from '../../engine/types';
import { RadioGroup } from '../shared/RadioGroup';
import { ChallengeShell, type ChallengeContentProps } from './ChallengeShell';

export function Batching({ state, onChange }: ChallengeContentProps) {
  return (
    <ChallengeShell
      def={CHALLENGE_BY_KEY.batching}
      state={state}
      onChange={onChange}
      renderControls={(config, patch) => {
        const on = config.batching.early === 'eight';
        return (
          <RadioGroup
            label="Seating policy"
            value={on ? 'eight' : 'none'}
            options={[
              { value: 'eight', label: 'Use Batching (Tables of 8)', hint: 'Hold guests until a full table forms' },
              { value: 'none', label: 'No Batching', hint: 'Seat each party as soon as a table opens' },
            ]}
            onChange={(v: BatchingMode) => patch({ batching: { early: v, peak: v, late: v } })}
          />
        );
      }}
    />
  );
}
