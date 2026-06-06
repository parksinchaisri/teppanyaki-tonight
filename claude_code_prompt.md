# Teppanyaki Tonight — Build Prompt for Claude Code

You are building **Teppanyaki Tonight**, a single-player browser simulation game for teaching operations management in an MBA classroom. Read the full spec in `teppanyaki_tonight_spec.md` before writing any code. Everything you need is in that file. Below are the seeds, a few critical implementation notes, and the build order.

---

## Seeds (paste into `src/engine/seeds.ts` exactly as shown)

```typescript
export const CHALLENGE_SEEDS: Record<string, number[]> = {
  batching: [
    0x22745DF6, 0x5CA801E6, 0xDE8EAE8A, 0xC58583D7, 0xBEC2C83C,
    0x3D704994, 0xA8DF0067, 0x874196C5, 0x26AA75D1, 0x5EF5DF10,
    0x52C4DDC7, 0x3485793A, 0xCF177EBA, 0xF5CD54AF, 0x8FF0CD2D,
    0x97DEEF7C, 0xB0227E7B, 0x3CDF639A, 0x3D08A50E, 0xE1DA46CE,
  ],
  barSize: [
    0x88000FD5, 0xA01871A7, 0x7686EDDA, 0xE1416018, 0x958EF388,
    0x13126C81, 0x2765E1B7, 0x3D71307E, 0x88B4E6C6, 0x10E2F5B0,
    0x1648E065, 0x504A1088, 0xFD3B602D, 0x6812CAD5, 0x1852E027,
    0x9242C56A, 0xF457E789, 0x51A23AC1, 0xD5B25ABC, 0x576E8F82,
  ],
  diningTime: [
    0x1FF55B9F, 0xA978BDCB, 0x002B3B8C, 0x2FA23CE9, 0x8BB8564D,
    0xF904B547, 0x1C0DE974, 0x22101BA3, 0x0123F161, 0x3D5C6DFC,
    0xFC1C49AE, 0x69BDEDDD, 0x5010FB78, 0xFEC169A2, 0xED03E8BF,
    0x48B513A5, 0xB167FEDD, 0xE479DC59, 0x38194A4C, 0x52F62B47,
  ],
  advertising: [
    0x2E9CC3A3, 0x866999DF, 0x78C6E9DA, 0x50671DE9, 0x25D7ECEE,
    0x1FECB9FD, 0x74FEE8A1, 0x1992FC36, 0x2BEF63DD, 0x0C44D88A,
    0x38F4CF30, 0x5CC8A29A, 0x461782AA, 0x277D2548, 0xD4058AAB,
    0x3BF707CC, 0x929AD4B0, 0x84D53079, 0x6D34BAE0, 0x63E03D06,
  ],
  advancedBatching: [
    0xDD808850, 0x57AF2374, 0xD694979D, 0x6C07EE13, 0x4DC6A9A9,
    0x9BFAA867, 0x4D751D3D, 0x65C94741, 0x81CC46EA, 0x137D86A3,
    0x724739D6, 0x26220A47, 0x5F03008B, 0x5383BF8E, 0x5C209AD9,
    0x1CD24CDB, 0x9BDDC2BC, 0xF41D0C36, 0xD2B81D63, 0x45D84F00,
  ],
  finalChallenge: [
    0x23BD6BD1, 0x81D58C82, 0xC1F3180C, 0xF38C0284, 0x99AD8B77,
    0x09FC1447, 0x2991AFA3, 0xC850CA42, 0xFD355ADB, 0xD1D755E4,
    0xEF678E67, 0xAA067506, 0xCD62D3EB, 0x65F2A9B5, 0x4F5BFD65,
    0xE47D4392, 0x16C220EA, 0x355E7CB1, 0x9EB41F0A, 0x74550B1B,
  ],
};
```

---

## Critical Implementation Notes

These are the things most likely to go wrong. Read them before starting.

### 1. The engine is the most important thing — get it right first

Before building any UI, implement `src/engine/simulation.ts` and write a quick Node script (`scripts/testEngine.ts`) that runs all 6 challenges with their default configs, prints avgProfit for each, and prints the chef utilisation for Batching with batching=on vs batching=off. The engine is correct when:

- **Batching challenge:** `batching=eight` produces higher avgProfit AND higher chefUtilisation than `batching=none`
- **Bar Size challenge:** profit peaks at a mid-range bar size (not minimum, not maximum)
- **Dining Time challenge:** reducing peak-period dining time (7–8 pm) has more impact than reducing early or late
- **Advertising challenge:** higher ad budget increases standard deviation of profit across the 20 runs, not just the mean
- **Advanced Batching:** a time-varying policy (e.g. `none` early, `eight` peak, `four_to_eight` late) beats a uniform `eight` policy on average profit

If these conclusions don't emerge from the engine, adjust `PARAMS` in `params.ts` before building any UI. The numbers must tell the right story. The calibration target for a reasonable default config (batching=eight, barSeats=40, tables=15, diningTime=60, adBudget=1.0, no campaign) is avgProfit in the range $800–$1,600.

### 2. Renege event cancellation

When a party is seated from the bar queue, its renege event is already scheduled in the priority queue. You cannot easily remove it. Handle this by checking in the RENEGE handler: if the party is no longer in `barQueue`, treat the event as a no-op (the party has already been seated). Do NOT try to delete events from the heap.

### 3. `four_share` batching

When this mode is active, model it as `effectiveTables = config.tables * 2` with `effectiveCapacity = 4`. The `tables` array in the engine should be sized to `effectiveTables`. Each physical table appears as two separate table entries. Dining duration is unchanged.

### 4. Time-varying batching

`getModeAtTime` returns a different `BatchingMode` depending on the current simulation time. Apply this at the moment a table becomes free (in `trySeatBatch`), not when the party arrives. This means a party might enter the bar during the early period but get seated under the peak policy if a table only opens during peak.

### 5. Animation is playback, not live simulation

The `FloorView` component replays the pre-computed `events: SimEvent[]` array from the selected `RunStats`. It does NOT re-run the simulation during playback. The engine runs once (or 20 times for the full challenge), stores the complete event array, and the UI just scrubs through it. Use `currentTimeMinutes` state (driven by a `setInterval` or `requestAnimationFrame` timer) and filter events up to `currentTimeMinutes` to derive floor state.

### 6. Bar occupancy derivation for animation

Maintain two derived state objects from the event replay:
- `barParties: Map<partyId, { size, arrivalTime }>` — add on ENTER_BAR, remove on SEAT_DINING or RENEGE
- `tableOccupancy: Map<tableId, { partySize, departTime }>` — add on SEAT_DINING, remove on DEPART

Render the floor plan from these two maps at each animation frame.

### 7. Firebase Firestore rules

The spec's rules are deliberately permissive for a classroom tool (no auth). Write them exactly as specified. Do not add Firebase Auth — it adds friction for students with no security benefit in this context.

### 8. Admin PIN verification

The admin dashboard reads the `instructorPin` field from the class document and compares it client-side. This is acceptable for a classroom tool. Do not implement server-side auth for the admin.

### 9. `vite.config.ts` base path

The GitHub Pages URL will be `https://{username}.github.io/teppanyaki-tonight/`. Set `base: '/teppanyaki-tonight/'` in `vite.config.ts`. Also set `basename="/teppanyaki-tonight"` on the `<BrowserRouter>` in `main.tsx`.

### 10. No `<form>` tags

Use `onClick` and `onChange` handlers throughout. Never use HTML `<form>` elements.

### 11. Tailwind v4

This project uses Tailwind CSS v4 (not v3). Do not use `tailwind.config.js` or the `@apply` directive in component files. Use utility classes directly. CSS variables for the color palette are defined in `index.css` using `@theme`.

---

## Build Order

Follow this order exactly. Do not build the UI before the engine is verified.

**Step 1 — Engine + test script**
- `src/engine/prng.ts` — mulberry32, helpers (randExponential, randNormalBoxMuller, randDiscreteCDF)
- `src/engine/params.ts` — all constants
- `src/engine/seeds.ts` — paste from above
- `src/engine/types.ts` — all TypeScript types
- `src/engine/arrival.ts` — generateArrivals()
- `src/engine/simulation.ts` — runSimulation(), runChallenge()
- `scripts/testEngine.ts` — verification script; run with `npx tsx scripts/testEngine.ts`
- **STOP. Verify all 5 pedagogical conclusions hold before proceeding.**

**Step 2 — Firebase + session**
- `src/firebase/config.ts`
- `src/firebase/classSettings.ts` — getSettings(), subscribeSettings()
- `src/firebase/leaderboard.ts` — submitResult(), subscribeLeaderboard()
- `src/firebase/reflections.ts` — submitReflection(), getReflections()
- `src/store/appContext.tsx`
- `src/components/onboarding/JoinScreen.tsx`
- `src/App.tsx` + routing
- Verify: class code lookup works, settings load, session persists in localStorage

**Step 3 — Prepare tab + static shell**
- `src/components/tabs/PrepareTab.tsx` (static content + flow diagram)
- `src/components/tabs/ChallengesTab.tsx` (tab bar only, no challenge content yet)
- Main 3-tab layout

**Step 4 — Batching challenge (full vertical slice)**
- `src/components/challenges/ChallengeShell.tsx`
- `src/components/challenges/Batching.tsx`
- `src/components/results/OutcomesTable.tsx`
- `src/components/results/DualCharts.tsx`
- `src/components/results/ProfitHistogram.tsx`
- This is the hardest challenge component. The others follow the same pattern.

**Step 5 — Animation**
- `src/components/animation/FloorView.tsx`
- `src/components/animation/TimelineScrubber.tsx`
- `src/components/animation/EventLog.tsx`

**Step 6 — Remaining 5 challenges**
- BarSize, DiningTime, Advertising, AdvancedBatching, FinalChallenge
- Each follows the ChallengeShell pattern; only the config controls differ

**Step 7 — New features**
- `src/components/results/ComparePanel.tsx`
- `src/components/shared/AutoDebrief.tsx`
- `src/components/shared/UtilizationMeter.tsx`

**Step 8 — Leaderboard tab**
- `src/components/tabs/LeaderboardTab.tsx`
- Wire to subscribeLeaderboard()

**Step 9 — Reflection submission**
- Add reflection textarea + submit to ChallengeShell
- Wire to submitReflection()

**Step 10 — Admin dashboard**
- `src/admin/AdminApp.tsx` (PIN gate)
- `src/admin/SettingsTab.tsx`
- `src/admin/LiveBoardTab.tsx` (with Theater Mode)
- `src/admin/ResultsTab.tsx` (with CSV download)
- `src/admin/ReflectionsTab.tsx` (with CSV download)

**Step 11 — GitHub Actions deploy**
- `.github/workflows/deploy.yml`
- `SETUP.md`
- `.env.example`

**Step 12 — Calibration pass**
- Run the test script again with all challenge configs
- Adjust `PARAMS.FIXED_COST_EVENING`, `PARAMS.PATIENCE_MEAN`, and arrival rates if needed
- Target: default config avgProfit $800–$1,600; batching=on beats batching=off by at least 30% on avgProfit

---

## Environment Setup

```bash
npm create vite@latest teppanyaki-tonight -- --template react-ts
cd teppanyaki-tonight
npm install recharts firebase react-router-dom
npm install -D tailwindcss@next @tailwindcss/vite
npm install -D tsx  # for running the test script
```

`vite.config.ts`:
```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  base: '/teppanyaki-tonight/',
  plugins: [react(), tailwindcss()],
})
```

`index.css` (Tailwind v4 + CSS variables):
```css
@import "tailwindcss";

@theme {
  --color-bg: #0d0f14;
  --color-surface: #161923;
  --color-surface-raised: #1e2330;
  --color-border: #2a3040;
  --color-accent: #3b82f6;
  --color-accent-green: #22c55e;
  --color-accent-amber: #f59e0b;
  --color-accent-red: #ef4444;
  --color-text-primary: #f1f5f9;
  --color-text-secondary: #94a3b8;
  --color-text-muted: #4a5568;
}

body {
  background-color: var(--color-bg);
  color: var(--color-text-primary);
  font-family: 'DM Sans', sans-serif;
}
```

Add to `index.html` `<head>`:
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">
```

---

## Reference: Full Spec

The complete spec is in `teppanyaki_tonight_spec.md`. It contains:
- All engine parameters with exact values
- Complete TypeScript types for all engine I/O
- Firebase schema and security rules
- All challenge descriptions, control specs, and reflection questions
- Component architecture and props
- Visual design palette and typography
- Instructor setup guide

When in doubt, the spec is authoritative. If anything in this prompt conflicts with the spec, the spec wins.
