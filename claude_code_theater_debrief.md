# Teppanyaki Tonight — Theater Debrief Feature

Adds an optional third view to Theater Mode's `round_results` phase: a clean, minimal debrief screen per challenge, sitting alongside the existing Round/Cumulative toggle. Content sourced from course material, genericized for the projected screen (no proper nouns — see rationale below).

Test credentials: class code `test1`, PIN `1234`.

---

## 1. Setting

Add `fullDebriefMode: boolean` to `ClassSettings`, default `true`, toggle in Setup near the other Live Session settings.

---

## 2. The three-way view switch

In `round_results`, the existing `roundView: 'round' | 'cumulative'` becomes `roundView: 'round' | 'cumulative' | 'debrief'`. When `fullDebriefMode` is `false`, behavior is unchanged from today — only two options. When `true`, a third tab, **"Debrief"**, appears — but only if debrief content exists for the current challenge (see Section 3). If no content exists for that challenge (e.g. Advertising, which has none), the tab does not render at all — do not show an empty state, just fall back to the existing two-way toggle for that specific challenge.

The instructor can move freely between Round / Cumulative / Debrief in any order, any number of times, before clicking **Next Challenge** — nothing here is sequenced or gated. Next Challenge remains available regardless of which view is currently showing.

---

## 3. Debrief content — data-driven, one object per challenge

```typescript
interface DebriefContent {
  challengeKey: string;
  title: string;              // the "big idea" headline
  visual: DebriefVisual;       // see Section 4 — one bespoke component per challenge
  landingLine: string;         // one short bolded/quoted takeaway sentence
  askTheClass: string;         // one open discussion question, no answer shown
}
```

Store these as a small static array/map in a new file, e.g. `src/theater/debriefContent.ts` — not fetched from Firestore, just local content like the existing challenge descriptions.

**Exact content, verbatim, genericized (no proper nouns — "the restaurant," not "Benihana"; no owner name):**

### Batching
- Title: `"A Half-Full Table Still Uses a Full Chef Cycle"`
- Landing line: `"The scarce resource is the chef cycle — not just the empty chair."`
- Ask the class: `"When is the capacity gained from batching worth the wait it creates?"`
- Visual: see 4a

### Bar Size
- Title: `"The Bar Is Part of the Process"`
- Landing line: `"A buffer can protect a constrained resource — but the buffer itself is not free."`
- Ask the class: `"Who increased the buffer and improved batching, but eventually gave up too much dining capacity to do it?"`
- Visual: see 4b

### Dining Time
- Title: `"Faster Service Creates Capacity. But Is Capacity Always Valuable?"`
- Landing line: `"Capacity is valuable only when demand wants to use it."`
- Ask the class: `"Did faster service help equally throughout the evening, or only some of it?"`
- Visual: see 4c

### Advanced Batching
- Title: `"The Best Rule Changes With the System"`
- Landing line: `"Same restaurant. Different state. Different policy."`
- Ask the class: `"What single number would you want to check before deciding whether to change the seating rule right now?"`
- Visual: see 4d

### Final Challenge
- Title: `"There Is No Best Lever. There Is a Best System."`
- Landing line: `"The value of each decision depends on all the others."`
- Ask the class: `"Pick two strategies with similar results but different choices. Which single change would have broken one of them if applied to the other?"`
- Visual: see 4e

**Advertising has no entry** — intentional, matches the source material, and matches this instructor's actual playlist which excludes it. Do not invent content for it.

---

## 4. Visuals — reuse the app's existing dark/accent visual language, not the print-deck palette

These render inside the projected Theater screen, so match Theater's existing dark background and accent-blue/green treatment already established elsewhere in the app — do NOT use the ember/print palette from the separate slide deck; that's a different artifact.

**4a — Batching:** two seat-grids side by side (reuse the same 8-seat grid motif already built for the Prepare page / slide deck concept — filled vs. empty squares). Left: 8 of 8 filled, labeled "FULL TABLE" with "8 ÷ 1hr = 8/hr" beneath. Right: 4 of 8 filled, labeled "HALF-FULL TABLE" with "4 ÷ 1hr = 4/hr" beneath, plus a small muted annotation "50% of batch capacity unused" under the right grid.

**4b — Bar Size:** reuse the existing Arrivals → Bar → Dining Room flow-diagram component already built for the Prepare page, relabeled: "ARRIVALS (small groups)" → "BAR — buffer, groups collect" → "TABLE — fuller batches". Below it, two small side-by-side callouts: "Too small → poor batching" and "Too large → dining space + waiting."

**4c — Dining Time:** one table icon with a simple clock element. Left state: "60 MIN MEAL" with "8 ÷ 1.00 = 8/hr" beneath. Arrow. Right state: "45 MIN MEAL" with "8 ÷ 0.75 = 10.67/hr" beneath. Below both, large: "+33% table capacity."

**4d — Advanced Batching:** a horizontal timeline with three labeled points — "EARLY: few arrivals → seat more freely", "PEAK: many arrivals → wait for fuller batches", "LATE: few arrivals left → stop waiting."

**4e — Final Challenge:** a center circle labeled "PROFITABLE CUSTOMER FLOW" with four smaller nodes connected to it by lines: "BATCHING — fills chef cycles", "BUFFER — stores arrivals", "DINING TIME — creates capacity", "DYNAMIC POLICY — matches decisions to demand."

Keep every visual genuinely minimal per the source design principle — one idea, one visual, one line. No dense tables, no bullet recaps, no restating the round's actual profit numbers (Theater already showed those in the Round/Cumulative views).

---

## 5. Layout

Debrief view content, top to bottom: title (large), the visual (centered, generous whitespace), landing line (styled as a distinct quote — reuse the "Ask the Class" tinted-callout pattern already established in the print slide deck's visual language, adapted to Theater's dark theme), then the ask-the-class question in its own smaller callout beneath it.

Keep it large and legible at projection scale, consistent with the rest of Theater Mode's type sizing.

---

## Summary of files to touch

- `src/firebase/types.ts` — `fullDebriefMode: boolean` on `ClassSettings`
- `src/admin/SetupTab.tsx` — toggle
- `src/theater/debriefContent.ts` (new) — the five content objects
- `src/theater/DebriefVisuals.tsx` (new) — five small visual components (4a–4e)
- `src/admin/TheaterMode.tsx` — three-way view switch, conditional Debrief tab, render the debrief content when active

Run tsc after building, verify all five debrief screens render correctly and the Advertising fallback (no tab) works, confirm Round/Cumulative behavior is completely unchanged when `fullDebriefMode` is false, then commit and push.
