// Engine verification script. Run with: npx tsx scripts/testEngine.ts
// Confirms the five pedagogical conclusions before any UI is built.

import { runChallenge, defaultConfig } from '../src/engine/simulation';
import type { BatchingMode, SimConfig } from '../src/engine/types';

function fmt(n: number): string {
  return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
}
function pct(n: number): string {
  return (n * 100).toFixed(1) + '%';
}
function uniformBatching(mode: BatchingMode): SimConfig['batching'] {
  return { early: mode, peak: mode, late: mode };
}

let failures = 0;
function check(label: string, pass: boolean, detail: string) {
  console.log(`  ${pass ? '✅' : '❌'} ${label} — ${detail}`);
  if (!pass) failures++;
}

console.log('\n=== Default config across all 6 challenges ===');
for (const key of ['batching', 'barSize', 'diningTime', 'advertising', 'advancedBatching', 'finalChallenge']) {
  const r = runChallenge(defaultConfig(), key);
  console.log(
    `  ${key.padEnd(18)} avgProfit $${fmt(r.avgProfit).padStart(6)}  ` +
      `util ${pct(r.avgChefUtil)}  lost ${r.avgLost.toFixed(1)}  ` +
      `range [$${fmt(r.minProfit)}, $${fmt(r.maxProfit)}]`,
  );
}

console.log('\n=== 1. Batching: eight beats none on profit AND utilisation ===');
{
  const on = runChallenge(defaultConfig({ batching: uniformBatching('eight') }), 'batching');
  const off = runChallenge(defaultConfig({ batching: uniformBatching('none') }), 'batching');
  console.log(`  eight: avgProfit $${fmt(on.avgProfit)}  util ${pct(on.avgChefUtil)}`);
  console.log(`  none : avgProfit $${fmt(off.avgProfit)}  util ${pct(off.avgChefUtil)}`);
  check('profit', on.avgProfit > off.avgProfit, `eight $${fmt(on.avgProfit)} > none $${fmt(off.avgProfit)}`);
  check('utilisation', on.avgChefUtil > off.avgChefUtil, `${pct(on.avgChefUtil)} > ${pct(off.avgChefUtil)}`);
  const lift = (on.avgProfit - off.avgProfit) / Math.abs(off.avgProfit);
  check('lift ≥ 30%', lift >= 0.3, `lift = ${pct(lift)}`);
}

console.log('\n=== 2. Bar Size: interior optimum (not min, not max) ===');
{
  const sizes = [15, 23, 31, 39, 47, 55, 63, 71, 79, 87];
  const profits = sizes.map((barSeats) => {
    const tables = 19 - Math.floor((barSeats - 15) / 8);
    const r = runChallenge(defaultConfig({ batching: uniformBatching('eight'), barSeats, tables }), 'barSize');
    return { barSeats, tables, profit: r.avgProfit };
  });
  profits.forEach((p) => console.log(`  bar ${String(p.barSeats).padStart(2)} (tables ${p.tables}): $${fmt(p.profit)}`));
  const best = profits.reduce((a, b) => (b.profit > a.profit ? b : a));
  check('peak is interior', best.barSeats !== 15 && best.barSeats !== 87, `peak at barSeats=${best.barSeats}`);
}

console.log('\n=== 3. Dining Time: shortening PEAK beats shortening early/late ===');
{
  const base = defaultConfig({ batching: uniformBatching('eight') });
  const baseline = runChallenge(base, 'diningTime').avgProfit;
  const cutEarly = runChallenge({ ...base, diningTimeEarly: 45 }, 'diningTime').avgProfit;
  const cutPeak = runChallenge({ ...base, diningTimePeak: 45 }, 'diningTime').avgProfit;
  const cutLate = runChallenge({ ...base, diningTimeLate: 45 }, 'diningTime').avgProfit;
  console.log(`  baseline (60/60/60): $${fmt(baseline)}`);
  console.log(`  cut early→45:  Δ $${fmt(cutEarly - baseline)}`);
  console.log(`  cut peak →45:  Δ $${fmt(cutPeak - baseline)}`);
  console.log(`  cut late →45:  Δ $${fmt(cutLate - baseline)}`);
  check(
    'peak has largest impact',
    cutPeak - baseline > cutEarly - baseline && cutPeak - baseline > cutLate - baseline,
    `peak Δ$${fmt(cutPeak - baseline)} vs early Δ$${fmt(cutEarly - baseline)}, late Δ$${fmt(cutLate - baseline)}`,
  );
}

console.log('\n=== 4. Advertising: higher budget increases profit variance ===');
{
  function stdev(key: string, budget: number): number {
    const r = runChallenge(defaultConfig({ batching: uniformBatching('eight'), adBudget: budget }), 'advertising');
    const m = r.avgProfit;
    const v = r.runs.reduce((s, run) => s + (run.profit - m) ** 2, 0) / r.runs.length;
    return Math.sqrt(v);
  }
  const low = stdev('advertising', 0.5);
  const high = stdev('advertising', 3.5);
  console.log(`  stdev @ budget 0.5: $${fmt(low)}`);
  console.log(`  stdev @ budget 3.5: $${fmt(high)}`);
  check('higher budget → higher stdev', high > low, `$${fmt(high)} > $${fmt(low)}`);
}

console.log('\n=== 5. Advanced Batching: time-varying beats uniform eight ===');
{
  const uniform = runChallenge(defaultConfig({ batching: uniformBatching('eight') }), 'advancedBatching');
  const varied = runChallenge(
    defaultConfig({ batching: { early: 'none', peak: 'eight', late: 'four_to_eight' } }),
    'advancedBatching',
  );
  console.log(`  uniform eight:               $${fmt(uniform.avgProfit)}`);
  console.log(`  none/eight/four_to_eight:    $${fmt(varied.avgProfit)}`);
  check('time-varying wins', varied.avgProfit > uniform.avgProfit, `$${fmt(varied.avgProfit)} > $${fmt(uniform.avgProfit)}`);
}

console.log('\n=== Calibration: default (eight) avgProfit in $800–$1,600 ===');
{
  const r = runChallenge(defaultConfig({ batching: uniformBatching('eight') }), 'batching');
  check('in band', r.avgProfit >= 800 && r.avgProfit <= 1600, `$${fmt(r.avgProfit)}`);
}

console.log(`\n${failures === 0 ? '🎉 ALL CHECKS PASSED' : `⚠️  ${failures} CHECK(S) FAILED`}\n`);
process.exit(failures === 0 ? 0 : 1);
