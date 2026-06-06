import { CHALLENGE_BY_KEY } from '../../challenges/definitions';
import { advertisingMultiplier } from '../../engine/simulation';
import type { AdCampaign } from '../../engine/types';
import { RadioGroup } from '../shared/RadioGroup';
import { Slider } from '../shared/Slider';
import { ChallengeShell, type ChallengeContentProps } from './ChallengeShell';

const CAMPAIGNS: { value: AdCampaign; label: string; hint: string }[] = [
  { value: 'none', label: 'None', hint: 'No campaign' },
  { value: 'awareness', label: 'Awareness Building', hint: '+15% demand all evening' },
  { value: 'discount', label: 'Discount Promotion', hint: '+25% demand, lower dinner margin' },
  { value: 'happy_hour', label: 'Happy Hour', hint: 'Pulls demand earlier in the evening' },
];

const OPENINGS: { value: string; label: string }[] = [
  { value: '300', label: '5:00 PM' },
  { value: '360', label: '6:00 PM' },
  { value: '420', label: '7:00 PM' },
];

export function Advertising({ state, onChange }: ChallengeContentProps) {
  return (
    <ChallengeShell
      def={CHALLENGE_BY_KEY.advertising}
      state={state}
      onChange={onChange}
      renderControls={(config, patch) => (
        <div className="space-y-5">
          <p className="text-xs text-[var(--color-text-muted)]">Batching fixed at Tables of 8.</p>
          <Slider
            label="Advertising budget"
            value={config.adBudget}
            min={0}
            max={4}
            step={0.1}
            onChange={(v) => patch({ adBudget: Number(v.toFixed(1)) })}
            format={(v) => `${v.toFixed(1)}×  (≈${advertisingMultiplier(v).toFixed(2)}× demand)`}
            hint={`Costs $${(config.adBudget * 200).toFixed(0)} for the evening.`}
          />
          <RadioGroup
            label="Campaign type"
            value={config.adCampaign}
            options={CAMPAIGNS}
            onChange={(v) => patch({ adCampaign: v })}
          />
          <RadioGroup
            label="Opening time"
            value={String(config.openingTime)}
            options={OPENINGS}
            onChange={(v) => patch({ openingTime: Number(v) })}
            columns={3}
          />
        </div>
      )}
    />
  );
}
