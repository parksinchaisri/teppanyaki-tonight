# Teppanyaki Tonight — Full Implementation Spec
*Handoff document for Claude Code. Build everything described here without requiring additional design decisions.*

---

## 0. Project Summary

A single-player browser simulation game in which a student manages a teppanyaki restaurant for one evening (6 PM–10:30 PM), working through six progressive challenges that teach operations management concepts: batching, capacity trade-offs, service time, demand management, and policy customisation. Each challenge is simulated 20 times (using fixed seeds) and results are submitted to a class leaderboard. An instructor admin dashboard supports live projection, CSV downloads, and class settings.

**Core pedagogical insight the engine must reliably surface:** The chef is a batch server. Seating a party of 4 at an 8-top doesn't waste 4 seats — it wastes half the chef's capacity for the entire dining duration. Batching groups until the table fills maximises chef utilisation. Everything else in the simulation is built around this mechanism.

---

## 1. Tech Stack

| Concern | Choice |
|---|---|
| Framework | Vite + React 18 + TypeScript |
| Styling | Tailwind CSS v4 |
| Charts | Recharts |
| Routing | React Router v6 |
| Real-time data | Firebase Firestore v9 (modular SDK) |
| Deployment | GitHub Pages (static build via `gh-pages` script) |
| Backend | None — simulation runs entirely client-side |
| Auth | None — class code + display name stored in `localStorage` |

**No Neon, no Vercel, no server.** The simulation engine is pure TypeScript running in the browser. Firebase is used only for leaderboard rows, reflection submissions, and class settings.

---

## 2. Repository Structure

```
teppanyaki-tonight/
├── public/
├── src/
│   ├── engine/
│   │   ├── params.ts          # All tunable constants (single source of truth)
│   │   ├── prng.ts            # Seeded PRNG (mulberry32)
│   │   ├── seeds.ts           # 20 fixed seeds per challenge
│   │   ├── arrival.ts         # Time-varying Poisson arrival generator
│   │   ├── simulation.ts      # Core discrete-event engine + run() entry point
│   │   └── types.ts           # All TypeScript types for engine I/O
│   ├── firebase/
│   │   ├── config.ts          # Firebase init (reads env vars)
│   │   ├── leaderboard.ts     # submitResult(), subscribeLeaderboard()
│   │   ├── reflections.ts     # submitReflection(), getReflections()
│   │   └── classSettings.ts   # getSettings(), updateSettings()
│   ├── components/
│   │   ├── onboarding/
│   │   │   └── JoinScreen.tsx       # Class code + name entry
│   │   ├── tabs/
│   │   │   ├── PrepareTab.tsx
│   │   │   ├── ChallengesTab.tsx
│   │   │   └── LeaderboardTab.tsx
│   │   ├── challenges/
│   │   │   ├── ChallengeShell.tsx   # Shared wrapper: config panel + results + reflection
│   │   │   ├── Batching.tsx
│   │   │   ├── BarSize.tsx
│   │   │   ├── DiningTime.tsx
│   │   │   ├── Advertising.tsx
│   │   │   ├── AdvancedBatching.tsx
│   │   │   └── FinalChallenge.tsx
│   │   ├── results/
│   │   │   ├── OutcomesTable.tsx    # 20-run table (profit + lost customers)
│   │   │   ├── ProfitHistogram.tsx  # NEW: distribution of 20 profits
│   │   │   ├── DualCharts.tsx       # Customers over time + items served
│   │   │   ├── ComparePanel.tsx     # NEW: side-by-side two configs
│   │   │   └── AutoDebrief.tsx      # NEW: plain-language insight sentences
│   │   ├── animation/
│   │   │   ├── FloorView.tsx        # Bar + dining room floor plan SVG
│   │   │   ├── TimelineScrubber.tsx # Playhead + play/pause
│   │   │   └── EventLog.tsx         # Scrolling event log
│   │   └── shared/
│   │       ├── UtilizationMeter.tsx # NEW: chef utilisation % + empty-seat-hours
│   │       ├── Slider.tsx
│   │       ├── RadioGroup.tsx
│   │       └── Badge.tsx
│   ├── admin/
│   │   ├── AdminApp.tsx
│   │   ├── SettingsTab.tsx
│   │   ├── LiveBoardTab.tsx
│   │   ├── ResultsTab.tsx
│   │   └── ReflectionsTab.tsx
│   ├── hooks/
│   │   ├── useClassSettings.ts
│   │   └── useSimulation.ts
│   ├── store/
│   │   └── appContext.tsx      # React context for session state
│   ├── App.tsx
│   └── main.tsx
├── .env.example               # Firebase config vars (VITE_FIREBASE_*)
├── vite.config.ts             # base: '/teppanyaki-tonight/' for GH Pages
└── package.json
```

---

## 3. Simulation Engine

### 3.1 Parameters (`src/engine/params.ts`)

All constants live here. This is the calibration file. Values below produce average profits in the range ~$900–$1,800 for a well-configured restaurant.

```typescript
export const PARAMS = {
  // ── Restaurant ──────────────────────────────────────────────
  OPEN_TIME_DEFAULT: 360,          // minutes from midnight (6:00 PM)
  CLOSE_TIME: 630,                 // 10:30 PM; no new arrivals after this
  SIM_END_TIME: 660,               // 11:00 PM; final tallying cutoff
  TABLE_CAPACITY: 8,               // seats per table (canonical)
  DEFAULT_TABLES: 15,
  DEFAULT_BAR_SEATS: 40,

  // ── Financial ───────────────────────────────────────────────
  DINNER_PRICE: 28,
  DINNER_VAR_COST: 16,             // food + kitchen labour per cover
  DRINK_PRICE: 9,
  DRINK_VAR_COST: 3,
  FIXED_COST_EVENING: 1800,        // covers chef wages, rent, all overhead

  // ── Drink generation in bar ─────────────────────────────────
  DRINK_RATE_PER_MIN: 1 / 20,      // one drink per 20 min per customer; first is immediate

  // ── Dining duration (minutes) ───────────────────────────────
  DINING_TIME_DEFAULT: 60,
  DINING_TIME_STD_DEV: 8,
  DINING_TIME_MIN: 38,
  DINING_TIME_MAX: 92,

  // ── Customer patience (reneging) ────────────────────────────
  PATIENCE_MEAN: 28,               // minutes; Exponential distribution
  // Customers who enter the bar renege after Exp(PATIENCE_MEAN) minutes if not seated.
  // Their drinks already consumed count toward revenue.

  // ── Party size distribution ─────────────────────────────────
  // Cumulative weights [size 1..8]
  PARTY_SIZE_CDF: [0.05, 0.22, 0.37, 0.57, 0.72, 0.84, 0.92, 1.00],
  // Mean ≈ 4.1 persons per party

  // ── Arrival rates by period (parties per minute) ────────────
  // Piecewise constant. Times in minutes from midnight.
  ARRIVAL_SCHEDULE: [
    { from: 360, to: 390, rate: 0.15 },   // 6:00–6:30
    { from: 390, to: 420, rate: 0.25 },   // 6:30–7:00
    { from: 420, to: 450, rate: 0.42 },   // 7:00–7:30
    { from: 450, to: 480, rate: 0.50 },   // 7:30–8:00  (peak)
    { from: 480, to: 510, rate: 0.42 },   // 8:00–8:30
    { from: 510, to: 540, rate: 0.30 },   // 8:30–9:00
    { from: 540, to: 570, rate: 0.18 },   // 9:00–9:30
    { from: 570, to: 600, rate: 0.10 },   // 9:30–10:00
    { from: 600, to: 630, rate: 0.05 },   // 10:00–10:30
  ],
  // Total expected parties: ~72; total expected customers: ~296

  // ── Advertising ─────────────────────────────────────────────
  AD_COST_PER_UNIT: 200,           // $cost per 1.0x of advertising budget
  // demand_multiplier is computed by advertisingMultiplier() in simulation.ts
  DISCOUNT_DINNER_MARGIN_REDUCTION: 2,  // $ reduction to dinner margin when Discount campaign

  // ── Bar-to-table seat trade-off ─────────────────────────────
  SEATS_PER_TABLE_REMOVED: 8,      // every 8 bar seats added removes 1 dining table
  BAR_SEATS_MIN: 15,
  BAR_SEATS_MAX: 87,
  TABLES_MIN: 10,
  TABLES_MAX: 19,
  // Relationship: tables = 19 - Math.floor((barSeats - 15) / 8)
  // i.e. barSeats=15 → tables=19; barSeats=87 → tables=10
};
```

### 3.2 PRNG (`src/engine/prng.ts`)

Use the **mulberry32** algorithm. Deterministic and fast.

```typescript
export function mulberry32(seed: number): () => number {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Helpers built on the PRNG
export function randExponential(rand: () => number, mean: number): number {
  return -mean * Math.log(1 - rand());
}

export function randNormalBoxMuller(rand: () => number, mean: number, std: number): number {
  const u1 = rand(), u2 = rand();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + std * z;
}

export function randDiscreteCDF(rand: () => number, cdf: number[]): number {
  const u = rand();
  return cdf.findIndex(p => u <= p) + 1;  // returns 1-indexed value
}
```

### 3.3 Seeds (`src/engine/seeds.ts`)

Fixed per-challenge. Every student gets the same 20 demand scenarios. This ensures the leaderboard measures strategy, not luck.

```typescript
export const CHALLENGE_SEEDS: Record<string, number[]> = {
  batching: [
    0x1a2b3c4d, 0x5e6f7a8b, 0x9c0d1e2f, 0x3f4a5b6c, 0x7d8e9f0a,
    0xb1c2d3e4, 0xf5a6b7c8, 0x0d1e2f3a, 0x4b5c6d7e, 0x8f9a0b1c,
    0xc3d4e5f6, 0x071829a3, 0x4b5c6d7e, 0x8f90a1b2, 0xc3d4e5f6,
    0x17283940, 0x5b6c7d8e, 0x9f0a1b2c, 0xd3e4f506, 0x17283941,
  ],
  barSize: [ /* 20 different seeds */ ],
  diningTime: [ /* 20 different seeds */ ],
  advertising: [ /* 20 different seeds */ ],
  advancedBatching: [ /* 20 different seeds */ ],
  finalChallenge: [ /* 20 different seeds */ ],
};
// Generate all 20 values per challenge using any hash/RNG of your choosing,
// as long as they are hardcoded constants that never change after launch.
```

### 3.4 TypeScript Types (`src/engine/types.ts`)

```typescript
// ── Configuration ────────────────────────────────────────────────────────────

export type BatchingMode =
  | 'none'           // seat next party immediately, one party per table
  | 'four_to_eight'  // seat when 4–8 people accumulated
  | 'eight'          // seat only when 8 people accumulated (strict)
  | 'four_share';    // split table into two independent 4-tops

export type AdCampaign = 'none' | 'awareness' | 'discount' | 'happy_hour';

export interface PeriodBatching {
  early: BatchingMode;    // open → 7:00 PM
  peak: BatchingMode;     // 7:00 PM → 8:00 PM
  late: BatchingMode;     // 8:00 PM → close
}

export interface SimConfig {
  // Batching (for simple challenges, use same mode for all periods)
  batching: PeriodBatching;

  // Capacity
  barSeats: number;
  tables: number;         // derived from barSeats if using the trade-off slider

  // Dining time targets (minutes) by period
  diningTimeEarly: number;
  diningTimePeak: number;
  diningTimeLate: number;

  // Advertising
  adBudget: number;       // 0.0 – 4.0
  adCampaign: AdCampaign;
  openingTime: number;    // minutes from midnight: 300 (5pm), 360 (6pm), or 420 (7pm)
}

// ── Simulation Events ────────────────────────────────────────────────────────

export type EventType =
  | 'ARRIVE'            // party arrives at entrance
  | 'ENTER_BAR'         // party seated in bar
  | 'BALK'              // arrived but bar full → lost immediately
  | 'RENEGE'            // timed out waiting in bar → lost
  | 'SEAT_DINING'       // batch seated at dining table
  | 'DEPART'            // party completes dinner and leaves
  | 'BATCH_FORMED';     // informational: a batch of N people is ready to seat

export interface SimEvent {
  time: number;          // minutes from midnight
  type: EventType;
  partyId: number;
  partySize: number;
  tableId?: number;      // present for SEAT_DINING, DEPART
  batchSize?: number;    // present for BATCH_FORMED, SEAT_DINING
  description: string;   // human-readable, e.g. "Party of 4 seated at table 3"
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
  chefUtilisation: number;     // 0–1; fraction of (tables × open_minutes) that had diners
  emptyChairHours: number;     // total hours of empty chef-adjacent seats during occupied turns
  avgTableTurns: number;       // average times each table was occupied
  avgBarWaitMinutes: number;   // average minutes parties waited in bar before seating
  balkCount: number;
  renegeCount: number;

  // Time-series (5-minute intervals, index 0 = open time)
  timeseries: {
    time: number[];             // absolute minutes from midnight
    barOccupancy: number[];     // customers currently in bar
    diningOccupancy: number[];  // customers currently at tables
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
  runs: RunStats[];            // length = 20
  avgProfit: number;
  maxProfit: number;
  minProfit: number;
  avgLost: number;
  avgChefUtil: number;
  avgEmptyChairHours: number;
}
```

### 3.5 Arrival Process (`src/engine/arrival.ts`)

```typescript
// Generate all arrivals for the evening upfront before the event loop.
// Returns an array of { time, partySize } sorted by time ascending.
export function generateArrivals(
  rand: () => number,
  schedule: typeof PARAMS.ARRIVAL_SCHEDULE,
  demandMultiplier: number,
  campaignShift: (t: number) => number  // multiplicative adjustment per period for campaign
): Array<{ time: number; partySize: number }> {
  const arrivals: Array<{ time: number; partySize: number }> = [];

  for (const period of schedule) {
    const effectiveRate = period.rate * demandMultiplier * campaignShift(period.from);
    let t = period.from;
    while (t < period.to) {
      t += randExponential(rand, 1 / effectiveRate);
      if (t >= period.to) break;
      const size = randDiscreteCDF(rand, PARAMS.PARTY_SIZE_CDF);
      arrivals.push({ time: t, partySize: size });
    }
  }

  return arrivals.sort((a, b) => a.time - b.time);
}
```

### 3.6 Advertising Model

```typescript
// Returns the overall demand multiplier given budget and campaign.
export function advertisingMultiplier(budget: number, campaign: AdCampaign): number {
  // Diminishing returns curve: linear to 1x, then flattening
  const base =
    budget <= 1 ? 0.60 + 0.40 * budget :
    budget <= 2 ? 1.00 + 0.25 * (budget - 1) :
    budget <= 3 ? 1.25 + 0.15 * (budget - 2) :
                  1.40 + 0.08 * (budget - 3);
  return base;
}

// Returns a per-period rate multiplier for the selected campaign.
// Applied in addition to the overall demand multiplier.
export function campaignShift(campaign: AdCampaign, minutesFromMidnight: number): number {
  const hour = minutesFromMidnight / 60;
  if (campaign === 'happy_hour') return hour < 19 ? 1.5 : 0.90;
  if (campaign === 'awareness')  return 1.15;  // flat boost across the day
  if (campaign === 'discount')   return 1.25;  // higher demand, lower margins (handled in profit)
  return 1.0;
}

// Discount campaign reduces dinner margin by PARAMS.DISCOUNT_DINNER_MARGIN_REDUCTION.
```

### 3.7 Batching Logic

The engine uses a `batchBuffer` — an ordered queue of waiting parties. Seating decisions happen whenever (a) a table becomes free or (b) a new party enters the bar.

**Canonical seating rule per BatchingMode:**

| Mode | Seat when… | Seats taken |
|---|---|---|
| `none` | A table is free AND the queue is non-empty | Next party only (one party per table) |
| `four_to_eight` | Greedy front-of-queue sum ≥ 4 AND a table is free | Take parties until sum ≥ 4, stop before exceeding 8 |
| `eight` | Greedy front-of-queue sum ≥ 8 AND a table is free | Take parties until sum is as close to 8 as possible without splitting any party; seat if sum ∈ [6, 8] |
| `four_share` | As `four_to_eight` but table capacity = 4 | Each physical table is modelled as two independent 4-seat slots (double the table count in the model) |

**`four_share` implementation:** when this mode is active, set `effectiveTables = tables * 2` and `effectiveCapacity = 4`. Dining duration is unchanged; two groups share a physical table but the chef handles each as an independent cooking session.

**`eight` mode edge case:** if parties in the buffer cannot sum to 6–8 (e.g. only a single party of 9+ — impossible given max party size 8 — or no parties large enough after 15+ min wait), apply a time-pressure override: if the oldest queued party has waited more than `PATIENCE_MEAN` minutes, seat whatever is available rather than lose the customer.

**Batch mode is time-of-day sensitive:** use the config's `PeriodBatching` to select the mode at the moment a table becomes free.

```
function getModeAtTime(batching: PeriodBatching, time: number): BatchingMode {
  if (time < 420) return batching.early;   // before 7:00 PM
  if (time < 480) return batching.peak;    // 7:00–8:00 PM
  return batching.late;
}
```

### 3.8 Core Event Loop (`src/engine/simulation.ts`)

```typescript
export function runSimulation(config: SimConfig, seed: number): RunStats {
  const rand = mulberry32(seed);

  // Advertising effects
  const demandMult = advertisingMultiplier(config.adBudget, config.adCampaign);
  const arrivals = generateArrivals(rand, adjustedSchedule(config), demandMult,
    t => campaignShift(config.adCampaign, t));

  // State
  const openTime = config.openingTime;
  const barCapacity = config.barSeats;
  const effectiveTables = config.batching.early === 'four_share' ? config.tables * 2 : config.tables;
  // Note: table capacity adjusts per period if batching modes differ; handle at seat-time.

  const barQueue: Party[] = [];           // waiting parties, ordered by arrivalTime
  const tables: TableState[] = Array.from({ length: config.tables }, (_, i) => ({
    id: i,
    occupiedUntil: openTime,
    occupiedMinutes: 0,
    turns: 0,
  }));

  const events: SimEvent[] = [];
  const stats = initStats();

  // ── Priority event queue ────────────────────────────────────
  // Pre-populate with all arrivals + close-bar sentinel.
  const pq = new MinHeap<ScheduledEvent>();
  arrivals.forEach(a => pq.push({ time: a.time, type: 'ARRIVE', ...a }));
  pq.push({ time: PARAMS.CLOSE_TIME, type: 'CLOSE' });
  pq.push({ time: PARAMS.SIM_END_TIME, type: 'END' });

  let barOpen = true;

  // ── Main loop ────────────────────────────────────────────────
  while (!pq.isEmpty()) {
    const ev = pq.pop();

    if (ev.type === 'END') break;

    if (ev.type === 'CLOSE') {
      barOpen = false;
      continue;
    }

    if (ev.type === 'ARRIVE') {
      if (!barOpen) continue;
      const barOccupancy = barQueue.reduce((s, p) => s + p.size, 0);
      if (barOccupancy + ev.partySize > barCapacity) {
        // BALK
        logEvent(events, { time: ev.time, type: 'BALK', ...ev, description: `Party of ${ev.partySize} turned away (bar full)` });
        stats.balkCount += ev.partySize;
        stats.lostCustomers += ev.partySize;
      } else {
        // Enter bar; schedule reneging
        const patience = randExponential(rand, PARAMS.PATIENCE_MEAN);
        const party: Party = { id: nextId(), size: ev.partySize, arrivalTime: ev.time, renegeTime: ev.time + patience, drinksConsumed: 0 };
        barQueue.push(party);
        pq.push({ time: party.renegeTime, type: 'RENEGE', partyId: party.id });
        logEvent(events, { time: ev.time, type: 'ENTER_BAR', partyId: party.id, partySize: ev.partySize,
          description: `Party of ${ev.partySize} entered bar` });
        // Immediate first drink
        party.drinksConsumed += ev.partySize;
        stats.drinksServed += ev.partySize;
      }
      trySeatBatch(ev.time);
    }

    if (ev.type === 'RENEGE') {
      const idx = barQueue.findIndex(p => p.id === ev.partyId);
      if (idx === -1) continue; // already seated
      const party = barQueue.splice(idx, 1)[0];
      // Add drinks consumed while waiting
      const waitMinutes = ev.time - party.arrivalTime;
      const additionalDrinks = Math.floor(waitMinutes / (1 / PARAMS.DRINK_RATE_PER_MIN));
      party.drinksConsumed += additionalDrinks;
      stats.drinksServed += additionalDrinks;
      stats.renegeCount += party.size;
      stats.lostCustomers += party.size;
      logEvent(events, { time: ev.time, type: 'RENEGE', partyId: party.id, partySize: party.size,
        description: `Party of ${party.size} gave up after ${waitMinutes.toFixed(0)} min wait` });
    }

    if (ev.type === 'DEPART') {
      const table = tables.find(t => t.id === ev.tableId)!;
      table.occupiedUntil = ev.time;
      logEvent(events, { time: ev.time, type: 'DEPART', tableId: ev.tableId, partySize: ev.partySize,
        description: `Party of ${ev.partySize} finished dinner at table ${ev.tableId + 1}` });
      stats.dinnersServed += ev.partySize;
      trySeatBatch(ev.time);
    }
  }

  // ── trySeatBatch (inner function) ────────────────────────────
  function trySeatBatch(now: number) {
    // Find free tables
    for (const table of tables) {
      if (table.occupiedUntil > now) continue;
      if (barQueue.length === 0) break;

      const mode = getModeAtTime(config.batching, now);
      const tableCapacity = mode === 'four_share' ? 4 : PARAMS.TABLE_CAPACITY;
      const minBatch = mode === 'none' ? 1 : mode === 'four_to_eight' ? 4 : mode === 'eight' ? 6 : 4;

      // Greedy fill
      const batch: Party[] = [];
      let batchSize = 0;
      for (const party of barQueue) {
        if (batchSize + party.size <= tableCapacity) {
          batch.push(party);
          batchSize += party.size;
        }
        if (mode === 'none') break; // only one party in no-batching mode
      }

      if (batchSize < minBatch) {
        // Apply time-pressure override for 'eight' mode
        if (mode === 'eight' && barQueue.length > 0) {
          const oldestWait = now - barQueue[0].arrivalTime;
          if (oldestWait < PARAMS.PATIENCE_MEAN) continue; // keep waiting
          // Else seat whatever we have
        } else {
          continue;
        }
      }

      // Remove from barQueue
      batch.forEach(p => {
        const idx = barQueue.indexOf(p);
        barQueue.splice(idx, 1);
        // Cancel renege event (mark as seated; check in RENEGE handler)
        // Tally bar drinks accumulated during wait
        const waitMinutes = now - p.arrivalTime;
        const additionalDrinks = Math.floor(waitMinutes * PARAMS.DRINK_RATE_PER_MIN);
        p.drinksConsumed += additionalDrinks;
        stats.drinksServed += additionalDrinks;
      });

      // Seat at table
      const diningDuration = getDiningDuration(rand, config, now);
      const departTime = now + diningDuration;
      table.occupiedUntil = departTime;
      table.occupiedMinutes += diningDuration;
      table.turns += 1;

      const emptySeats = tableCapacity - batchSize;
      stats.emptyChairHours += emptySeats * (diningDuration / 60);

      pq.push({ time: departTime, type: 'DEPART', tableId: table.id, partySize: batchSize });
      logEvent(events, { time: now, type: 'SEAT_DINING', tableId: table.id, batchSize,
        description: `Batch of ${batchSize} seated at table ${table.id + 1}` });
    }
  }

  // ── Post-simulation stats ────────────────────────────────────
  const totalOpenMinutes = PARAMS.CLOSE_TIME - openTime;
  const totalTableMinutes = config.tables * totalOpenMinutes;
  const usedTableMinutes = tables.reduce((s, t) => s + t.occupiedMinutes, 0);
  stats.chefUtilisation = usedTableMinutes / totalTableMinutes;
  stats.avgTableTurns = tables.reduce((s, t) => s + t.turns, 0) / config.tables;
  stats.avgBarWaitMinutes = computeAvgWait(events);

  // Financial
  const discountReduction = config.adCampaign === 'discount' ? PARAMS.DISCOUNT_DINNER_MARGIN_REDUCTION : 0;
  const dinnerMargin = (PARAMS.DINNER_PRICE - PARAMS.DINNER_VAR_COST) - discountReduction;
  const drinkMargin = PARAMS.DRINK_PRICE - PARAMS.DRINK_VAR_COST;
  stats.revenue = stats.dinnersServed * PARAMS.DINNER_PRICE + stats.drinksServed * PARAMS.DRINK_PRICE;
  stats.variableCost = stats.dinnersServed * PARAMS.DINNER_VAR_COST + stats.drinksServed * PARAMS.DRINK_VAR_COST;
  stats.advertisingCost = config.adBudget * PARAMS.AD_COST_PER_UNIT;
  stats.fixedCost = PARAMS.FIXED_COST_EVENING;
  stats.profit = stats.dinnersServed * dinnerMargin + stats.drinksServed * drinkMargin
               - stats.advertisingCost - stats.fixedCost;

  buildTimeseries(stats, events, openTime);
  return stats;
}

function getDiningDuration(rand: () => number, config: SimConfig, now: number): number {
  const target =
    now < 420 ? config.diningTimeEarly :
    now < 480 ? config.diningTimePeak :
    config.diningTimeLate;
  const raw = randNormalBoxMuller(rand, target, PARAMS.DINING_TIME_STD_DEV);
  return Math.max(PARAMS.DINING_TIME_MIN, Math.min(PARAMS.DINING_TIME_MAX, raw));
}
```

**Note on `MinHeap`:** implement a simple binary min-heap keyed on `time`. ~40 lines of code; no library needed.

**Note on timeseries construction:** after the event loop, replay events chronologically and sample bar/dining/lost/drinks/dinners counts at every 5-minute mark.

### 3.9 Running 20 Replications

```typescript
export function runChallenge(config: SimConfig, challengeKey: string): ChallengeResult {
  const seeds = CHALLENGE_SEEDS[challengeKey];
  const runs = seeds.map(seed => runSimulation(config, seed));
  return {
    config,
    runs,
    avgProfit: mean(runs.map(r => r.profit)),
    maxProfit: Math.max(...runs.map(r => r.profit)),
    minProfit: Math.min(...runs.map(r => r.profit)),
    avgLost: mean(runs.map(r => r.lostCustomers)),
    avgChefUtil: mean(runs.map(r => r.chefUtilisation)),
    avgEmptyChairHours: mean(runs.map(r => r.emptyChairHours)),
  };
}
```

**Performance note:** 20 × one-evening DES runs should complete in < 50 ms. No Web Worker required, but one can be added trivially if testing shows UI jank.

---

## 4. Challenge Definitions

Each challenge is defined by: which controls are shown, the default config, the challenge title, the description text, and the reflection question.

### 4.1 Batching (`challenges/batching`)

**Title:** "Batching Dining Room Customers"

**Description:** "Your dining room seats guests in groups at chef-staffed teppanyaki tables. Tonight, decide whether to hold back bar customers until a full table of eight is assembled, or seat each party as soon as a table is free. How does this seemingly small policy change affect what your chefs actually do all evening?"

**Controls:** Single choice: `Use Batching (Tables of 8)` vs `No Batching`

**Default config:** barSeats=40, tables=15, diningTime=60min all periods, adBudget=1.0, campaign=none, openingTime=6pm

**Reflection question (reflectionsRequired=true):** "How does batching change the relationship between bar wait time and the dining room? Where do the throughput gains actually come from?"

### 4.2 Bar Size (`challenges/barSize`)

**Title:** "Design the Bar"

**Description:** "Your bar holds waiting customers and earns drink revenue while they wait. Expanding it costs you dining tables — every eight bar seats you add removes one table from the dining room. Find the size that maximises total evening profit."

**Controls:**
- Batching toggle (Use Batching / No Batching) — defaults to Use Batching
- Bar seats slider: 15–87 (step 1)
- Restaurant tables: derived automatically, displayed read-only: `tables = 19 - Math.floor((barSeats - 15) / 8)`
- Show the inverse relationship clearly in the UI so students feel the trade-off.

**Reflection question:** "What role does the bar play in the operation beyond serving drinks? What is the actual cost of making it larger?"

### 4.3 Dining Time (`challenges/diningTime`)

**Title:** "Change Dining Time"

**Controls:** Three sliders (45–75 min, step 1):
- Average dining time for early diners (open–7 pm)
- Average dining time for peak diners (7 pm–8 pm)
- Average dining time for late diners (8 pm–10:30 pm)

All default to 60 min. Batching is fixed at "Tables of Eight" for this challenge. Bar/table counts at default.

**Reflection question:** "Does it pay to shorten dining time? Does your answer depend on which period you target?"

### 4.4 Advertising (`challenges/advertising`)

**Title:** "Boost Demand with Advertising"

**Controls:**
- Advertising Budget: slider 0.0–4.0 (step 0.1), labelled as multiplier vs baseline
- Campaign type (radio): None / Awareness Building / Discount Promotion / Happy Hour
- Opening time (radio): 5:00 PM / 6:00 PM / 7:00 PM
- Batching fixed at "Tables of Eight". Bar/table at default.

**Reflection question:** "How do your advertising choices affect the variability of outcomes — not just the average? What are the operational consequences of higher demand variability?"

### 4.5 Advanced Batching (`challenges/advancedBatching`)

**Title:** "Use Different Batching at Different Times"

**Controls:** Three period panels, each with a 4-way radio:
- Open → 7 pm: No Batching / Tables of 4–8 / Tables of 8 / Four Share a Table
- 7 pm → 8 pm: same four options
- 8 pm → 10:30 pm: same four options

Bar/table at default. Dining time at default 60 min.

**Reflection question:** "Which batching policy is appropriate at which time of day? What does customising the policy by period actually buy you?"

### 4.6 Final Challenge (`challenges/finalChallenge`)

**Title:** "Design Your Best Strategy"

**Controls:** Full set — all controls from all challenges combined. No pre-set defaults; student sets everything.

**Reflection question:** "How does your best configuration balance demand variability and process variability? Which single decision had the largest impact on profit?"

---

## 5. App Screens & Routes

| Route | Screen | Notes |
|---|---|---|
| `/` | `JoinScreen` | Class code + display name. Saves to localStorage. |
| `/play` | Main app | Three tabs: Prepare / Challenges / Leaderboard |
| `/admin` | `AdminApp` | PIN gate, then 4-tab admin dashboard |

### JoinScreen

1. Text input: "Class Code" (required; validated against Firestore — `classes/{code}` doc must exist)
2. Text input: "Display Name" (required; 2–30 chars; this appears on the leaderboard)
3. On submit: save `{ classCode, studentId (uuid), displayName }` to localStorage; fetch class settings; navigate to `/play`

If localStorage already has a valid session, skip directly to `/play`.

### Main App (`/play`)

Three top-level tabs using a tab bar: **Prepare** | **Challenges** | **Leaderboard**

**Prepare Tab:** Static informational content.
- Header: "Welcome to Teppanyaki Tonight"
- Your role description (see Section 0 for rewritten text — write original copy here, not HBS copy)
- Visual: flow diagram showing: Arrivals → Bar (buffer) → Dining Room (chef tables) → Depart
- Instructions: "Work through the challenges from left to right."
- A simple static floor plan diagram showing the restaurant layout

**Challenges Tab:** Sub-tabs across the top:
`1: Batching` | `2: Bar Size` | `3: Dining Time` | `4: Advertising` | `5: Advanced Batching` | `6: Final Challenge`

Each sub-tab is locked until the previous one is submitted (i.e., the student has submitted a result to the leaderboard). The lock can be overridden by an instructor setting (`lockChallenges: false` in class settings).

**Leaderboard Tab:** Live leaderboard — see Section 7.

---

## 6. Component Architecture

### ChallengeShell

Wraps every challenge. Props:
```typescript
interface ChallengeShellProps {
  challengeKey: string;
  title: string;
  description: string;
  reflectionQuestion: string;
  children: React.ReactNode;  // the config controls
}
```

Manages:
- List of saved configurations (up to 5, student can add more)
- "Simulate" button → calls `runChallenge()` → stores result
- Results section (shown after first simulation)
- "Compare" button (appears after 2+ configs exist) → opens ComparePanel
- Utilisation meter (shown or hidden per class settings)
- Auto-debrief panel (shown or hidden per class settings)
- Reflection textarea + Submit button (shown only if `reflectionsRequired`)
- "Submit to Leaderboard" button (submits best avgProfit for this challenge)

### OutcomesTable

Displays the 20-run results table:
- Columns: Outcome # | Profit | Lost Customers
- Rows: Avg (highlighted), Max, Min, then runs 1–20
- Clicking any row selects it for chart and animation display
- Sort by any column

### ProfitHistogram *(new feature)*

A small bar chart showing the distribution of profit across the 20 runs for the currently viewed config. X-axis: profit bins. Y-axis: count. Shows mean as a vertical line. If a second config is pinned (compare mode), overlay the second distribution in a different colour.

This surfaces variability as a first-class result — not buried in a table.

### DualCharts

Two Recharts `LineChart` components side by side:
- Left: "Customers" — three lines: BAR (blue), DINING ROOM (green), LOST (red). Y = customer count, X = time (6pm–10:30pm)
- Right: "Items Served" — two lines: DRINKS (blue), DINNERS (green). Y = cumulative count, X = time.

Data from the selected run's `timeseries`.

### ComparePanel *(new feature)*

Triggered when student clicks "Compare" with 2+ configs saved. Shows:
- Config A vs Config B selector (dropdowns)
- Side-by-side dual charts (both overlaid or split)
- Delta table: Avg Profit Δ | Avg Lost Δ | Chef Utilisation Δ | Empty Chair-Hours Δ
- Profit histogram for each, overlaid

Purpose: turn trial-and-error into explicit marginal analysis.

### AutoDebrief *(new feature, instructor-toggleable)*

Shown below the charts when `autoDebrief: true` in class settings. Generates 2–3 sentences from the stats:

```typescript
function generateDebrief(result: ChallengeResult): string[] {
  const util = (result.avgChefUtil * 100).toFixed(0);
  const emptyHours = result.avgEmptyChairHours.toFixed(1);
  const lostPct = ((result.avgLost / (result.avgLost + result.runs[0].dinnersServed)) * 100).toFixed(0);
  return [
    `Your chefs were actively cooking ${util}% of the evening on average.`,
    `${emptyHours} seat-hours were paid for but left empty during occupied turns.`,
    `${lostPct}% of customers who arrived were lost before being seated.`,
  ];
}
```

No AI needed — pure computation from the stats bundle.

### UtilisationMeter *(new feature, instructor-toggleable)*

A compact card showing:
- **Chef Utilisation:** `78%` (large number, colour-coded green/amber/red)
- **Empty Chair-Hours:** `42 hrs` (with tooltip: "seat-hours of chef capacity not used by diners")
- A small horizontal bar: total chair-hours | used | empty

Shown/hidden per `utilizationVisible` class setting. Default: **hidden** (students must infer the bottleneck first, then the meter is revealed as an "aha" moment).

### FloorView (Animation)

SVG-based floor plan. Fixed layout. Dimensions chosen to be readable on a 13" laptop.

**Left panel — Bar:**
- Grid of circular seat icons arranged in two rows of `barSeats/2` each
- Colors: `empty` = dark gray outline, `occupied` = accent color, `leaving` = amber (briefly, before remove)
- Small queue icon near entrance showing current bar occupancy count

**Right panel — Dining Room:**
- Grid of table units. Each table = a rectangle with 8 surrounding seat circles (4 per long side).
- Colors: `empty` table = dark fill, `occupied` table = green fill, `half-full` table = amber
- Show a chef icon at the head of each occupied table

**Entrance / Exit arrows** between panels.

**Event Log** below the floor plan: scrollable list, newest event at bottom, max 8 visible at once. Each row: `[time]` event description.

**Timeline scrubber** above the floor plan: shows 6pm–10:30pm range, a playhead the student can drag. Play / Pause / Step buttons. Speed selector: 0.5× / 1× / 2× / 4×.

Animation state is derived by replaying the selected run's event log up to `currentTime`.

---

## 7. Firebase Schema & Security Rules

### Schema

```
firestore/
  classes/{classCode}/
    ← document fields:
      createdAt: timestamp
      instructorPin: string   (hashed or plain 4-6 digit code; used for admin access)
      settings: {
        reflectionsRequired: boolean       // default: true
        autoDebrief: boolean               // default: false
        utilizationVisible: boolean        // default: false
        leaderboardMode: 'challenge'|'final'
        leaderboardMetric: 'avgProfit'|'maxProfit'
        lockChallenges: boolean            // default: true
        activeLeaderboardChallenge: string // challenge currently projected; 'finalChallenge' etc.
      }

    students/{studentId}/
      ← document fields:
        displayName: string
        joinedAt: timestamp

    studentResults/{studentId}_{challengeKey}/
      ← document fields:
        studentId: string
        studentName: string
        classCode: string
        challengeKey: string
        bestAvgProfit: number
        attempts: number
        lastSubmittedAt: timestamp
        bestConfig: SimConfig   (serialised JSON)

    reflections/{autoId}/
      ← document fields:
        studentId: string
        studentName: string
        challengeKey: string
        questionText: string
        response: string
        submittedAt: timestamp
```

### Security Rules (firestore.rules)

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Anyone can read a class document to validate the class code
    match /classes/{classCode} {
      allow read: if true;
      allow write: if false;  // create classes via Firebase console only

      // Student writes their own result
      match /studentResults/{docId} {
        allow read: if true;   // leaderboard is public within the class
        allow create, update: if request.auth == null
          && request.resource.data.classCode == classCode
          && request.resource.data.bestAvgProfit is number
          && request.resource.data.studentName.size() >= 2
          && request.resource.data.studentName.size() <= 30;
      }

      match /reflections/{docId} {
        allow create: if request.auth == null
          && request.resource.data.response.size() >= 10;
        allow read: if false;  // admin only via console or admin SDK
      }

      match /students/{studentId} {
        allow create, update: if true;
        allow read: if true;
      }
    }
  }
}
```

**Note:** No Firebase Auth is used. The `classCode` in the document path acts as a namespace. Reflections are write-only from the client; reads happen only via the admin dashboard (use a server-side Firebase Admin SDK call in the admin download endpoint, OR expose reads only after PIN verification on the client).

**For the admin dashboard reflection reads:** Because Firestore rules block client reads of reflections, implement a simple approach: store the class `instructorPin` in the class document, and when the admin enters the correct PIN, use `getDoc` with a Firestore query that the rules allow only when a valid PIN is passed as a custom claim. Simpler alternative: just allow read on reflections if the request includes the classCode (since the reflection collection is scoped to a classCode path that only someone with the code can reach). This is acceptable for a classroom tool.

Simplest secure option: allow read on reflections with no restriction (they're scoped to a classCode; anyone who knows the code can read). For a classroom app this is fine — just document it.

### Firebase Client Init (`src/firebase/config.ts`)

```typescript
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
```

`.env.example` documents all six VITE_FIREBASE_* vars. Instructor fills them in `.env.local`.

### GitHub Actions Deployment

Provide a `.github/workflows/deploy.yml` that:
1. Builds the Vite app
2. Pushes `dist/` to the `gh-pages` branch
3. Reads `VITE_FIREBASE_*` from GitHub repository secrets

---

## 8. Admin Dashboard (`/admin`)

### PIN Gate

- `/admin` shows a PIN entry field
- On submit: fetch `classes/{classCode}` document and compare entered PIN to stored `instructorPin`
- On success: show `AdminApp` with the class data
- The admin also needs to enter the class code (in case they teach multiple sections)

### AdminApp Layout

Top nav with four tabs: **Settings | Live Board | Results | Reflections**

### Settings Tab

Displays and edits the `settings` sub-object on the class document. All fields are live-saved to Firestore on change. Controls:

- Toggle: Reflections Required
- Toggle: Auto-Debrief Visible
- Toggle: Utilisation Meter Visible
- Toggle: Lock Challenges (require sequential completion)
- Radio: Leaderboard Mode — "By Challenge" / "Final Challenge Only"
- Radio: Leaderboard Metric — "Average Profit" / "Best Single Run"
- Select: Active Leaderboard Challenge (for Live Board projection): dropdown of all 6 challenges + "All"

### Live Board Tab

- Large, dark-background, high-contrast layout optimised for projection
- A "Theater Mode" button removes all admin chrome, leaving only the leaderboard
- Displays the challenge selected in Active Leaderboard Challenge setting
- Real-time Firestore listener (`onSnapshot`) — updates live as students submit
- Left: **Distribution histogram** — profit bins on x-axis, count on y-axis, student's bar highlighted if hovered
- Below: **Ranked table** — Rank | Name | Best Avg Profit | Challenge | Attempts
- Sort descending by the leaderboard metric
- Refresh button (manual fallback)

### Results Tab

Table of all student results, all challenges. Columns: Name | Challenge | Best Avg Profit | Attempts | Last Submitted. Filterable by challenge. "Download CSV" button exports all rows.

CSV columns: `studentName, challengeKey, bestAvgProfit, attempts, lastSubmittedAt, bestConfig (JSON)`

### Reflections Tab

Table: Name | Challenge | Question | Response | Submitted At. Filterable by challenge and student name. Searchable. "Download CSV" button exports all rows.

CSV columns: `studentName, challengeKey, questionText, response, submittedAt`

---

## 9. New Feature Specs (vs HBS)

### Feature A — Chef Utilisation Meter
- Computed from engine output (no extra work)
- Shown as `UtilisationMeter` card in results section
- Default: hidden. Instructor enables in Settings.
- Recommended in-class flow: run Batching challenge with meter hidden, discuss, then reveal meter to show mechanistic explanation

### Feature B — Profit Distribution Histogram
- Always shown (not togglable — this is core information)
- Positioned prominently above the outcomes table
- Shows variability across the 20 runs as the bar chart
- When student has 2+ configs, overlay both distributions with a legend

### Feature C — Side-by-Side Config Compare
- Accessible after student saves 2+ configs
- Triggered by "Compare" button in ChallengeShell
- Delta table + overlaid charts + overlaid histograms
- Helps students do marginal analysis rather than guessing

### Feature D — Auto-Debrief Panel
- Instructor-toggleable via Settings
- 2–3 computed sentences from stats bundle (no AI)
- Covers: chef utilisation %, empty chair-hours, % customers lost
- Default: off. Useful for async/homework use; off for in-class discovery

### Feature E — Class Settings via Firestore
- Single instructor control panel
- Changes propagate to all student clients in real-time (onSnapshot on settings doc)
- Includes reflection toggle, auto-debrief, lock, leaderboard mode

### Feature F — Reflection Storage + CSV Download
- When student submits a reflection, writes to `reflections/` subcollection
- Admin Reflections Tab shows all responses with full text
- CSV download for rubric grading

### Feature G — Instructor Live Board with Theater Mode
- Full-screen, high-contrast projection view
- Active challenge selector in admin settings
- Real-time updates via Firestore listener

---

## 10. Visual Design

**Aesthetic:** Dark-mode industrial/operational — think Bloomberg terminal meets restaurant POS. This is a simulation that students take seriously; the UI should feel like a real operational dashboard, not a toy.

**Color palette (CSS variables):**
```css
--color-bg: #0d0f14
--color-surface: #161923
--color-surface-raised: #1e2330
--color-border: #2a3040
--color-accent: #3b82f6        /* electric blue — primary actions */
--color-accent-green: #22c55e  /* occupied tables, positive metrics */
--color-accent-amber: #f59e0b  /* warnings, near-capacity */
--color-accent-red: #ef4444    /* lost customers, negative profit */
--color-text-primary: #f1f5f9
--color-text-secondary: #94a3b8
--color-text-muted: #4a5568
```

**Typography:** Use `IBM Plex Mono` for numbers and metrics (monospaced, professional, legible on projectors). `Inter` or `DM Sans` for body text. Keep font loading simple (Google Fonts CDN).

**Chart style:** Dark background, no gridlines (or very subtle), Recharts with custom tooltips matching the color palette. Axes labelled in `--color-text-secondary`.

**Floor plan animation:** Keep it schematic, not photorealistic. Circles for seats, rectangles for tables, simple icon for chef (a hat or small figure). Green fill = occupied, dark = empty.

**Layout rhythm:** 4px base unit, 8/12/16/24/32/48 spacing scale. The main challenge page layout: config panel on the right (~320px), results filling the remaining width.

**Leaderboard Live Board:** large type, dark background, electric blue accents. Rank numbers in large mono font. Use a subtle entrance animation when a new row appears.

---

## 11. Instructor Setup Guide

Include a `SETUP.md` in the repository root with these steps:

1. **Clone the repo**
2. **Create a Firebase project** (free Spark tier)
   - Enable Firestore in production mode
   - Copy the web config values
3. **Create a `.env.local` file** with all six `VITE_FIREBASE_*` values
4. **Create a class in Firestore** — manually create document at `classes/{YOUR_CLASS_CODE}` with fields:
   ```json
   {
     "createdAt": <timestamp>,
     "instructorPin": "1234",
     "settings": {
       "reflectionsRequired": true,
       "autoDebrief": false,
       "utilizationVisible": false,
       "leaderboardMode": "challenge",
       "leaderboardMetric": "avgProfit",
       "lockChallenges": true,
       "activeLeaderboardChallenge": "batching"
     }
   }
   ```
5. **Add GitHub secrets** — all six Firebase vars as `VITE_FIREBASE_*` repository secrets
6. **Push to main** — GitHub Actions builds and deploys to `https://{username}.github.io/teppanyaki-tonight/`
7. **Share the URL** with students along with the class code
8. **Admin dashboard** — navigate to `{url}/admin`, enter class code and PIN
9. **For a new class section** — create a new document in Firestore with a different class code; the same deployed app serves all sections

---

## 12. Build Order for Claude Code

Implement in this sequence to allow incremental testing:

1. `engine/` — PRNG, arrival, simulation, types. Unit test with `runChallenge()` printing stats to console.
2. Firebase config + `classSettings.ts` — verify class code lookup works
3. `JoinScreen` + routing + localStorage session
4. `PrepareTab` — static content, flow diagram
5. `ChallengeShell` + `Batching` challenge — the vertical slice: config → simulate → OutcomesTable + DualCharts
6. `FloorView` animation + `TimelineScrubber`
7. Remaining 5 challenges
8. `ProfitHistogram` + `ComparePanel` + `AutoDebrief` + `UtilisationMeter`
9. Leaderboard tab + `leaderboard.ts` Firestore writes
10. Reflection submission + `reflections.ts`
11. Admin dashboard (all four tabs)
12. GitHub Actions deploy workflow
13. Calibration pass — run all challenges, verify qualitative conclusions hold (batching raises util, interior-optimum bar size exists, time-varying batching beats uniform, advertising increases variance)

---

*End of spec. All design decisions are resolved. Parameter calibration (Section 3.1) should be verified empirically during Step 13 by running the engine and checking that the pedagogical conclusions emerge clearly from the data.*
