// All TypeScript types for engine I/O.

// ── Configuration ────────────────────────────────────────────────────────────

export type BatchingMode =
  | 'none' // seat next party immediately, one party per table
  | 'four_to_eight' // seat when 4–8 people accumulated
  | 'eight' // seat only when ~8 people accumulated (strict)
  | 'four_share'; // split table into two independent 4-tops

export type AdCampaign = 'none' | 'awareness' | 'discount' | 'happy_hour';

export interface PeriodBatching {
  early: BatchingMode; // open → 7:00 PM
  peak: BatchingMode; // 7:00 PM → 8:00 PM
  late: BatchingMode; // 8:00 PM → close
}

// Per-class engine overrides (stored as the `params` map on the class document).
// All optional — absent fields fall back to PARAMS defaults.
export interface ParamOverrides {
  dinnerMargin?: number; // $/cover  (default 12)
  drinkMargin?: number; // $/drink  (default 6)
  fixedCostEvening?: number; // $        (default 3600)
  patienceMean?: number; // minutes  (default 28)
  defaultBarSeats?: number; // seats    (default 40)
  defaultTables?: number; // tables   (default 15)
  strictBatching?: boolean; // eight mode: no time-pressure partial seatings (default off in engine)
}

export interface SimConfig {
  // Batching (for simple challenges, use same mode for all periods)
  batching: PeriodBatching;

  // Capacity
  barSeats: number;
  tables: number; // derived from barSeats if using the trade-off slider

  // Dining time targets (minutes) by period
  diningTimeEarly: number;
  diningTimePeak: number;
  diningTimeLate: number;

  // Advertising
  adBudget: number; // 0.0 – 4.0
  adCampaign: AdCampaign;
  openingTime: number; // minutes from midnight: 300 (5pm), 360 (6pm), or 420 (7pm)
}

// ── Simulation Events ────────────────────────────────────────────────────────

export type EventType =
  | 'ARRIVE' // party arrives at entrance
  | 'ENTER_BAR' // party seated in bar
  | 'BALK' // arrived but bar full → lost immediately
  | 'RENEGE' // timed out waiting in bar → lost
  | 'SEAT_DINING' // batch seated at dining table
  | 'DEPART' // party completes dinner and leaves
  | 'BATCH_FORMED'; // informational: a batch of N people is ready to seat

export interface SimEvent {
  time: number; // minutes from midnight
  type: EventType;
  partyId: number;
  partySize: number;
  tableId?: number; // present for SEAT_DINING, DEPART
  slot?: number; // 0 or 1 — which half of the table (four_share splits a table into two slots)
  fourShare?: boolean; // true when this seating used a 4-capacity slot (four_share mode)
  batchSize?: number; // present for BATCH_FORMED, SEAT_DINING
  description: string; // human-readable
  drinksConsumed?: number;
}

// ── Run Output ───────────────────────────────────────────────────────────────

export interface RunStats {
  // Financial
  dinnersServed: number;
  drinksServed: number;
  lostCustomers: number;
  revenue: number;
  variableCost: number;
  fixedCost: number;
  advertisingCost: number;
  profit: number;

  // Operational (for utilisation meter)
  chefUtilisation: number; // 0–1; fraction of (tables × open_minutes) that had diners
  emptyChairHours: number; // total hours of empty chef-adjacent seats during occupied turns
  avgTableTurns: number; // average times each table was occupied
  avgBarWaitMinutes: number; // average minutes parties waited in bar before seating
  balkCount: number;
  renegeCount: number;

  // Time-series (5-minute intervals, index 0 = open time)
  timeseries: {
    time: number[]; // absolute minutes from midnight
    barOccupancy: number[]; // customers currently in bar
    diningOccupancy: number[]; // customers currently at tables
    lostCumulative: number[];
    drinksCumulative: number[];
    dinnersCumulative: number[];
    chefUtilCumulative: number[]; // running utilisation % at each snapshot
  };

  // Full event log (drives animation playback)
  events: SimEvent[];
}

export interface ChallengeResult {
  config: SimConfig;
  runs: RunStats[]; // length = 20
  avgProfit: number;
  maxProfit: number;
  minProfit: number;
  avgLost: number;
  avgChefUtil: number;
  avgEmptyChairHours: number;
}

// ── Internal engine state ────────────────────────────────────────────────────

export interface Party {
  id: number;
  size: number;
  arrivalTime: number;
  renegeTime: number;
  drinksConsumed: number;
}

export interface TableState {
  id: number;
  // Each physical table has two independent seating slots. In normal modes the
  // whole table is one 8-seat unit (both slots move together). In four_share mode
  // each slot is an independent 4-seat group.
  slot0OccupiedUntil: number;
  slot1OccupiedUntil: number;
  turns: number;
}
