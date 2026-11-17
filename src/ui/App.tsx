import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { analyseCircle, prepare } from '../engine';
import type { CircleAnalysis, PreparedModel, SlopeModel } from '../engine';
import { parseProjectText, ProjectFormatError, serializeProject } from '../io/projectFile';
import { decodeProject, payloadFromHash, shareUrl } from '../io/share';
import { deletePoint, linePoints, movePoint } from '../model/edit';
import { defaultProject, EXAMPLES, findExample } from '../model/examples';
import { historyReducer, startHistory } from '../model/history';
import { cleanSettings, cloneProject } from '../model/project';
import type { Project, Settings } from '../model/project';
import { Compare, Sensitivity, SliceForces, SliceTable, Working } from './Details';
import type { DetailTab } from './Details';
import { buildReport, reportFileName } from '../io/report';
import { TextField } from './fields';
import { About, Tour } from './Guide';
import { LogPanel } from './LogPanel';
import { Results } from './Results';
import { rasterise } from './rasterise';
import { Section } from './Section';
import type { Selection } from './Section';
import { notify, Toasts } from './toast';
import { useAnalysis } from './useAnalysis';

const TABS: { id: DetailTab; label: string }[] = [
  { id: 'slices', label: 'Slice table' },
  { id: 'working', label: 'Working' },
  { id: 'forces', label: 'Slice forces' },
  { id: 'compare', label: 'Fellenius vs Bishop' },
  { id: 'sensitivity', label: 'Sensitivity' },
];

const TOUR_KEY = 'slopeforge-tour-seen';

function Logo() {
  return (
    <svg className="logo" width="30" height="30" viewBox="0 0 64 64" aria-hidden="true">
      <path d="M3 50h18l24-28h16v39H3z" fill="#e6dccb" stroke="#16181a" strokeWidth="3" />
      <path d="M14 50a30 30 0 0 0 40-28" fill="none" stroke="#c2311d" strokeWidth="3.5" />
      <circle cx="24" cy="11" r="3" fill="#16181a" />
    </svg>
  );
}

function download(name: string, text: string, type: string): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const slug = (title: string): string =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'slope';

export function App() {
  const [history, dispatch] = useReducer(historyReducer, undefined, () =>
    startHistory(defaultProject()),
  );
  const project = history.present;
  const { model, settings } = project;
  const [selection, setSelection] = useState<Selection | null>(null);
  const [selectedSlice, setSelectedSlice] = useState<number | null>(null);
  // On a phone the centre grid crowds the section, so it starts hidden there.
  const [showMap, setShowMap] = useState(() => window.innerWidth >= 700);
  const [showSlices, setShowSlices] = useState(true);
  const [tab, setTab] = useState<DetailTab>('slices');
  const [exampleId, setExampleId] = useState(EXAMPLES[0].id);
  const [about, setAbout] = useState(false);
  const [tour, setTour] = useState(() => {
    try {
      return window.localStorage.getItem(TOUR_KEY) === null && !window.location.hash;
    } catch {
      return false;
    }
  });
  const endTour = useCallback(() => {
    setTour(false);
    try {
      window.localStorage.setItem(TOUR_KEY, '1');
    } catch {
      // private browsing: the tour will simply show again next time
    }
  }, []);
  const fileInput = useRef<HTMLInputElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const prepared = useMemo<PreparedModel | null>(() => {
    try {
      return prepare(model);
    } catch {
      return null;
    }
  }, [model]);

  const analysis = useAnalysis(model, settings, {
    sensitivity: tab === 'sensitivity',
    other: tab === 'compare',
  });
  const response = analysis.response;
  const search = response?.search ?? null;
  const critical = prepared ? (search?.critical ?? null) : null;
  const trial = useMemo<CircleAnalysis | null>(
    () =>
      settings.trial && prepared
        ? analyseCircle(prepared, settings.trial, { slices: settings.slices })
        : null,
    [prepared, settings.trial, settings.slices],
  );
  const shown = trial?.ok ? trial : critical;

  const commit = useCallback((next: Project) => dispatch({ type: 'commit', project: next }), []);
  const commitModel = useCallback(
    (m: SlopeModel) => commit({ ...project, model: m }),
    [commit, project],
  );
  const commitSettings = useCallback(
    (patch: Partial<Settings>) =>
      commit({ ...project, settings: cleanSettings({ ...settings, ...patch }) }),
    [commit, project, settings],
  );
  const load = useCallback((next: Project) => {
    dispatch({ type: 'load', project: cloneProject(next) });
    setSelection(null);
    setSelectedSlice(null);
  }, []);

  // A project in the URL fragment takes precedence over the default example.
  useEffect(() => {
    const payload = payloadFromHash(window.location.hash);
    if (!payload) return;
    decodeProject(payload)
      .then((shared) => {
        load(shared);
        setExampleId('');
        notify('Opened the section from the link.');
      })
      .catch((e: unknown) =>
        notify(e instanceof Error ? e.message : 'This link could not be opened.', 'error'),
      );
  }, [load]);

  const toggleTrial = useCallback(() => {
    if (settings.trial) commitSettings({ trial: null });
    else if (critical) {
      const c = critical.circle;
      commitSettings({
        trial: { xc: Math.round(c.xc), yc: Math.round(c.yc + 2), r: Math.round(c.r + 2) },
      });
    } else {
      const g = model.ground;
      const span = g[g.length - 1].x - g[0].x;
      const high = Math.max(...g.map((p) => p.y));
      commitSettings({ trial: { xc: g[0].x + span / 2, yc: high + span / 4, r: span / 3 } });
    }
  }, [settings.trial, critical, commitSettings, model.ground]);

  const save = (): void => {
    download(
      `${slug(project.title)}.slopeforge.json`,
      serializeProject(project),
      'application/json',
    );
    notify('Saved the section as a JSON file.');
  };
  const open = async (file: File | undefined): Promise<void> => {
    if (!file) return;
    try {
      if (file.size > 2_000_000)
        throw new ProjectFormatError('This file is too large to be a SlopeForge section.');
      load(parseProjectText(await file.text()));
      setExampleId('');
      notify(`Opened ${file.name}.`);
    } catch (e) {
      notify(e instanceof Error ? e.message : 'The file could not be opened.', 'error');
    }
  };
  const share = async (): Promise<void> => {
    const url = await shareUrl(project, window.location.href);
    window.history.replaceState(null, '', url);
    try {
      await navigator.clipboard.writeText(url);
      notify('Link copied. Anyone who opens it gets this section.');
    } catch {
      notify('The link is in the address bar; copy it from there.');
    }
  };

  const pdf = async (): Promise<void> => {
    if (!shown) {
      notify('There is no slip circle to report yet.', 'error');
      return;
    }
    try {
      const figure = svgRef.current ? await rasterise(svgRef.current, 2.5).catch(() => null) : null;
      const doc = buildReport({
        project,
        result: shown,
        kind: trial?.ok ? 'trial' : 'critical',
        search,
        figure,
      });
      doc.save(reportFileName(project.title));
      notify('PDF report downloaded.');
    } catch (e) {
      notify(
        e instanceof Error
          ? `The PDF could not be made: ${e.message}`
          : 'The PDF could not be made.',
        'error',
      );
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (about || tour) return;
      const target = e.target as HTMLElement | null;
      const typing =
        target !== null &&
        (/^(SELECT|TEXTAREA)$/.test(target.tagName) ||
          (target.tagName === 'INPUT' &&
            !/^(checkbox|radio|file)$/.test((target as HTMLInputElement).type)));
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'z') {
        if (typing) return;
        e.preventDefault();
        dispatch({ type: e.shiftKey ? 'redo' : 'undo' });
        return;
      }
      if (mod && e.key.toLowerCase() === 'y') {
        if (typing) return;
        e.preventDefault();
        dispatch({ type: 'redo' });
        return;
      }
      if (mod && e.key.toLowerCase() === 's') {
        e.preventDefault();
        save();
        return;
      }
      if (typing || mod) return;
      if (e.key === 'Escape') {
        setSelection(null);
        setSelectedSlice(null);
      } else if (e.key === '?') setAbout(true);
      else if (e.key === 'm' || e.key === 'M') setShowMap((v) => !v);
      else if (e.key === 'l' || e.key === 'L') setShowSlices((v) => !v);
      else if (e.key === 't' || e.key === 'T') toggleTrial();
      else if (selection && (e.key === 'Delete' || e.key === 'Backspace')) {
        e.preventDefault();
        const next = deletePoint(model, selection.line, selection.index);
        if (next) {
          commitModel(next);
          setSelection(null);
        } else notify('That point cannot be removed: the line would be too short.');
      } else if (selection && e.key.startsWith('Arrow')) {
        const p = linePoints(model, selection.line)[selection.index];
        if (!p) return;
        e.preventDefault();
        const d = (settings.snap > 0 ? settings.snap : 0.1) * (e.shiftKey ? 5 : 1);
        const to = {
          x: p.x + (e.key === 'ArrowRight' ? d : e.key === 'ArrowLeft' ? -d : 0),
          y: p.y + (e.key === 'ArrowUp' ? d : e.key === 'ArrowDown' ? -d : 0),
        };
        commitModel(movePoint(model, selection.line, selection.index, to));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="app" data-busy={analysis.busy ? 'true' : 'false'}>
      <header className="masthead">
        <div className="brand">
          <Logo />
          <div>
            <h1>SlopeForge</h1>
            <span>Slope stability · method of slices</span>
          </div>
        </div>
        <label className="job">
          <span>Section</span>
          <TextField
            label="Section title"
            value={project.title}
            onChange={(title) => commit({ ...project, title })}
          />
        </label>
        <div className="actions" data-tour="actions">
          <select
            aria-label="Load an example"
            value={exampleId}
            onChange={(e) => {
              const example = findExample(e.target.value);
              if (!example) return;
              setExampleId(example.id);
              load(example.project);
              window.history.replaceState(
                null,
                '',
                window.location.pathname + window.location.search,
              );
            }}
          >
            <option value="" disabled>
              Examples…
            </option>
            {EXAMPLES.map((e) => (
              <option key={e.id} value={e.id} title={e.about}>
                {e.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => dispatch({ type: 'undo' })}
            disabled={history.past.length === 0 && !history.anchor}
            title="Undo (Ctrl+Z)"
          >
            Undo
          </button>
          <button
            type="button"
            onClick={() => dispatch({ type: 'redo' })}
            disabled={history.future.length === 0}
            title="Redo (Ctrl+Shift+Z)"
          >
            Redo
          </button>
          <button type="button" onClick={() => fileInput.current?.click()}>
            Open
          </button>
          <button type="button" onClick={save} title="Save as JSON (Ctrl+S)">
            Save
          </button>
          <button type="button" onClick={() => void share()}>
            Share link
          </button>
          <button type="button" className="solid" onClick={() => void pdf()}>
            PDF report
          </button>
          <button
            type="button"
            onClick={() => setAbout(true)}
            aria-label="About SlopeForge"
            title="About and keys (?)"
          >
            ?
          </button>
          <input
            ref={fileInput}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={(e) => {
              void open(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </div>
      </header>

      <div className="desk">
        <LogPanel
          model={model}
          settings={settings}
          selection={selection}
          onSelect={setSelection}
          onModel={commitModel}
          onSettings={commitSettings}
        />

        <main className="sheet">
          <div className="sheet-bar" data-tour="tools">
            <span className="fig">Fig. 1</span>
            <span className="fig-title">
              Cross-section with {trial ? 'trial and critical' : 'critical'} slip circle
            </span>
            <span className="spacer" />
            <label className="tick">
              <input
                type="checkbox"
                checked={showMap}
                onChange={(e) => setShowMap(e.target.checked)}
              />
              Centre grid and F contours
            </label>
            <label className="tick">
              <input
                type="checkbox"
                checked={showSlices}
                onChange={(e) => setShowSlices(e.target.checked)}
              />
              Slices
            </label>
          </div>
          <div className="drawing" data-tour="drawing">
            <Section
              title={project.title}
              model={model}
              prepared={prepared}
              settings={settings}
              search={prepared ? search : null}
              critical={critical}
              trial={trial?.ok ? trial : null}
              showMap={showMap}
              showSlices={showSlices}
              selectedSlice={selectedSlice}
              onSelectSlice={setSelectedSlice}
              selection={selection}
              onSelect={setSelection}
              onPreviewModel={(m) =>
                dispatch({ type: 'preview', project: { ...project, model: m } })
              }
              onPreviewSettings={(patch) =>
                dispatch({
                  type: 'preview',
                  project: { ...project, settings: { ...settings, ...patch } },
                })
              }
              onSettle={() => dispatch({ type: 'settle' })}
              onCommitModel={commitModel}
              svgRef={svgRef}
            />
          </div>
          <p className="caption">
            Drag the square points to reshape the ground, the diamonds for layer boundaries and the
            water table. Double-click a line to add a point, double-click a point to remove it.
            Crosses are trial centres; contour lines join centres with the same minimum factor of
            safety.
          </p>

          <div className="details" data-tour="details">
            <div className="tabs" role="tablist">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.id}
                  className={tab === t.id ? 'on' : ''}
                  onClick={() => setTab(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div className="tab-body">
              {tab === 'sensitivity' && critical ? (
                <Sensitivity
                  curves={response?.sensitivity ?? null}
                  busy={analysis.busy}
                  method={settings.method === 'bishop' ? 'Bishop' : 'ordinary method'}
                />
              ) : !shown ? (
                <p className="hint">Nothing to show until a slip circle has been analysed.</p>
              ) : tab === 'slices' ? (
                <SliceTable
                  model={model}
                  result={shown}
                  picked={selectedSlice}
                  onPick={setSelectedSlice}
                />
              ) : tab === 'working' ? (
                <Working model={model} result={shown} />
              ) : tab === 'forces' ? (
                <SliceForces
                  model={model}
                  result={shown}
                  picked={selectedSlice}
                  onPick={setSelectedSlice}
                />
              ) : (
                <Compare
                  result={shown}
                  settings={settings}
                  search={search}
                  other={response?.other ?? null}
                  busy={analysis.busy}
                />
              )}
            </div>
          </div>
        </main>

        <Results
          settings={settings}
          search={search}
          critical={critical}
          trial={trial}
          problems={prepared ? [] : (response?.problems ?? [])}
          busy={analysis.busy}
          elapsed={response?.elapsed ?? null}
          onToggleTrial={toggleTrial}
        />
      </div>
      <footer className="colophon">
        SlopeForge is a learning tool. Circular slip surfaces by the ordinary (Fellenius) and Bishop
        simplified methods; not a substitute for a site-specific geotechnical assessment. ·{' '}
        <a href="https://github.com/WruceBayne29/slopeforge" target="_blank" rel="noreferrer">
          Source and validation
        </a>
      </footer>
      {about && (
        <About
          onClose={() => setAbout(false)}
          onTour={() => {
            setAbout(false);
            setTour(true);
          }}
        />
      )}
      {tour && <Tour onClose={endTour} />}
      <Toasts />
    </div>
  );
}
