// Static debrief content, one entry per challenge, each holding an ordered list
// of screens. Local like the challenge descriptions, not fetched.
//
// Genericized deliberately: "the restaurant", never a brand or an owner's name,
// since this is projected in front of the class.

import type { LittleLawConfig } from './LittleLawStrip';

export type DebriefVisualKey =
  | 'batchingFragmentation'
  | 'barBufferCurve'
  | 'variabilityTypes'
  | 'diningTimeClock'
  | 'advertisingDemand'
  | 'dynamicTimeline'
  | 'optimizingWhat'
  | 'systemNodes'
  | 'synthesisBands';

export interface DebriefScreen {
  title: string; // the "big idea" headline
  visual: DebriefVisualKey;
  landingLine: string; // one short takeaway
  askTheClass: string; // open discussion question, no answer shown
  // Required, so every screen must state which term of R = I / T it is about.
  littleLaw: LittleLawConfig;
}

export interface DebriefContent {
  challengeKey: string;
  screens: DebriefScreen[]; // 1–3
}

export const DEBRIEFS: DebriefContent[] = [
  {
    challengeKey: 'batching',
    screens: [
      {
        title: 'Variability Can Waste Capacity Even When Demand Is High',
        visual: 'batchingFragmentation',
        landingLine:
          'The problem is not insufficient demand. It is demand arriving in the wrong-sized chunks.',
        askTheClass: 'Demand was high in both cases. So why did one system fail to use its tables?',
        littleLaw: { highlight: ['I'], caption: 'Batching does not add seats. It keeps the seats we own productively occupied.' },
      },
    ],
  },
  {
    challengeKey: 'barSize',
    screens: [
      {
        title: 'A Buffer Is Valuable Only If the Process Knows How to Use It',
        visual: 'barBufferCurve',
        landingLine: 'The bar and the batching policy are complements.',
        askTheClass: 'What makes a bar seat productive? And why can a large bar be bad?',
        littleLaw: { highlight: ['I'], caption: 'The bar sits outside this boundary. Its job is to protect I.' },
      },
    ],
  },
  {
    challengeKey: 'diningTime',
    screens: [
      {
        title: 'This Time, We Are Changing the Process',
        visual: 'variabilityTypes',
        landingLine: 'Challenges 1 and 2 protect I. Challenge 3 changes T.',
        askTheClass: 'How do you shorten a meal without ever telling a customer to hurry?',
        littleLaw: { highlight: ['I', 'T'], caption: 'Challenges 1 and 2 protect I. This one changes T.' },
      },
      {
        title: 'Faster Creates Capacity. Capacity Creates Value Only When Demand Can Use It.',
        visual: 'diningTimeClock',
        landingLine: 'An idle table at 9pm is not a capacity problem.',
        askTheClass: 'Did faster service help equally throughout the evening, or only during part of it?',
        littleLaw: { highlight: ['T'], caption: 'Same seats, less time each — more output.' },
      },
    ],
  },
  {
    challengeKey: 'advertising',
    screens: [
      {
        title: 'More Demand Is Not the Same as Better Demand',
        visual: 'advertisingDemand',
        landingLine: 'An empty table-hour at 5:30 cannot be stored and used at 8:00.',
        askTheClass: 'What good is another 8pm customer if the dining room is already full?',
        littleLaw: { highlight: ['R'], caption: 'The equation assumes customers are there to fill the seats. Marketing decides whether they are.' },
      },
    ],
  },
  {
    challengeKey: 'advancedBatching',
    screens: [
      {
        title: 'The Best Rule Changes With the System',
        visual: 'dynamicTimeline',
        landingLine: 'Same restaurant. Different state. Different policy.',
        askTheClass: "'Be flexible' is not an operating policy. What measurable trigger would you actually use?",
        littleLaw: { highlight: [], muted: true, caption: 'The equation is static. The restaurant is not.' },
      },
    ],
  },
  {
    challengeKey: 'finalChallenge',
    screens: [
      {
        title: 'What Are You Actually Optimizing?',
        visual: 'optimizingWhat',
        landingLine: 'High utilization is not the same as high profit.',
        askTheClass: 'Would your best strategy change if I paid you for throughput instead of profit?',
        littleLaw: { highlight: ['R'], strikethrough: ['R'], caption: 'Maximizing R is not the objective.' },
      },
      {
        title: 'There Is No Best Lever. There Is a Best System.',
        visual: 'systemNodes',
        landingLine: 'The value of each decision depends on all the others.',
        askTheClass:
          'Pick two strategies with similar results but different choices. Which single change would have broken one of them if applied to the other?',
        littleLaw: { highlight: ['I', 'T'], caption: 'Every lever moves I, T, or whether either one matters.' },
      },
      {
        title: 'What Were We Really Managing?',
        visual: 'synthesisBands',
        landingLine:
          'Process analysis tells us what moves flow. Management tells us which flow is worth creating.',
        askTheClass: 'Which single lever would you protect if you could only keep one?',
        littleLaw: {
          highlight: ['R', 'I', 'T'],
          caption: "Little's Law gives the static levers. Process Dynamics operates them under changing demand.",
        },
      },
    ],
  },
];

export function debriefFor(challengeKey: string | null): DebriefContent | null {
  if (!challengeKey) return null;
  const found = DEBRIEFS.find((d) => d.challengeKey === challengeKey);
  // A challenge with no screens is treated as having no content, so the Debrief
  // tab stays hidden rather than rendering an empty view.
  return found && found.screens.length > 0 ? found : null;
}
