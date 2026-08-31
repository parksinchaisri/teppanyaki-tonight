import { CHALLENGE_BY_KEY } from '../../challenges/definitions';
import { advertisingMultiplier } from '../../engine/simulation';
import type { AdCampaign } from '../../engine/types';
import { RadioGroup } from '../shared/RadioGroup';
import { Slider } from '../shared/Slider';
import { ChallengeShell, type ChallengeContentProps, type ControlProps } from './ChallengeShell';

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
      renderControls={(config, patch) => <AdvertisingControls config={config} patch={patch} />}
    />
  );
}

// As with Advanced Batching, 'stack' is what students get in the sidebar and
// 'two-column' is for the briefing, where the panel is projected full width.
// Stacked, the four campaigns plus the opening-time row run off the bottom of
// the briefing box, so the class never sees two of the levers they are about
// to use.
export function AdvertisingControls({
  config,
  patch,
  layout = 'stack',
}: ControlProps & { layout?: 'stack' | 'two-column' }) {
  const twoColumn = layout === 'two-column';
  const note = <p className="text-xs text-[var(--color-text-muted)]">Batching fixed at Tables of 8.</p>;
  const budget = (
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
  );
  const campaign = (
    <RadioGroup
      label="Campaign type"
      value={config.adCampaign}
      options={CAMPAIGNS}
      onChange={(v) => patch({ adCampaign: v })}
      columns={twoColumn ? 2 : 1}
    />
  );
  const opening = (
    <RadioGroup
      label="Opening time"
      value={String(config.openingTime)}
      options={OPENINGS}
      onChange={(v) => patch({ openingTime: Number(v) })}
      columns={3}
    />
  );

  if (twoColumn) {
    return (
      <div className="space-y-4">
        {note}
        <div className="grid grid-cols-2 gap-x-8">
          <div className="space-y-5">
            {budget}
            {opening}
          </div>
          <div>{campaign}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {note}
      {budget}
      {campaign}
      {opening}
    </div>
  );
}
