import { CHALLENGE_BY_KEY } from '../../challenges/definitions';
import { Slider } from '../shared/Slider';
import { ChallengeShell, type ChallengeContentProps, type ControlProps } from './ChallengeShell';

export function DiningTime({ state, onChange }: ChallengeContentProps) {
  return (
    <ChallengeShell
      def={CHALLENGE_BY_KEY.diningTime}
      state={state}
      onChange={onChange}
      renderControls={(config, patch) => <DiningTimeControls config={config} patch={patch} />}
    />
  );
}

export function DiningTimeControls({ config, patch }: ControlProps) {
  return (
        <div className="space-y-5">
          <p className="text-xs text-[var(--color-text-muted)]">
            Batching is fixed at Tables of 8 for this challenge. Shorten a seating to turn tables faster.
          </p>
          <Slider
            label="Early diners (open–7 PM)"
            value={config.diningTimeEarly}
            min={45}
            max={75}
            onChange={(v) => patch({ diningTimeEarly: v })}
            format={(v) => `${v} min`}
          />
          <Slider
            label="Peak diners (7–8 PM)"
            value={config.diningTimePeak}
            min={45}
            max={75}
            onChange={(v) => patch({ diningTimePeak: v })}
            format={(v) => `${v} min`}
          />
          <Slider
            label="Late diners (8 PM–close)"
            value={config.diningTimeLate}
            min={45}
            max={75}
            onChange={(v) => patch({ diningTimeLate: v })}
            format={(v) => `${v} min`}
          />
        </div>
      );
}
