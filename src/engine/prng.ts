// Seeded pseudo-random number generator (mulberry32) and distribution helpers.
// Deterministic and fast — every student gets identical demand scenarios per seed.

export function mulberry32(seed: number): () => number {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Exponential distribution with the given mean.
export function randExponential(rand: () => number, mean: number): number {
  return -mean * Math.log(1 - rand());
}

// Normal distribution via Box–Muller transform.
export function randNormalBoxMuller(rand: () => number, mean: number, std: number): number {
  const u1 = rand();
  const u2 = rand();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + std * z;
}

// Draw a 1-indexed discrete value from a cumulative distribution function.
export function randDiscreteCDF(rand: () => number, cdf: number[]): number {
  const u = rand();
  const idx = cdf.findIndex((p) => u <= p);
  return (idx === -1 ? cdf.length - 1 : idx) + 1;
}
