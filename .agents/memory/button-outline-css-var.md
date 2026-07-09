---
name: Missing --button-outline CSS var
description: Outline-variant buttons get a black (light mode) or white (dark mode) border instead of the intended subtle border when a theme's index.css omits --button-outline.
---

The shared `Button` component's `outline` variant uses `border-[color:var(--button-outline)]`. The design-system template defines `--button-outline: rgba(0,0,0,.10)` in `:root` and `rgba(255,255,255,.10)` in `.dark`. If a project's `index.css` was hand-rolled or imported from elsewhere and this var is missing, the browser falls back to `currentcolor`, producing a stark black/white border on every `variant="outline"` button (visually mismatched vs. Select/Input borders).

**Why:** Found in NexusCRM (artifacts/crm) — its `index.css` had the rest of the design-system theme tokens but not `--button-outline`, causing the "Columns" button to show a black border while Select/Input controls looked normal.

**How to apply:** If a user reports an outline button (or icon button) with a mismatched dark border, grep `index.css` for `--button-outline` before assuming a component-level styling bug — it's often just a missing CSS variable.
