// Static debrief content, one object per challenge — local like the challenge
// descriptions, not fetched. Genericized deliberately: "the restaurant", never a
// brand or an owner's name, since this is projected in front of the class.
//
// Advertising has no entry on purpose. A challenge without content simply shows
// no Debrief tab.

export type DebriefVisualKey =
  | 'batching'
  | 'barSize'
  | 'diningTime'
  | 'advancedBatching'
  | 'finalChallenge';

export interface DebriefContent {
  challengeKey: string;
  title: string; // the "big idea" headline
  visual: DebriefVisualKey; // which bespoke visual to render
  landingLine: string; // one short takeaway
  askTheClass: string; // open discussion question, no answer shown
}

export const DEBRIEFS: DebriefContent[] = [
  {
    challengeKey: 'batching',
    title: 'A Half-Full Table Still Uses a Full Chef Cycle',
    visual: 'batching',
    landingLine: 'The scarce resource is the chef cycle — not just the empty chair.',
    askTheClass: 'When is the capacity gained from batching worth the wait it creates?',
  },
  {
    challengeKey: 'barSize',
    title: 'The Bar Is Part of the Process',
    visual: 'barSize',
    landingLine: 'A buffer can protect a constrained resource — but the buffer itself is not free.',
    askTheClass:
      'Who increased the buffer and improved batching, but eventually gave up too much dining capacity to do it?',
  },
  {
    challengeKey: 'diningTime',
    title: 'Faster Service Creates Capacity. But Is Capacity Always Valuable?',
    visual: 'diningTime',
    landingLine: 'Capacity is valuable only when demand wants to use it.',
    askTheClass: 'Did faster service help equally throughout the evening, or only some of it?',
  },
  {
    challengeKey: 'advancedBatching',
    title: 'The Best Rule Changes With the System',
    visual: 'advancedBatching',
    landingLine: 'Same restaurant. Different state. Different policy.',
    askTheClass:
      'What single number would you want to check before deciding whether to change the seating rule right now?',
  },
  {
    challengeKey: 'finalChallenge',
    title: 'There Is No Best Lever. There Is a Best System.',
    visual: 'finalChallenge',
    landingLine: 'The value of each decision depends on all the others.',
    askTheClass:
      'Pick two strategies with similar results but different choices. Which single change would have broken one of them if applied to the other?',
  },
];

export function debriefFor(challengeKey: string | null): DebriefContent | null {
  if (!challengeKey) return null;
  return DEBRIEFS.find((d) => d.challengeKey === challengeKey) ?? null;
}
