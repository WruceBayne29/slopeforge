# Theory

What SlopeForge calculates, and every assumption it makes along the way. The notation is the
usual one of soil mechanics texts (Craig, Das, Duncan & Wright). Forces are per metre run of slope
(plane strain); lengths in m, unit weights in kN/m³, stresses in kPa.

## 1. Limit equilibrium on a circle

A slip surface is a circular arc of radius R about a centre O. The soil above it is treated as a
rigid block about to rotate about O. The **factor of safety** is the ratio by which the shear
strength would have to be divided to bring the block to the point of failure:

$$
\tau_{\text{mobilised}} = \frac{\tau_f}{F}, \qquad \tau_f = c' + \sigma'_n \tan\phi'
$$

Taking moments about O, the normal forces on the arc pass through O and drop out, which is why a
circle is so convenient:

$$
F = \frac{\text{resisting moment}}{\text{driving moment}}
  = \frac{R \sum \left(c' l + N' \tan\phi'\right)}{R \sum W \sin\alpha}
$$

The difficulty is N′, the effective normal force on each part of the arc: it depends on how the
load is shared through the mass, which is statically indeterminate. The method of slices is a
way of estimating it.

## 2. Slices

The mass between the ground and the arc is cut into vertical slices. For slice *i*:

| Symbol | Meaning |
| --- | --- |
| b | width |
| h | mean height (area / b) |
| W | weight, γ × area, summed over the strata in the slice (γsat below the water table) |
| α | inclination of the base, from its mid-point: sin α = (x_m − x_c) / R, positive where the base dips towards the toe |
| l | base length, b sec α |
| u | pore pressure at the middle of the base |
| c′, φ′ | strength of the stratum the base lies in |

**How SlopeForge cuts the slices.** A slice boundary is placed at every vertex of the ground, of
the layer boundaries and of the water table, and at every point where the arc crosses a layer
boundary or the water table; the gaps are then split evenly to reach the requested slice count.
Inside each slice every line is therefore straight, and the area under the arc is integrated
exactly:

$$
\int y_{\text{arc}}\,dx = y_c u - \tfrac12\left(u\sqrt{R^2-u^2} + R^2 \arcsin\frac{u}{R}\right), \quad u = x - x_c
$$

so the weight of every slice is exact whatever the slice count. Only α, taken at the mid-point of
the base, is discretised (VALIDATION.md, group V2, shows this error is below 0.01 % with 200
slices).

## 3. The ordinary method (Fellenius, 1936)

Ignore the forces between slices altogether and resolve each slice's forces perpendicular to its
base:

$$
N' = W\cos\alpha - u l
\qquad
F = \frac{\sum\left(c' l + N'\tan\phi'\right)}{\sum W\sin\alpha}
$$

It needs no iteration and is easy to do by hand, but because it ignores the inter-slice forces it
violates equilibrium of the individual slices. It is usually conservative — 5 to 20 % below
Bishop — and badly so under high pore pressure on a steep base, where W cos α − u l can even
become negative. SlopeForge takes friction as zero on any slice whose N′ is negative and says so
in the results.

## 4. Bishop's simplified method (1955)

Keep the horizontal inter-slice forces, ignore the vertical (shear) ones, and resolve each slice
**vertically**. With S = (c′l + N′ tan φ′)/F mobilised along the base:

$$
W = N'\cos\alpha + u l\cos\alpha + \frac{c' l + N'\tan\phi'}{F}\sin\alpha
$$

which gives

$$
N' = \frac{W - u b - \dfrac{c' b \tan\alpha}{F}}{m_\alpha},
\qquad m_\alpha = \cos\alpha\left(1 + \frac{\tan\alpha\tan\phi'}{F}\right)
$$

The horizontal inter-slice forces cancel when moments are taken for the whole mass, so

$$
F = \frac{\sum \left[c' b + (W - u b)\tan\phi'\right] / m_\alpha}{\sum W\sin\alpha}
$$

F appears on both sides. SlopeForge starts from the ordinary-method value and iterates
F ← g(F) until successive values agree to 10⁻⁶ (usually 4 to 8 steps; the Working tab shows every
one). It reports a failure instead of a number if the iteration does not settle within 100 steps,
if F turns non-positive, or if m_α ≤ 0 on any slice at the converged F; it warns when m_α < 0.2,
where the method is known to be unreliable (steep reversed bases at the toe).

When φ′ = 0 both methods reduce to the same exact expression, F = c_u R θ R / Σ W x, which is how
the φ = 0 validation (V1, V2) checks them.

## 5. Pore pressure

Two ways of describing it:

- **Phreatic line.** u = γw × (vertical depth of the base mid-point below the line). This is the
  usual classroom assumption and is exact for a horizontal water table; under a steeply sloping
  phreatic surface it over-estimates u (the more exact γw h cos² β for parallel seepage is not
  applied). Soil below the line uses γsat where one is given. Where the line is above the ground
  (water standing in front of a slope) the water is a surface load: its weight is added to the
  slices it stands on, and its horizontal thrust on the sloping ground is included as a moment
  about O. VALIDATION.md V5 checks that a fully submerged slope then gives the same answer as a
  dry slope with the buoyant unit weight.
- **Pore pressure ratio** r_u = u / (γ h): u = r_u W / b at each slice. The ratio form of Bishop &
  Morgenstern's charts.

## 6. Loads

- **Surcharge** q (kPa) between two chainages: q × (length of the slice top it covers) is added to
  W. It is not multiplied by the seismic coefficient.
- **Seismic coefficient** kh (pseudo-static): a horizontal force kh × (soil weight) acts on each
  slice at the height of its centroid, towards the toe. It adds kh W (y_c − ȳ)/R to the driving
  side and, in the ordinary method, reduces N′ by kh W sin α.
- **Tension crack** of depth z_c on the high side: the slip surface stops where its depth below the
  ground reaches z_c, and the soil above the crack carries no shear. A crack filled to depth z_w
  pushes with ½ γw z_w², acting z_w/3 above the base of the crack; its moment about O is added to
  the driving side.

## 7. Which way does it slide?

SlopeForge does not ask. The sliding direction is the sign of the gravity moment of the mass
about O; α is measured accordingly. Slopes that rise to the left are analysed the same way as
slopes that rise to the right (unit tests check that a mirrored section gives the same F).

## 8. Finding the critical circle

The factor of safety of one circle is not the factor of safety of the slope: that is the
**minimum** over all possible circles. SlopeForge searches in three stages.

1. **A grid of trial centres** (16 × 16 by default) over a rectangle above the slope, chosen from
   the geometry or dragged by the user.
2. **A radius scan at each centre.** The radius runs from "just touching the ground" to "touching
   the firm base or reaching the end of the section" in 12 steps; the best one is refined by
   golden-section search between its neighbours. The lowest F at each centre goes on the map.
3. **Local refinement.** From the three best local minima of the grid, a compass search moves the
   centre in halving steps, re-optimising the radius at every trial, until the step is a few
   millimetres.

Circles that cannot be analysed — missing the slope, running out of the section, passing below
the firm base, turning vertical below ground, or shallower than the minimum depth — are skipped
and their reasons are reported if a trial circle is placed there by hand.

The **FoS map** contours the minimum F at each grid centre (marching squares). A closed bowl
around the critical centre means the search has found a genuine minimum; contours running off the
edge of the grid mean the grid should be moved.

**Sensitivity.** Each sensitivity curve varies one quantity (c′ or tan φ′ by a factor 0.5–1.5, the
water table by ± 30 % of the slope height, or r_u from 0 to 0.6) and re-optimises the circle
locally from the current critical one at every point, so the curve follows the slip surface as it
moves.

## 9. The infinite slope

For a long, shallow slip parallel to a slope of angle β at depth z, resolving normal and parallel
to the plane:

$$
F = \frac{c'\sec\beta + \left[\gamma z(\cos\beta - k_h\sin\beta) - u\sec\beta\right]\tan\phi'}{\gamma z\left(\sin\beta + k_h\cos\beta\right)}
$$

which with no water or earthquake is the familiar

$$
F = \frac{c'}{\gamma z \sin\beta\cos\beta} + \frac{\tan\phi'}{\tan\beta}
$$

A circle with a 100 m chord lying 0.5 m below a uniform incline must reproduce it; VALIDATION.md
(group V4) shows that it does, to within 0.2 %.

## 10. What is not modelled

- Non-circular slip surfaces, and the rigorous methods that satisfy both force and moment
  equilibrium (Spencer, Morgenstern–Price). Bishop's simplified method is usually within a few per
  cent of them for circles.
- Seepage analysis: the phreatic line is an input, not a result.
- Anisotropic or depth-varying strength, curved strength envelopes, partial factors, soil
  reinforcement, anchors and three-dimensional effects.
- Progressive failure and strain softening: limit equilibrium assumes the whole surface reaches
  its peak strength at once.

## References

- Bishop, A.W. (1955). The use of the slip circle in the stability analysis of slopes.
  *Géotechnique* 5(1), 7–17.
- Bishop, A.W. & Morgenstern, N. (1960). Stability coefficients for earth slopes.
  *Géotechnique* 10(4), 129–150.
- Donald, I.B. & Giam, P. (1989). *Soil slope stability programs review.* ACADS publication U255,
  Melbourne.
- Duncan, J.M., Wright, S.G. & Brandon, T.L. (2014). *Soil Strength and Slope Stability*, 2nd ed.
  Wiley.
- Fellenius, W. (1936). Calculation of the stability of earth dams. *Trans. 2nd Congress on Large
  Dams*, Washington, 4, 445–462.
- Taylor, D.W. (1937). Stability of earth slopes. *J. Boston Soc. Civil Engineers* 24(3), 197–246.
