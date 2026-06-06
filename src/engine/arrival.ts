// Time-varying Poisson arrival generator.
// Generates all arrivals for the evening upfront before the event loop.

import { PARAMS } from './params';
import { randExponential, randDiscreteCDF } from './prng';

export type ArrivalSchedule = typeof PARAMS.ARRIVAL_SCHEDULE;

export function generateArrivals(
  rand: () => number,
  schedule: ArrivalSchedule,
  demandMultiplier: number,
  campaignShift: (t: number) => number,
): Array<{ time: number; partySize: number }> {
  const arrivals: Array<{ time: number; partySize: number }> = [];

  for (const period of schedule) {
    const effectiveRate = period.rate * demandMultiplier * campaignShift(period.from);
    if (effectiveRate <= 0) continue;
    let t = period.from;
    while (t < period.to) {
      t += randExponential(rand, 1 / effectiveRate);
      if (t >= period.to) break;
      const size = randDiscreteCDF(rand, PARAMS.PARTY_SIZE_CDF as unknown as number[]);
      arrivals.push({ time: t, partySize: size });
    }
  }

  return arrivals.sort((a, b) => a.time - b.time);
}
