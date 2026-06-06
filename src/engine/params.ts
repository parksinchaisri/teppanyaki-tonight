// All tunable constants — the single source of truth for calibration.
// Values produce average profits roughly in the $800–$1,600 band for a
// well-configured restaurant (batching=eight, 40 bar seats, 15 tables).

export const PARAMS = {
  // ── Restaurant ──────────────────────────────────────────────
  OPEN_TIME_DEFAULT: 360, // minutes from midnight (6:00 PM)
  CLOSE_TIME: 630, // 10:30 PM; no new arrivals after this
  SIM_END_TIME: 660, // 11:00 PM; final tallying cutoff
  TABLE_CAPACITY: 8, // seats per table (canonical)
  DEFAULT_TABLES: 15,
  DEFAULT_BAR_SEATS: 40,

  // ── Financial ───────────────────────────────────────────────
  DINNER_PRICE: 28,
  DINNER_VAR_COST: 16, // food + kitchen labour per cover
  DRINK_PRICE: 9,
  DRINK_VAR_COST: 3,
  FIXED_COST_EVENING: 3600, // chef wages, rent, all overhead

  // ── Drink generation in bar ─────────────────────────────────
  DRINK_RATE_PER_MIN: 1 / 20, // one drink per 20 min per customer; first is immediate

  // ── Dining duration (minutes) ───────────────────────────────
  DINING_TIME_DEFAULT: 60,
  DINING_TIME_STD_DEV: 8,
  DINING_TIME_MIN: 38,
  DINING_TIME_MAX: 92,

  // ── Customer patience (reneging) ────────────────────────────
  PATIENCE_MEAN: 28, // minutes; Exponential distribution

  // ── Party size distribution ─────────────────────────────────
  // Cumulative weights [size 1..8]; mean ≈ 4.1 persons per party
  PARTY_SIZE_CDF: [0.05, 0.22, 0.37, 0.57, 0.72, 0.84, 0.92, 1.0],

  // ── Arrival rates by period (parties per minute) ────────────
  // Piecewise constant. Times in minutes from midnight.
  ARRIVAL_SCHEDULE: [
    { from: 360, to: 390, rate: 0.15 }, // 6:00–6:30
    { from: 390, to: 420, rate: 0.25 }, // 6:30–7:00
    { from: 420, to: 450, rate: 0.42 }, // 7:00–7:30
    { from: 450, to: 480, rate: 0.5 }, // 7:30–8:00  (peak)
    { from: 480, to: 510, rate: 0.42 }, // 8:00–8:30
    { from: 510, to: 540, rate: 0.3 }, // 8:30–9:00
    { from: 540, to: 570, rate: 0.18 }, // 9:00–9:30
    { from: 570, to: 600, rate: 0.1 }, // 9:30–10:00
    { from: 600, to: 630, rate: 0.05 }, // 10:00–10:30
  ],
  // Total expected parties: ~72; total expected customers: ~296

  // ── Advertising ─────────────────────────────────────────────
  AD_COST_PER_UNIT: 200, // $ cost per 1.0x of advertising budget
  DISCOUNT_DINNER_MARGIN_REDUCTION: 2, // $ reduction to dinner margin when Discount campaign

  // ── Bar-to-table seat trade-off ─────────────────────────────
  SEATS_PER_TABLE_REMOVED: 8, // every 8 bar seats added removes 1 dining table
  BAR_SEATS_MIN: 15,
  BAR_SEATS_MAX: 87,
  TABLES_MIN: 10,
  TABLES_MAX: 19,
  // Relationship: tables = 19 - Math.floor((barSeats - 15) / 8)
} as const;

// Derive table count from bar seat count (the trade-off slider relationship).
export function tablesForBarSeats(barSeats: number): number {
  return PARAMS.TABLES_MAX - Math.floor((barSeats - PARAMS.BAR_SEATS_MIN) / PARAMS.SEATS_PER_TABLE_REMOVED);
}
