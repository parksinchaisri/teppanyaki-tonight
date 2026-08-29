// Static metadata for the six challenges: order, titles, descriptions, default
// configs, and reflection questions. The challenge components consume this.

import { defaultConfig } from '../engine/simulation';
import type { ParamOverrides, SimConfig } from '../engine/types';

export type ParamDefaults = Pick<ParamOverrides, 'defaultBarSeats' | 'defaultTables'>;

export interface ChallengeDef {
  key: string;
  index: number; // 1-based, for the sub-tab label
  shortLabel: string;
  title: string;
  description: string;
  reflectionQuestion: string;
  makeDefault: (paramDefaults?: ParamDefaults) => SimConfig;
}

export const CHALLENGES: ChallengeDef[] = [
  {
    key: 'batching',
    index: 1,
    shortLabel: 'Batching',
    title: 'Batching Dining Room Customers',
    description:
      'Your dining room seats guests in groups at chef-staffed teppanyaki tables. Tonight, decide whether to hold back bar customers until a full table of eight is assembled, or seat each party as soon as a table is free. How does this seemingly small policy change affect what your chefs actually do all evening?',
    reflectionQuestion:
      'How does batching change the relationship between bar wait time and the dining room? Where do the throughput gains actually come from?',
    makeDefault: (pd) => defaultConfig({ batching: { early: 'eight', peak: 'eight', late: 'eight' } }, pd),
  },
  {
    key: 'barSize',
    index: 2,
    shortLabel: 'Bar Size',
    title: 'Design the Bar',
    description:
      'Your bar holds waiting customers and earns drink revenue while they wait. Expanding it costs you dining tables — every eight bar seats you add removes one table from the dining room. Find the size that maximises total evening profit.',
    reflectionQuestion:
      'What role does the bar play in the operation beyond serving drinks? What is the actual cost of making it larger?',
    makeDefault: (pd) => defaultConfig({ batching: { early: 'eight', peak: 'eight', late: 'eight' }, barSeats: 39, tables: 16 }, pd),
  },
  {
    key: 'diningTime',
    index: 3,
    shortLabel: 'Dining Time',
    title: 'Change Dining Time',
    description:
      'Shorter teppanyaki seatings turn tables faster — but the value of a faster turn depends on whether anyone is waiting. Tune the average dining time for each part of the evening and find out when speed actually pays.',
    reflectionQuestion: 'Does it pay to shorten dining time? Does your answer depend on which period you target?',
    makeDefault: (pd) => defaultConfig({ batching: { early: 'eight', peak: 'eight', late: 'eight' } }, pd),
  },
  {
    key: 'advertising',
    index: 4,
    shortLabel: 'Advertising',
    title: 'Boost Demand with Advertising',
    description:
      'Advertising brings more guests through the door — but more demand is only worth something if you can seat it, and a bigger bet brings a wider range of outcomes. Choose a budget, a campaign, and an opening time.',
    reflectionQuestion:
      'How do your advertising choices affect the variability of outcomes — not just the average? What are the operational consequences of higher demand variability?',
    makeDefault: (pd) => defaultConfig({ batching: { early: 'eight', peak: 'eight', late: 'eight' } }, pd),
  },
  {
    key: 'advancedBatching',
    index: 5,
    shortLabel: 'Advanced Batching',
    title: 'Use Different Batching at Different Times',
    description:
      'Demand is not constant through the night. Set a different batching policy for the early, peak, and late periods, and find a schedule that beats any single fixed policy.',
    reflectionQuestion:
      'Which batching policy is appropriate at which time of day? What does customising the policy by period actually buy you?',
    makeDefault: (pd) => defaultConfig({ batching: { early: 'none', peak: 'eight', late: 'four_to_eight' } }, pd),
  },
  {
    key: 'finalChallenge',
    index: 6,
    shortLabel: 'Final Challenge',
    title: 'Design Your Best Strategy',
    description:
      'Everything is on the table. Combine batching, bar size, dining time, and advertising into the single best operating plan you can find. The leaderboard is watching.',
    reflectionQuestion:
      'How does your best configuration balance demand variability and process variability? Which single decision had the largest impact on profit?',
    makeDefault: (pd) => defaultConfig({ batching: { early: 'none', peak: 'eight', late: 'four_to_eight' } }, pd),
  },
];

export const CHALLENGE_BY_KEY: Record<string, ChallengeDef> = Object.fromEntries(
  CHALLENGES.map((c) => [c.key, c]),
);

export function challengeLabel(key: string): string {
  return CHALLENGE_BY_KEY[key]?.title ?? key;
}
