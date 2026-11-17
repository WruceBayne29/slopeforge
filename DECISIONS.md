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
