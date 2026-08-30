# Teppanyaki Tonight — Debrief Content Revision

Revises the Theater debrief feature using source-grounded course material. Three structural changes plus rewritten content. Builds directly on the existing `fullDebriefMode` / Debrief-tab work — do not rebuild that, extend it.

Test credentials: class code `test1`, PIN `1234`.

---

## Structural change 1 — multiple debrief screens per challenge

`DebriefContent` currently holds one screen per challenge. Change it to hold an ordered array:

```typescript
interface DebriefScreen {
  title: string;
  visual: DebriefVisual;
  landingLine: string;
  askTheClass: string;
}

interface DebriefContent {
  challengeKey: string;
  screens: DebriefScreen[];   // 1–3 screens
}
```

In the Debrief tab, when a challenge has more than one screen, show simple ← / → arrows plus a small dot indicator (e.g. `● ○`) so the instructor can step through. Single-screen challenges show no navigation chrome at all. Screen position resets to the first screen each time the instructor enters the Debrief tab for a challenge.

## Structural change 2 — Advertising now has debrief content

My earlier spec said Advertising has no entry and to not invent one. That was wrong — it now has content (see below). The existing fallback logic (no Debrief tab when a challenge has no content) should stay in place for robustness, but no challenge in the playlist will trigger it now.

## Structural change 3 — prediction question on the briefing screen

Add `predictionQuestion: string` to each challenge's existing metadata. Render it on the Theater **briefing** screen, beneath the read-only config panel already shown there, styled as a prominent question callout (reuse the "Ask the class" tinted-callout treatment). This gives the instructor something to pose while students wait for the timer to start.

Prediction questions, verbatim:

- **Batching:** `"If demand is already high, can the restaurant still waste capacity?"`
- **Bar Size:** `"If the bar helps, why not make it enormous?"`
- **Dining Time:** `"Is faster always better?"`
- **Advertising:** `"If 8:00pm is already overloaded, what kind of demand is actually valuable?"`
- **Advanced Batching:** `"What should make the rule change?"`
- **Final Challenge:** `"What are you actually optimizing?"`

---

## Revised debrief content

Keep all existing styling (dark Theater theme, green landing-line quote callout, tinted ask-the-class box). Genericized — no proper nouns on screen.

### Batching — REPLACE existing content entirely

**Screen 1 of 1**
- Title: `"Variability Can Waste Capacity Even When Demand Is High"`
- Landing line: `"The problem is not insufficient demand. It is demand arriving in the wrong-sized chunks."`
- Ask the class: `"Demand was high in both cases. So why did one system fail to use its tables?"`
- **Visual — REPLACE the current side-by-side arithmetic grids.** Two labeled columns, no equations anywhere:
  - Left, `"NO BATCHING"`: three separate 8-seat tables stacked, each mostly empty — one with 2 seats filled, one with 3, one with 4. The unfilled seats should read clearly as wasted at a glance.
  - Right, `"BATCHING"`: a single 8-seat table, fully filled, labeled beneath as `"2 + 3 + 3 → one full table"`.
  - Small muted caption under the left column only: `"Same customers. Three tables consumed."`
  - **Do not include any `8 ÷ 1 = 8` style arithmetic.** The source material explicitly says not to teach this comparison; the visual point is fragmentation, not division.

### Bar Size — REPLACE the visual, revise the copy

**Screen 1 of 1**
- Title: `"A Buffer Is Valuable Only If the Process Knows How to Use It"`
- Landing line: `"The bar and the batching policy are complements."`
- Ask the class: `"What makes a bar seat productive? And why can a large bar be bad?"`
- **Visual:** three states across the page — `"TOO SMALL"` (small buffer, fragmented dining), `"JUST RIGHT"` (buffer feeds fuller batches), `"TOO LARGE"` (large waiting area, fewer tables, long waits). Beneath the three states, draw a simple conceptual inverted-U curve labeled `"profit"`, with its peak aligned under "Just Right." The curve is illustrative — do not plot real data or axis values.

### Dining Time — REPLACE with two screens

**Screen 1 — the conceptual distinction (this is the course's spine, lead with it)**
- Title: `"This Time, We Are Changing the Process"`
- Landing line: `"Different kinds of variability need different levers."`
- Ask the class: `"How do you shorten a meal without ever telling a customer to hurry?"`
- Visual: a split panel. Left, `"CHALLENGES 1–2 — Demand variability"` with a small icon row of irregular arrivals feeding a buffer. Right, `"CHALLENGE 3 — Process variability"` with a table and a clock showing 45 / 60 / 75.

**Screen 2 — the payoff**
- Title: `"Faster Creates Capacity. Capacity Creates Value Only When Demand Can Use It."`
- Landing line: `"An idle table at 9pm is not a capacity problem."`
- Ask the class: `"Did faster service help equally throughout the evening, or only during part of it?"`
- Visual: keep the existing clock visual (60 min → 45 min, `+33% table capacity`). This one equation is worth keeping — the source material treats this specific calculation as legitimate and clean, unlike Batching's.

### Advertising — NEW, was previously absent

**Screen 1 of 1**
- Title: `"More Demand Is Not the Same as Better Demand"`
- Landing line: `"An empty table-hour at 5:30 cannot be stored and used at 8:00."`
- Ask the class: `"What good is another 8pm customer if the dining room is already full?"`
- Visual: a simple evening demand curve with a pronounced peak around 8pm. Lightly shade the early-evening region beneath the curve and label it `"unused capacity"`. Three annotated arrows:
  - `AWARENESS` — arrow pointing up across the whole curve — caption `"more total demand"`
  - `DISCOUNT` — arrow up — caption `"more demand, lower margin"`
  - `HAPPY HOUR / OPEN EARLIER` — arrow pointing from the peak leftward toward the shaded early region — caption `"move demand to unused capacity"`

### Advanced Batching — KEEP existing, add one element

Keep the current timeline visual and all copy. Add beneath the timeline a single muted line:

`"Possible triggers: arrival rate · bar queue · empty tables · time to close"`

Revise the ask-the-class to: `"'Be flexible' is not an operating policy. What measurable trigger would you actually use?"`

### Final Challenge — expand to three screens

**Screen 1 — NEW, and the most important addition in this whole revision**
- Title: `"What Are You Actually Optimizing?"`
- Landing line: `"High utilization is not the same as high profit."`
- Ask the class: `"Would your best strategy change if I paid you for throughput instead of profit?"`
- Visual: three large cards side by side — `THROUGHPUT` ("more dinners"), `UTILIZATION` ("busier tables"), `PROFIT` ("economic value") — with a bold `≠` between each pair. Beneath, a small warning-styled line: `"Lost customers = future revenue at risk."`

**Screen 2 — existing Final content, kept as-is**
- Title, landing line, ask, and the connected-nodes visual all unchanged from what's currently built. Add `DEMAND SHAPING` as a fifth node alongside the existing four, now that Advertising is part of the sequence.

**Screen 3 — NEW synthesis**
- Title: `"What Were We Really Managing?"`
- Landing line: `"Demand variability + process variability + operating policy → performance"`
- Ask the class: `"Which single lever would you protect if you could only keep one?"`
- Visual: six compact horizontal bands, each with a label and a short phrase:
  - `BATCHING` — "party-size variability → usable capacity"
  - `BAR` — "stochastic arrivals → buffer and smoothing"
  - `DINING TIME` — "process variability → effective capacity"
  - `ADVERTISING` — "demand timing → shape the load"
  - `DYNAMIC BATCHING` — "system state → operating policy"
  - `FINAL` — "interactions + objective → system optimization"

---

## Summary of files to touch

- `src/theater/debriefContent.ts` — restructure to screen arrays, rewrite/add content per above
- `src/theater/DebriefVisuals.tsx` — replace Batching and Bar visuals, add Advertising, add Final screens 1 and 3, add Dining Time screen 1; keep the existing Dining Time clock and Advanced Batching timeline
- `src/admin/TheaterMode.tsx` — screen navigation within the Debrief tab, prediction question on briefing screen
- Challenge metadata file — add `predictionQuestion` per challenge

Run tsc, verify every debrief screen renders including multi-screen navigation, confirm the briefing prediction question shows for all six challenges, confirm Round/Cumulative is still unchanged when `fullDebriefMode` is false, then commit and push.
