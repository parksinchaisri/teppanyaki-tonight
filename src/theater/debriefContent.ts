// Static debrief content, one entry per challenge, each holding an ordered list
// of screens. Local like the challenge descriptions, not fetched.
//
// Genericized deliberately: "the restaurant", never a brand or an owner's name,
// since this is projected in front of the class.

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
      },
    ],
  },
  {
    challengeKey: 'diningTime',
    screens: [
      {
        title: 'This Time, We Are Changing the Process',
        visual: 'variabilityTypes',
        landingLine: 'Different kinds of variability need different levers.',
        askTheClass: 'How do you shorten a meal without ever telling a customer to hurry?',
      },
      {
        title: 'Faster Creates Capacity. Capacity Creates Value Only When Demand Can Use It.',
        visual: 'diningTimeClock',
        landingLine: 'An idle table at 9pm is not a capacity problem.',
        askTheClass: 'Did faster service help equally throughout the evening, or only during part of it?',
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
      },
      {
        title: 'There Is No Best Lever. There Is a Best System.',
        visual: 'systemNodes',
        landingLine: 'The value of each decision depends on all the others.',
        askTheClass:
          'Pick two strategies with similar results but different choices. Which single change would have broken one of them if applied to the other?',
      },
      {
        title: 'What Were We Really Managing?',
        visual: 'synthesisBands',
        landingLine: 'Demand variability + process variability + operating policy → performance',
        askTheClass: 'Which single lever would you protect if you could only keep one?',
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
