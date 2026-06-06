// Core discrete-event simulation engine + run entry points.

import { PARAMS } from './params';
import { mulberry32, randExponential, randNormalBoxMuller } from './prng';
import { generateArrivals, type ArrivalSchedule } from './arrival';
import { CHALLENGE_SEEDS } from './seeds';
import type {
  AdCampaign,
  BatchingMode,
  ChallengeResult,
  ParamOverrides,
  Party,
  PeriodBatching,
  RunStats,
  SimConfig,
  SimEvent,
  TableState,
} from './types';

// Build an effective parameter set by merging per-class overrides onto PARAMS.
// Margins are stored directly by the instructor; we hold prices fixed and derive
// the variable cost so that (price - varCost) equals the requested margin.
function effectiveParams(o?: ParamOverrides) {
  const dinnerMargin = o?.dinnerMargin ?? PARAMS.DINNER_PRICE - PARAMS.DINNER_VAR_COST;
  const drinkMargin = o?.drinkMargin ?? PARAMS.DRINK_PRICE - PARAMS.DRINK_VAR_COST;
  return {
    ...PARAMS,
    DINNER_VAR_COST: PARAMS.DINNER_PRICE - dinnerMargin,
    DRINK_VAR_COST: PARAMS.DRINK_PRICE - drinkMargin,
    FIXED_COST_EVENING: o?.fixedCostEvening ?? PARAMS.FIXED_COST_EVENING,
    PATIENCE_MEAN: o?.patienceMean ?? PARAMS.PATIENCE_MEAN,
  };
}

// Derive dining-table count from bar-seat count. The first step is intentionally
// asymmetric (1 extra seat removes a table), then bands of 8:
//   15→19, 16-23→18, 24-31→17, 32-39→16, 40-47→15, 48-55→14,
//   56-63→13, 64-71→12, 72-79→11, 80-87→10
export function barSeatsToTables(barSeats: number): number {
  if (barSeats <= 15) return 19;
  return 18 - Math.floor((barSeats - 16) / 8);
}

// ── Advertising model ──────────────────────────────────────────────────────

// Overall demand multiplier given budget (diminishing returns curve).
export function advertisingMultiplier(budget: number): number {
  return budget <= 1
    ? 0.6 + 0.4 * budget
    : budget <= 2
      ? 1.0 + 0.25 * (budget - 1)
      : budget <= 3
        ? 1.25 + 0.15 * (budget - 2)
        : 1.4 + 0.08 * (budget - 3);
}

// Per-period rate multiplier for the selected campaign.
export function campaignShift(campaign: AdCampaign, minutesFromMidnight: number): number {
  const hour = minutesFromMidnight / 60;
  if (campaign === 'happy_hour') return hour < 19 ? 1.5 : 0.9;
  if (campaign === 'awareness') return 1.15; // flat boost across the day
  if (campaign === 'discount') return 1.25; // higher demand, lower margins (handled in profit)
  return 1.0;
}

// ── Schedule adjustment for opening time ────────────────────────────────────

function adjustedSchedule(config: SimConfig): ArrivalSchedule {
  const earlyPeriods = [
    { from: 300, to: 330, rate: 0.1 }, // 5:00–5:30
    { from: 330, to: 360, rate: 0.13 }, // 5:30–6:00
  ];
  let sched: Array<{ from: number; to: number; rate: number }> = [...PARAMS.ARRIVAL_SCHEDULE];
  if (config.openingTime <= 300) sched = [...earlyPeriods, ...sched];
  else if (config.openingTime < 360) sched = [earlyPeriods[1], ...sched];
  return sched.filter((p) => p.from >= config.openingTime) as unknown as ArrivalSchedule;
}

// ── Batching mode selection ─────────────────────────────────────────────────

export function getModeAtTime(batching: PeriodBatching, time: number): BatchingMode {
  if (time < 420) return batching.early; // before 7:00 PM
  if (time < 480) return batching.peak; // 7:00–8:00 PM
  return batching.late; // 8:00 PM → close
}

function getDiningDuration(rand: () => number, config: SimConfig, now: number): number {
  const target = now < 420 ? config.diningTimeEarly : now < 480 ? config.diningTimePeak : config.diningTimeLate;
  const raw = randNormalBoxMuller(rand, target, PARAMS.DINING_TIME_STD_DEV);
  return Math.max(PARAMS.DINING_TIME_MIN, Math.min(PARAMS.DINING_TIME_MAX, raw));
}

// ── Min-heap keyed on `time` ────────────────────────────────────────────────

interface SchedEvent {
  time: number;
  type: 'ARRIVE' | 'RENEGE' | 'DEPART' | 'CLOSE';
  partyId?: number;
  partySize?: number;
  tableId?: number;
  slot?: number;
  batchSize?: number;
}

class MinHeap {
  private items: SchedEvent[] = [];
  get size() {
    return this.items.length;
  }
  isEmpty() {
    return this.items.length === 0;
  }
  push(ev: SchedEvent) {
    const a = this.items;
    a.push(ev);
    let i = a.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (a[parent].time <= a[i].time) break;
      [a[parent], a[i]] = [a[i], a[parent]];
      i = parent;
    }
  }
  pop(): SchedEvent {
    const a = this.items;
    const top = a[0];
    const last = a.pop()!;
    if (a.length > 0) {
      a[0] = last;
      let i = 0;
      const n = a.length;
      for (;;) {
        const l = 2 * i + 1;
        const r = 2 * i + 2;
        let smallest = i;
        if (l < n && a[l].time < a[smallest].time) smallest = l;
        if (r < n && a[r].time < a[smallest].time) smallest = r;
        if (smallest === i) break;
        [a[smallest], a[i]] = [a[i], a[smallest]];
        i = smallest;
      }
    }
    return top;
  }
}

// ── Core single-run simulation ──────────────────────────────────────────────

export function runSimulation(config: SimConfig, seed: number, overrides?: ParamOverrides): RunStats {
  const rand = mulberry32(seed);
  const P = effectiveParams(overrides);
  // Strict batching: in 'eight' mode, never force-seat a partial table under time
  // pressure — only seat once a full batch (≥6) naturally accumulates. Off by
  // default in the engine so the calibration test script keeps the lenient behaviour.
  const strictBatching = overrides?.strictBatching ?? false;

  // Advertising effects on demand. The ad-driven portion of demand is uncertain:
  // a per-run multiplicative noise term makes a bigger ad bet a riskier bet, so
  // higher budgets widen the spread of outcomes (not just the mean). At budget 1.0
  // (baseMult = 1.0) the noise has no effect, keeping non-ad challenges clean.
  const baseMult = advertisingMultiplier(config.adBudget);
  const adNoise = randNormalBoxMuller(rand, 1, 0.2);
  const demandMult = Math.max(0.2, 1 + (baseMult - 1) * adNoise);
  const arrivals = generateArrivals(rand, adjustedSchedule(config), demandMult, (t) =>
    campaignShift(config.adCampaign, t),
  );

  const openTime = config.openingTime;
  const barCapacity = config.barSeats;

  // Always exactly `config.tables` physical tables — never doubled. four_share is
  // handled per-seating-event (a table splits into two independent 4-seat slots
  // only while that period's mode is four_share), not by reconfiguring the room.
  const barQueue: Party[] = [];
  const tables: TableState[] = Array.from({ length: config.tables }, (_, i) => ({
    id: i,
    slot0OccupiedUntil: openTime,
    slot1OccupiedUntil: openTime,
    turns: 0,
  }));

  const events: SimEvent[] = [];

  let dinnersServed = 0;
  let drinksServed = 0;
  let lostCustomers = 0;
  let balkCount = 0;
  let renegeCount = 0;
  let emptyChairHours = 0;
  let occupiedSeatMinutes = 0; // covers × dining-minutes — drives seat-based utilisation
  let totalSeatedWait = 0;
  let seatedPartyCount = 0;

  const pq = new MinHeap();
  arrivals.forEach((a, i) => pq.push({ time: a.time, type: 'ARRIVE', partyId: i, partySize: a.partySize }));
  pq.push({ time: PARAMS.CLOSE_TIME, type: 'CLOSE' });

  let barOpen = true;

  // Attempt to seat one group at (tableId, slot) with the given capacity / minimum
  // batch / mode. Commits the batch and schedules its departure. Returns the depart
  // time if a group was seated, otherwise null (and consumes no randomness).
  function seatGroup(
    now: number,
    tableId: number,
    slot: number,
    capacity: number,
    minBatch: number,
    mode: BatchingMode,
  ): number | null {
    if (barQueue.length === 0) return null;

    // Greedy front-of-queue fill, never splitting a party, never exceeding capacity.
    const batch: Party[] = [];
    let batchSize = 0;
    for (const party of barQueue) {
      if (batchSize + party.size <= capacity) {
        batch.push(party);
        batchSize += party.size;
      }
      if (mode === 'none') break; // only one party per table when not batching
    }

    if (batchSize < minBatch) {
      if (mode === 'eight' && !strictBatching) {
        // Time-pressure override: only hold the table if the oldest waiter is still patient.
        const oldestWait = now - barQueue[0].arrivalTime;
        if (oldestWait < P.PATIENCE_MEAN) return null;
        if (batch.length === 0) return null; // nothing to seat even under pressure
      } else {
        // Strict (or non-eight modes): keep waiting for a full batch.
        return null;
      }
    }

    // Commit the batch: remove from bar, tally waiting drinks.
    for (const p of batch) {
      const idx = barQueue.indexOf(p);
      barQueue.splice(idx, 1);
      const waitMinutes = now - p.arrivalTime;
      const additionalDrinks = p.size * Math.floor(waitMinutes * P.DRINK_RATE_PER_MIN);
      p.drinksConsumed += additionalDrinks;
      drinksServed += additionalDrinks;
      totalSeatedWait += waitMinutes;
      seatedPartyCount += 1;
      // Renege event still sits in the heap; the RENEGE handler treats it as a
      // no-op because the party is no longer in barQueue.
    }

    const diningDuration = getDiningDuration(rand, config, now);
    const departTime = now + diningDuration;
    const fourShare = mode === 'four_share';

    emptyChairHours += (capacity - batchSize) * (diningDuration / 60);
    occupiedSeatMinutes += batchSize * diningDuration;
    dinnersServed += batchSize; // revenue commits at seating

    pq.push({ time: departTime, type: 'DEPART', tableId, slot, partySize: batchSize, partyId: batch[0].id });
    events.push({
      time: now,
      type: 'SEAT_DINING',
      partyId: batch[0].id,
      partySize: batchSize,
      tableId,
      slot,
      fourShare,
      batchSize,
      description: `Batch of ${batchSize} seated at table ${tableId + 1}`,
      drinksConsumed: 0,
    });
    return departTime;
  }

  function trySeatBatch(now: number) {
    const mode = getModeAtTime(config.batching, now);
    for (const table of tables) {
      if (barQueue.length === 0) break;

      if (mode === 'four_share') {
        // Two independent 4-seat slots, each free when its timer has elapsed.
        const bothFree = table.slot0OccupiedUntil <= now && table.slot1OccupiedUntil <= now;
        // A party too big for a 4-slot takes the whole table (both slots) — small
        // groups still share, big groups still fit. Without this, parties of 5–8
        // could never be seated under four_share and would all renege.
        if (bothFree && barQueue.length > 0 && barQueue[0].size > 4) {
          const dt = seatGroup(now, table.id, 0, P.TABLE_CAPACITY, 4, 'four_to_eight');
          if (dt != null) {
            table.slot0OccupiedUntil = dt;
            table.slot1OccupiedUntil = dt;
            table.turns += 1;
            continue;
          }
        }
        if (table.slot0OccupiedUntil <= now) {
          const dt = seatGroup(now, table.id, 0, 4, 4, mode);
          if (dt != null) {
            table.slot0OccupiedUntil = dt;
            table.turns += 1;
          }
        }
        if (barQueue.length === 0) break;
        if (table.slot1OccupiedUntil <= now) {
          const dt = seatGroup(now, table.id, 1, 4, 4, mode);
          if (dt != null) {
            table.slot1OccupiedUntil = dt;
            table.turns += 1;
          }
        }
      } else {
        // Whole table is one 8-seat unit; both slots move together.
        if (table.slot0OccupiedUntil > now) continue;
        const minBatch = mode === 'none' ? 1 : mode === 'four_to_eight' ? 4 : 6;
        const dt = seatGroup(now, table.id, 0, P.TABLE_CAPACITY, minBatch, mode);
        if (dt != null) {
          table.slot0OccupiedUntil = dt;
          table.slot1OccupiedUntil = dt;
          table.turns += 1;
        }
      }
    }
  }

  let partyIdCounter = arrivals.length; // ids beyond arrival indices, if ever needed

  while (!pq.isEmpty()) {
    const ev = pq.pop();

    if (ev.type === 'CLOSE') {
      barOpen = false;
      continue;
    }

    if (ev.type === 'ARRIVE') {
      if (!barOpen) continue;
      const barOccupancy = barQueue.reduce((s, p) => s + p.size, 0);
      const size = ev.partySize!;
      if (barOccupancy + size > barCapacity) {
        balkCount += size;
        lostCustomers += size;
        events.push({
          time: ev.time,
          type: 'BALK',
          partyId: ev.partyId!,
          partySize: size,
          description: `Party of ${size} turned away (bar full)`,
        });
      } else {
        const patience = randExponential(rand, P.PATIENCE_MEAN);
        const party: Party = {
          id: ev.partyId ?? partyIdCounter++,
          size,
          arrivalTime: ev.time,
          renegeTime: ev.time + patience,
          drinksConsumed: size, // immediate first drink per person
        };
        barQueue.push(party);
        drinksServed += size;
        pq.push({ time: party.renegeTime, type: 'RENEGE', partyId: party.id });
        events.push({
          time: ev.time,
          type: 'ENTER_BAR',
          partyId: party.id,
          partySize: size,
          description: `Party of ${size} entered bar`,
          drinksConsumed: size,
        });
      }
      trySeatBatch(ev.time);
      continue;
    }

    if (ev.type === 'RENEGE') {
      const idx = barQueue.findIndex((p) => p.id === ev.partyId);
      if (idx === -1) continue; // already seated — no-op
      const party = barQueue.splice(idx, 1)[0];
      const waitMinutes = ev.time - party.arrivalTime;
      const additionalDrinks = party.size * Math.floor(waitMinutes * PARAMS.DRINK_RATE_PER_MIN);
      party.drinksConsumed += additionalDrinks;
      drinksServed += additionalDrinks;
      renegeCount += party.size;
      lostCustomers += party.size;
      events.push({
        time: ev.time,
        type: 'RENEGE',
        partyId: party.id,
        partySize: party.size,
        description: `Party of ${party.size} gave up after ${waitMinutes.toFixed(0)} min wait`,
        drinksConsumed: additionalDrinks,
      });
      continue;
    }

    if (ev.type === 'DEPART') {
      events.push({
        time: ev.time,
        type: 'DEPART',
        partyId: ev.partyId!,
        partySize: ev.partySize!,
        tableId: ev.tableId,
        slot: ev.slot,
        description: `Party of ${ev.partySize} finished dinner at table ${(ev.tableId ?? 0) + 1}`,
      });
      // A freed table may seat another batch (even after close, to serve waiting guests).
      trySeatBatch(ev.time);
      continue;
    }
  }

  events.sort((a, b) => a.time - b.time);

  // ── Operational stats ─────────────────────────────────────────────────────
  const totalOpenMinutes = PARAMS.CLOSE_TIME - openTime;
  // Chef utilisation is SEAT-based: what fraction of the chef's seat-capacity was
  // actually filled with diners. A half-empty 8-top counts as half-utilised — this
  // is the core lesson (batching to fill tables raises real chef utilisation). The
  // physical capacity is always tables × 8 seats (four_share splits those same
  // seats into 4+4, it does not add any).
  const totalSeatMinutes = config.tables * PARAMS.TABLE_CAPACITY * totalOpenMinutes;
  const chefUtilisation = Math.min(1, occupiedSeatMinutes / totalSeatMinutes);
  const avgTableTurns = tables.reduce((s, t) => s + t.turns, 0) / config.tables;
  const avgBarWaitMinutes = seatedPartyCount > 0 ? totalSeatedWait / seatedPartyCount : 0;

  // ── Financial ─────────────────────────────────────────────────────────────
  const discountReduction = config.adCampaign === 'discount' ? P.DISCOUNT_DINNER_MARGIN_REDUCTION : 0;
  const dinnerMargin = P.DINNER_PRICE - P.DINNER_VAR_COST - discountReduction;
  const drinkMargin = P.DRINK_PRICE - P.DRINK_VAR_COST;
  const revenue = dinnersServed * P.DINNER_PRICE + drinksServed * P.DRINK_PRICE;
  const variableCost = dinnersServed * P.DINNER_VAR_COST + drinksServed * P.DRINK_VAR_COST;
  const advertisingCost = config.adBudget * P.AD_COST_PER_UNIT;
  const fixedCost = P.FIXED_COST_EVENING;
  const profit = dinnersServed * dinnerMargin + drinksServed * drinkMargin - advertisingCost - fixedCost;

  const stats: RunStats = {
    dinnersServed,
    drinksServed,
    lostCustomers,
    revenue,
    variableCost,
    fixedCost,
    advertisingCost,
    profit,
    chefUtilisation,
    emptyChairHours,
    avgTableTurns,
    avgBarWaitMinutes,
    balkCount,
    renegeCount,
    timeseries: buildTimeseries(events, openTime, config.tables, PARAMS.TABLE_CAPACITY),
    events,
  };
  return stats;
}

// ── Timeseries construction (5-minute sampling) ─────────────────────────────

function buildTimeseries(events: SimEvent[], openTime: number, effectiveTables: number, stationCapacity: number) {
  const GRID_END = 690; // sample through ~11:30 PM so dining can empty out
  const STEP = 5;
  const time: number[] = [];
  const barOccupancy: number[] = [];
  const diningOccupancy: number[] = [];
  const lostCumulative: number[] = [];
  const drinksCumulative: number[] = [];
  const dinnersCumulative: number[] = [];
  const chefUtilCumulative: number[] = [];

  let ei = 0;
  let bar = 0;
  let dining = 0;
  let lost = 0;
  let drinks = 0;
  let dinners = 0;
  let seatMinutesAccum = 0; // integral of seated diners over time
  let lastT = openTime;

  for (let t = openTime; t <= GRID_END; t += STEP) {
    // Integrate seated-diner area over [lastT, t] before applying this window's events.
    seatMinutesAccum += dining * (t - lastT);
    lastT = t;

    while (ei < events.length && events[ei].time <= t) {
      const e = events[ei++];
      switch (e.type) {
        case 'ENTER_BAR':
          bar += e.partySize;
          drinks += e.drinksConsumed ?? 0;
          break;
        case 'BALK':
          lost += e.partySize;
          break;
        case 'RENEGE':
          bar -= e.partySize;
          lost += e.partySize;
          drinks += e.drinksConsumed ?? 0;
          break;
        case 'SEAT_DINING':
          bar -= e.batchSize ?? e.partySize;
          dining += e.batchSize ?? e.partySize;
          dinners += e.batchSize ?? e.partySize;
          break;
        case 'DEPART':
          dining -= e.partySize;
          break;
      }
    }

    const elapsed = t - openTime;
    const util = elapsed > 0 ? seatMinutesAccum / (effectiveTables * stationCapacity * elapsed) : 0;
    time.push(t);
    barOccupancy.push(Math.max(0, bar));
    diningOccupancy.push(Math.max(0, dining));
    lostCumulative.push(lost);
    drinksCumulative.push(drinks);
    dinnersCumulative.push(dinners);
    chefUtilCumulative.push(Math.min(1, Math.max(0, util)));
  }

  return { time, barOccupancy, diningOccupancy, lostCumulative, drinksCumulative, dinnersCumulative, chefUtilCumulative };
}

// ── 20-replication runner ───────────────────────────────────────────────────

function mean(xs: number[]): number {
  return xs.reduce((s, x) => s + x, 0) / xs.length;
}

export function runChallenge(config: SimConfig, challengeKey: string, overrides?: ParamOverrides): ChallengeResult {
  const seeds = CHALLENGE_SEEDS[challengeKey] ?? CHALLENGE_SEEDS.batching;
  const runs = seeds.map((seed) => runSimulation(config, seed, overrides));
  return {
    config,
    runs,
    avgProfit: mean(runs.map((r) => r.profit)),
    maxProfit: Math.max(...runs.map((r) => r.profit)),
    minProfit: Math.min(...runs.map((r) => r.profit)),
    avgLost: mean(runs.map((r) => r.lostCustomers)),
    avgChefUtil: mean(runs.map((r) => r.chefUtilisation)),
    avgEmptyChairHours: mean(runs.map((r) => r.emptyChairHours)),
  };
}

// Default config factory shared by challenges. `paramDefaults` lets a class supply
// its own default bar-seat / table counts (from per-class param overrides).
export function defaultConfig(
  overrides: Partial<SimConfig> = {},
  paramDefaults?: Pick<ParamOverrides, 'defaultBarSeats' | 'defaultTables'>,
): SimConfig {
  return {
    batching: { early: 'eight', peak: 'eight', late: 'eight' },
    barSeats: paramDefaults?.defaultBarSeats ?? PARAMS.DEFAULT_BAR_SEATS,
    tables: paramDefaults?.defaultTables ?? PARAMS.DEFAULT_TABLES,
    diningTimeEarly: PARAMS.DINING_TIME_DEFAULT,
    diningTimePeak: PARAMS.DINING_TIME_DEFAULT,
    diningTimeLate: PARAMS.DINING_TIME_DEFAULT,
    adBudget: 1.0,
    adCampaign: 'none',
    openingTime: PARAMS.OPEN_TIME_DEFAULT,
    ...overrides,
  };
}
