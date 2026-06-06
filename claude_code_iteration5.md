# Teppanyaki Tonight — Iteration 5 Fixes

Two focused changes. Read existing code before editing. Test credentials: class code `test1`, PIN `1234`.

---

## 1. Animation speed — slow down base rate, add 0.25× option

**The problem:** the current 1× speed feels approximately 2× too fast. The 0.5× option feels like what 1× should be.

**Fix A — halve the base playback rate.**

Find where the animation interval advances simulation time (likely a `setInterval` or `requestAnimationFrame` in `AnimationPanel.tsx` or `TimelineScrubber.tsx`). The base tick rate (minutes of sim time advanced per real-time second at 1× speed) should be halved. For example if it currently advances 9 sim-minutes per real-second at 1×, change it to 4.5. This makes the existing speed buttons feel correctly labelled.

**Fix B — add 0.25× and update the speed selector.**

Change the speed options from `[0.5, 1, 2, 4]` to `[0.25, 0.5, 1, 2, 4]`. Display as: `0.25×  0.5×  1×  2×  4×`. Default to `0.5×` (the new middle-slow option) so students see a comfortable pace by default without having to change anything.

---

## 2. Results section — compact stat cards

The four stat cards (AVG PROFIT / BEST NIGHT / AVG LOST GUESTS / CHEF UTILISATION) currently render as a single wide row of tall cards that takes up significant vertical space. Make them more compact.

**Target layout:** a 2×2 grid of smaller cards, each roughly half the current height. They should feel like a dashboard readout, not large feature boxes.

Specific changes:
- Reduce card padding from whatever it currently is to `px-4 py-3`
- Reduce the label font size to `text-xs` uppercase tracking-wide (muted color)
- Reduce the value font size from the current large size to `text-2xl` (still prominent but not oversized)
- Arrange as `grid grid-cols-2 gap-3` instead of `grid-cols-4`
- Total height of the 2×2 grid should be roughly 120–140px

Also compact the **Submit button + confirmation area**:
- The green Submit button doesn't need to be full-width. Make it a normal-width button (`w-auto px-8`) aligned left, with the confirmation text inline to its right rather than below it
- This collapses the submit area from ~120px tall to ~48px tall

Apply these changes everywhere the stat summary cards appear (ChallengeShell results view) — not just Final Challenge.

---

## Summary of files to touch

- `src/components/animation/AnimationPanel.tsx` (or wherever the tick interval lives) — speed fix
- `src/components/results/` or `ChallengeShell.tsx` — stat card layout and submit button compaction

Do not change the engine, seeds, challenge configs, Firebase, or any other behaviour.
