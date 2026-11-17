# Decisions log

Calls made autonomously while building, newest last.

1. **Separate repo and site** (`slopeforge`), toolchain copied from RCForge (TypeScript pinned to
   6.0 for typescript-eslint, ESLint + Prettier, Vitest, relative Vite base, same CI and Pages
   workflows).
2. **Visual identity: a site-investigation drawing, not a dashboard.** The main view is a
   geological cross-section sheet: white ground, black linework, strata filled with muted earth
   tones and traditional hatch patterns (stipple for sand, dashes for clay, and so on), an
   elevation axis (RL) and a chainage axis, a scale bar and a drawing title block. Soils are
   edited in a table laid out like a **borehole log** (legend strip, description, γ, c′, φ′).
   Colour is used only where a drawing would use it: blue for water, red for the slip surface.
   Lettering is condensed uppercase sans (Barlow Condensed) with monospace figures (JetBrains
   Mono). Square corners, no gradients, no pills, no shadows. Light only.
3. **Slices use exact areas.** Slice boundaries are placed at every ground, layer and water-table
   vertex and at every point where the circle crosses a layer boundary or the water table, so
   inside a slice every line is straight and the arc is integrated analytically. Weights are
   therefore exact for any slice count; only the base angle (taken at the mid-width of the base,
   as in a hand calculation) is discretised.
4. **Pore pressure from a phreatic line is γw × vertical depth below the line** at the base
   mid-point. This is the usual classroom assumption; it over-estimates u under a steeply sloping
   phreatic surface (no cos² correction). Stated in THEORY.md.
5. **Negative effective normal force on a slice base is taken as zero friction** (the slice keeps
   its cohesion) in both methods, with a note on the result, rather than letting friction go
   negative.
6. **Sliding direction comes from the sign of the gravity moment about the circle centre**, so
   slopes facing either way work without the user declaring which side is the toe.
7. **The seismic coefficient acts on soil weight only**, horizontally towards the toe, at the
   centroid height of each slice. Surcharges are not multiplied by kh.
8. **When a circle dips below the ground in more than one place, the stretch whose ends differ
   most in elevation is the slip surface.** A circle through a steep face near the toe also passes
   under the level ground in front; taking the widest stretch (the first implementation) picked
   the wrong one and missed Taylor's toe circles for steep slopes by 4 %.
9. **The ordinary method uses the textbook N′ = W cos α − u l**, not the "effective weight"
   variant, so hand calculations match. Its known weakness under high pore pressure is reported
   as a warning and explained in THEORY.md; the submerged-slope validation uses Bishop.
10. **Search = grid of centres × radius scan × golden-section on radius, then a compass search**
    from the three best local minima of the grid, re-optimising the radius at every step.
    The radius range at a centre runs from "just touching the ground" to "touching the firm base
    or the far end of the section".
11. **The search runs in a web worker** (`src/ui/analysis.worker.ts`) and only the newest request
    is kept while one is running, so dragging a point never queues work. A hand-placed trial
    circle is analysed on the main thread because one circle takes under a millisecond.
12. **Sensitivity curves re-optimise the circle locally** (`refineCircle`) from the current
    critical circle at each point instead of a full grid search: nine points per curve stay fast
    enough to compute on demand, and the curve follows the critical surface as it moves.
13. **Nine examples**, including the three ACADS benchmarks, rather than the six asked for, so the
    validated problems can be opened in the app.
14. **The forces-on-a-slice drawing is a schematic**: true base and ground angles, a fixed width
    and force arrows to scale with one another, because real slices are often ten times taller
    than wide.
15. **On phones the centre grid starts hidden** and the title block moves under the scale bar.
