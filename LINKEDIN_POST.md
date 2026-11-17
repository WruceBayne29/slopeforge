# LinkedIn post

> **Before you post — read this once.** The numbers come from the repo (`npm test`,
> `npm run coverage`, `VALIDATION.md`, `npm run e2e`). The post says the code was written by an AI
> coding agent from your specification, because it was; anyone who opens the commit history will
> see that, and saying it yourself reads better than being asked. Two things to do first:
> (1) read `docs/THEORY.md` so you can explain the slice table and Bishop's iteration line by line,
> and (2) look at the "What is not independently verified" list in `VALIDATION.md` — Taylor's
> numbers and some ACADS reference values were entered from memory, so check them against your
> textbook before quoting them as verified. Attach `docs/screenshots/hero.gif` as the post's media.

---

**In class we draw five slices by hand and get one factor of safety. I wanted to see the other
ten thousand circles.**

SlopeForge is a free slope stability analyser that runs in the browser. You draw a slope and its
soil layers, drag the water table, and it searches for the critical slip circle by the method of
slices — then writes out the calculation the way we are taught to do it.

🔗 Try it: https://wrucebayne29.github.io/slopeforge/
💻 Code: https://github.com/WruceBayne29/slopeforge

What it does:

▪️ Ordinary (Fellenius) and Bishop's simplified methods on circular slip surfaces
▪️ Searches around 10,000 trial circles and maps the factor of safety over the grid of centres
▪️ Water table, ru, surcharges, earthquake coefficient and tension cracks
▪️ Slice table, forces on any slice and Bishop's iteration written out step by step
▪️ Sensitivity of F to cohesion, friction and water level, and a PDF report

The part that helped me most: drag the water table up and watch the critical circle move and the
factor of safety drop, slice by slice.

How I built it: I wrote the specification and the quality bar, and used Claude Code as an AI
coding agent to implement it. Deciding what "correct" means was the real work. The engine is
checked against 70 values — Taylor's stability numbers, the ACADS benchmark slopes (1.403 against
a published 1.405 for the three-layer case), the infinite-slope formula and a hand calculation
written out slice by slice — and the repo says plainly which reference values were recalled from
memory rather than re-read from the source.

This is the third tool in a set, after FrameForge (frame analysis) and RCForge (IS 456 concrete
design): https://github.com/WruceBayne29

It is free and open source. If you teach or study geotechnical engineering, I would be grateful if
you tried a slope you already know the answer to and told me where it disagrees with you.

#CivilEngineering #GeotechnicalEngineering #SlopeStability #SoilMechanics #OpenSource #BITSPilani
