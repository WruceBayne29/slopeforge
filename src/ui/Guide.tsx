import { useEffect, useLayoutEffect, useState } from 'react';

/** "About this tool" — what it does, its conventions and its limits. */
export function About({ onClose, onTour }: { onClose: () => void; onTour: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="veil" onClick={onClose}>
      <div
        className="note"
        role="dialog"
        aria-modal="true"
        aria-label="About SlopeForge"
        onClick={(e) => e.stopPropagation()}
      >
        <h2>About SlopeForge</h2>
        <p>
          SlopeForge finds the factor of safety of a soil slope against sliding on a circular
          surface. It cuts the sliding mass into vertical slices, works out the forces on each, and
          searches for the circle with the lowest factor. Everything runs in your browser; nothing
          is uploaded.
        </p>
        <h3>Methods</h3>
        <p>
          The <b>ordinary method</b> (Fellenius, 1936) ignores the forces between slices.{' '}
          <b>Bishop’s simplified method</b> (1955) keeps the horizontal ones and iterates for F; it
          is the better of the two and the default. Both take moments about the centre of the
          circle. Strength is c′ + σ′ tan φ′ on the base of each slice; use φ′ = 0 with c′ = c
          <sub>u</sub> for an undrained analysis.
        </p>
        <h3>Conventions</h3>
        <p>
          Chainage and reduced level in metres, unit weights in kN/m³, stresses in kPa, forces per
          metre run of slope. Pore pressure is γ<sub>w</sub> × depth below the water table, or r
          <sub>u</sub> × overburden. The slope may face either way.
        </p>
        <h3>What it does not do</h3>
        <p>
          Non-circular slip surfaces, the rigorous methods (Spencer, Morgenstern–Price),
          reinforcement, three-dimensional effects and seepage analysis are outside its scope. It is
          a learning tool: check anything that matters against an independent analysis.
        </p>
        <h3>Keys</h3>
        <p className="keys">
          <kbd>Ctrl</kbd>+<kbd>Z</kbd> undo · <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Z</kbd> redo ·{' '}
          <kbd>Ctrl</kbd>+<kbd>S</kbd> save · <kbd>M</kbd> centre grid · <kbd>L</kbd> slices ·{' '}
          <kbd>T</kbd> trial circle · <kbd>←↑↓→</kbd> nudge the selected point · <kbd>Del</kbd>{' '}
          remove it · <kbd>Alt</kbd>+drag ignores snap · <kbd>?</kbd> this note
        </p>
        <div className="row">
          <button type="button" onClick={onTour}>
            Show me round
          </button>
          <button type="button" className="solid" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

const STEPS: Array<{ target: string; title: string; body: string }> = [
  {
    target: 'drawing',
    title: 'The section',
    body: 'A cross-section through the slope, drawn like a site-investigation section. Drag the square points to reshape the ground and the diamonds to move layer boundaries or the water table. Double-click a line to add a point.',
  },
  {
    target: 'log',
    title: 'The borehole log',
    body: 'Each stratum has a hatch, a unit weight, a cohesion and a friction angle. Groundwater, surcharges, an earthquake coefficient and a tension crack are set below it.',
  },
  {
    target: 'results',
    title: 'The answer',
    body: 'The lowest factor of safety found, by Bishop and by the ordinary method, and the circle that gives it. Place a trial circle of your own to see why the critical one is critical.',
  },
  {
    target: 'details',
    title: 'The working',
    body: 'The slice table, the calculation written out as you would do it by hand, the forces on any slice, the two methods side by side, and how F responds to strength and water level.',
  },
  {
    target: 'actions',
    title: 'Keep it or pass it on',
    body: 'Load a worked example, save the section as a file, copy a link that reopens it, or download a PDF report.',
  },
];

/** First-visit walkthrough: one part of the page at a time. */
export function Tour({ onClose }: { onClose: () => void }) {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const step = STEPS[index];
  const last = index === STEPS.length - 1;

  useLayoutEffect(() => {
    const target = document.querySelector(`[data-tour="${step.target}"]`);
    target?.scrollIntoView({ block: 'nearest' });
    const measure = () => setRect(target?.getBoundingClientRect() ?? null);
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [step.target]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight' || e.key === 'Enter') {
        e.preventDefault();
        if (last) onClose();
        else setIndex(index + 1);
      }
      if (e.key === 'ArrowLeft' && index > 0) setIndex(index - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, last, onClose]);

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const cardW = Math.min(340, vw - 24);
  const cardH = 190;
  let left = (vw - cardW) / 2;
  let top = (vh - cardH) / 2;
  if (rect) {
    if (rect.width > vw * 0.45 && rect.height > vh * 0.45) {
      left = rect.left + 30;
      top = rect.top + 30;
    } else if (rect.right + cardW + 20 < vw) {
      left = rect.right + 14;
      top = rect.top + 10;
    } else if (rect.left - cardW - 20 > 0) {
      left = rect.left - cardW - 14;
      top = rect.top + 10;
    } else if (rect.bottom + cardH + 20 < vh) {
      left = rect.left;
      top = rect.bottom + 12;
    } else {
      left = rect.left;
      top = rect.top - cardH - 12;
    }
  }
  left = Math.min(Math.max(12, left), vw - cardW - 12);
  top = Math.min(Math.max(12, top), vh - cardH - 12);

  return (
    <div className="tour" role="dialog" aria-modal="true" aria-label="Introduction">
      {rect ? (
        <div
          className="tour-frame"
          style={{
            left: Math.max(2, rect.left - 4),
            top: Math.max(2, rect.top - 4),
            width: Math.min(vw - 4, rect.width + 8),
            height: Math.min(vh - 4, rect.height + 8),
          }}
        />
      ) : (
        <div className="veil" />
      )}
      <div className="note tour-card" style={{ left, top, width: cardW }}>
        <small>
          {index + 1} of {STEPS.length}
        </small>
        <h2>{step.title}</h2>
        <p>{step.body}</p>
        <div className="row">
          <button type="button" className="plain-button" onClick={onClose}>
            Skip
          </button>
          {index > 0 && (
            <button type="button" onClick={() => setIndex(index - 1)}>
              Back
            </button>
          )}
          <button
            type="button"
            className="solid"
            onClick={() => (last ? onClose() : setIndex(index + 1))}
          >
            {last ? 'Start' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}
