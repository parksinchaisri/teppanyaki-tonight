# Teppanyaki Tonight — Little's Law Connective Layer

Adds a visual Little's Law spine across the existing debrief screens. **Do not rebuild the debrief architecture** — this extends what's already there with one new shared component plus three small content edits.

Test credentials: class code `test1`, PIN `1234`.

Context: students are taught `R = I / T` immediately before the game, with the process boundary defined as **the dining room only** — `I` is customers seated and being served in the dining room, `T` is dining-room throughput time, `R` is output rate. Customers waiting in the bar are explicitly *outside* this boundary. That precision matters for the Bar Size screen below.

---

## 1. New shared component: `LittleLawStrip`

A compact, persistent strip rendered on every debrief screen, positioned between the visual and the landing line. Small and quiet — this is connective tissue, not the headline. Roughly one line tall at Theater's projection scale.

Renders `R = I / T` in monospace with per-term emphasis driven by props:

```typescript
type LLTerm = 'R' | 'I' | 'T';

interface LittleLawStripProps {
  highlight: LLTerm[];        // terms rendered in the accent color, bolder
  strikethrough?: LLTerm[];   // terms rendered with a line through them (Final screen 1 only)
  caption: string;            // one short line beneath the equation
  muted?: boolean;            // whole strip dimmed — used for "the equation is static"
}
```

Unhighlighted terms render in the muted text color so the highlighted one visibly pops. Keep it in Theater's existing dark theme and accent palette.

---

## 2. Per-screen configuration

Add the strip to each of the nine existing debrief screens with these exact settings:

| Screen | highlight | caption |
|---|---|---|
| **Batching** | `['I']` | `"Batching does not add seats. It keeps the seats we own productively occupied."` |
| **Bar Size** | `['I']` | `"The bar sits outside this boundary. Its job is to protect I."` |
| **Dining Time — screen 1** | `['I','T']` | `"Challenges 1 and 2 protect I. This one changes T."` |
| **Dining Time — screen 2** | `['T']` | `"Same seats, less time each — more output."` |
| **Advertising** | `['R']` | `"The equation assumes customers are there to fill the seats. Marketing decides whether they are."` |
| **Advanced Batching** | `[]` + `muted: true` | `"The equation is static. The restaurant is not."` |
| **Final — screen 1** | `['R']` + `strikethrough: ['R']` | `"Maximizing R is not the objective."` |
| **Final — screen 2** | `['I','T']` | `"Every lever moves I, T, or whether either one matters."` |
| **Final — screen 3** | `['R','I','T']` | `"Little's Law gives the static levers. Process Dynamics operates them under changing demand."` |

---

## 3. Three content edits

**Dining Time, screen 1 — replace the landing line.**
- From: `"Different kinds of variability need different levers."`
- To: `"Challenges 1 and 2 protect I. Challenge 3 changes T."`

Everything else on that screen (title, visual, ask-the-class) is unchanged.

**Final Challenge, screen 3 — revise the six synthesis bands** to the Little's Law narration. Keep the same six-band visual structure and the same left-hand labels; replace only the right-hand phrases:

- `BATCHING` — "protect productive I from party-size variability"
- `BAR` — "buffer arrivals so productive I stays full"
- `DINING TIME` — "reduce T when faster flow is valuable"
- `ADVERTISING` — "shape demand so capacity is useful at the right time"
- `DYNAMIC BATCHING` — "change the policy as the system state changes"
- `FINAL` — "maximizing flow is not the same as maximizing profit"

**Final Challenge, screen 3 — replace the landing line.**
- From: `"Demand variability + process variability + operating policy → performance"`
- To: `"Process analysis tells us what moves flow. Management tells us which flow is worth creating."`

---

## 4. Explicitly do not change

- All other landing lines, titles, visuals, and ask-the-class questions stay exactly as they are. They are stronger as projected copy than more abstract WIP-vocabulary alternatives.
- The `fullDebriefMode` toggle, Debrief tab, multi-screen navigation, fallback behavior, and briefing prediction questions are untouched.
- No new debrief screens.

---

Run tsc, verify the strip renders correctly on all nine screens with the right term highlighted in each case (including the strikethrough on Final screen 1 and the muted state on Advanced Batching), confirm the three content edits landed, confirm Round/Cumulative is still unchanged when `fullDebriefMode` is false, then commit and push.
