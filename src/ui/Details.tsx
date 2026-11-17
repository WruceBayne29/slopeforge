import { fix, workedSteps } from '../engine';
import type { CircleSuccess, SlopeModel, WorkedSection, WorkedTable } from '../engine';

export type DetailTab = 'slices' | 'working' | 'forces' | 'compare' | 'sensitivity';

export function Table({
  table,
  picked,
  onPick,
}: {
  table: WorkedTable;
  picked?: number | null;
  onPick?: (row: number) => void;
}) {
  return (
    <div className="table-wrap">
      <table className="calc">
        <caption>{table.caption}</caption>
        <thead>
          <tr>
            {table.head.map((h, i) => (
              <th key={i}>
                {h}
                {table.units[i] && <small>{table.units[i]}</small>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, r) => (
            <tr
              key={r}
              className={picked === r ? 'picked' : ''}
              onClick={onPick ? () => onPick(r) : undefined}
            >
              {row.map((cell, i) => (
                <td key={i}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
        {table.foot && (
          <tfoot>
            <tr>
              {table.foot.map((cell, i) => (
                <td key={i}>{cell}</td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

export function Step({ n, section }: { n: number; section: WorkedSection }) {
  return (
    <div className="step">
      <div className="step-no">{n}</div>
      <div className="step-body">
        <h3>{section.title}</h3>
        {section.lines.map((line, i) => (
          <p key={i} className={/^F = |^N′ = |^T = /.test(line) ? 'eq' : ''}>
            {line}
          </p>
        ))}
      </div>
      <div className="step-out">{section.result ?? ''}</div>
    </div>
  );
}

/** The calculation written out as a hand calculation. */
export function Working({ model, result }: { model: SlopeModel; result: CircleSuccess }) {
  const w = workedSteps(model, result);
  return (
    <div className="working">
      <Step n={1} section={w.circle} />
      <Step n={2} section={w.slices} />
      <Table table={w.sliceTable} />
      <Step n={3} section={w.fellenius} />
      <Step n={4} section={w.bishop} />
      <Table table={w.iterationTable} />
      {w.bishopTable && <Table table={w.bishopTable} />}
      <Step n={5} section={w.moments} />
      {w.notes.length > 0 && (
        <div className="notes">
          <h3>Notes</h3>
          <ul>
            {w.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function SliceTable({
  model,
  result,
  picked,
  onPick,
}: {
  model: SlopeModel;
  result: CircleSuccess;
  picked: number | null;
  onPick: (index: number | null) => void;
}) {
  const w = workedSteps(model, result);
  return (
    <div>
      <Table table={w.sliceTable} picked={picked} onPick={(r) => onPick(picked === r ? null : r)} />
      <p className="hint">
        Click a row (or a slice on the drawing) to pick it out. F (ordinary) ={' '}
        {fix(result.fellenius.fos ?? NaN, 3)}, F (Bishop) = {fix(result.bishop.fos ?? NaN, 3)}.
      </p>
    </div>
  );
}
