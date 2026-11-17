/**
 * PDF report: the section drawing, the strata, the critical circle, both factors of safety and
 * the slice table with the working — laid out for A4 like a page from a site-investigation
 * report.
 */
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { fix, workedSteps } from '../engine';
import type { CircleSuccess, SearchResult, WorkedSection, WorkedTable } from '../engine';
import type { Project } from '../model/project';

export interface Figure {
  /** PNG data URL. */
  dataUrl: string;
  width: number;
  height: number;
}

export interface ReportInput {
  project: Project;
  /** The circle reported (the critical circle, or the hand-placed one). */
  result: CircleSuccess;
  /** 'critical' or 'trial', for the headings. */
  kind: 'critical' | 'trial';
  search?: SearchResult | null;
  figure?: Figure | null;
  date?: Date;
}

type Rgb = [number, number, number];
const INK: Rgb = [22, 24, 26];
const SOFT: Rgb = [75, 79, 83];
const MUTED: Rgb = [109, 113, 117];
const RULE: Rgb = [201, 204, 207];
const SLIP: Rgb = [194, 49, 29];

const PAGE_W = 210;
const PAGE_H = 297;
const M = 14;

/**
 * The built-in PDF fonts cover Latin-1 only, so Greek letters and mathematical signs used on
 * screen are written out: "gamma", "phi'", "Sum".
 */
export function pdfText(text: string): string {
  const map: Record<string, string> = {
    γ: 'gamma',
    φ: 'phi',
    ϕ: 'phi',
    α: 'alpha',
    β: 'beta',
    σ: 'sigma',
    τ: 'tau',
    θ: 'theta',
    Σ: 'Sum ',
    '′': "'",
    '’': "'",
    '‘': "'",
    '“': '"',
    '”': '"',
    '−': '-',
    '–': '-',
    '—': '-',
    '≤': '<=',
    '≥': '>=',
    '≡': '=',
    '√': 'sqrt',
    '…': '...',
    '→': '->',
    '←': '<-',
    ȳ: 'y_c',
    '∫': 'int',
  };
  return text.replace(/[^\n\x20-\x7e\xa0-\xff]/g, (ch) => map[ch] ?? '?').replace(/ {2,}/g, ' ');
}

export function reportFileName(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  return `${slug || 'slope'}-stability.pdf`;
}

/** Builds the report and returns the jsPDF document. */
export function buildReport({
  project,
  result,
  kind,
  search,
  figure,
  date = new Date(),
}: ReportInput): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  const { model, settings } = project;
  const width = PAGE_W - 2 * M;
  const worked = workedSteps(model, result);
  const governing = settings.method === 'bishop' ? result.bishop.fos : result.fellenius.fos;
  let y = M;

  const paint = (): void => {
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, PAGE_W, PAGE_H, 'F');
  };
  paint();

  const need = (height: number): void => {
    if (y + height > PAGE_H - M - 8) {
      doc.addPage();
      paint();
      y = M;
    }
  };
  const heading = (text: string): void => {
    need(12);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(...INK);
    doc.text(pdfText(text).toUpperCase(), M, y + 3.4, { charSpace: 0.45 });
    doc.setDrawColor(...INK);
    doc.setLineWidth(0.3);
    doc.line(M, y + 5, M + width, y + 5);
    y += 8.5;
  };
  const para = (
    text: string,
    options: { mono?: boolean; indent?: number; colour?: Rgb } = {},
  ): void => {
    doc.setFont(options.mono ? 'courier' : 'helvetica', 'normal');
    doc.setFontSize(options.mono ? 8.4 : 8.8);
    doc.setTextColor(...(options.colour ?? SOFT));
    const indent = options.indent ?? 0;
    const lines = doc.splitTextToSize(pdfText(text), width - indent) as string[];
    for (const line of lines) {
      need(4.4);
      doc.text(line, M + indent, y + 3);
      y += 4.1;
    }
  };
  const table = (t: WorkedTable, fontSize = 7, textColumns = 1): void => {
    need(16);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.6);
    doc.setTextColor(...MUTED);
    doc.text(pdfText(t.caption).toUpperCase(), M, y + 3, { charSpace: 0.3 });
    y += 4.5;
    autoTable(doc, {
      startY: y,
      margin: { left: M, right: M, top: M, bottom: M + 6 },
      head: [t.head.map((h, i) => pdfText(t.units[i] ? `${h}\n${t.units[i]}` : h))],
      body: t.rows.map((r) => r.map(pdfText)),
      foot: t.foot ? [t.foot.map(pdfText)] : undefined,
      theme: 'plain',
      styles: {
        font: 'courier',
        fontSize,
        cellPadding: { top: 0.55, bottom: 0.55, left: 1.2, right: 1.2 },
        halign: 'right',
        textColor: INK,
        lineColor: RULE,
        lineWidth: { bottom: 0.1 },
      },
      headStyles: {
        font: 'helvetica',
        fontStyle: 'bold',
        lineColor: INK,
        lineWidth: { top: 0.35, bottom: 0.25 },
      },
      footStyles: { fontStyle: 'bold', lineColor: INK, lineWidth: { top: 0.25, bottom: 0.35 } },
      columnStyles: Object.fromEntries(
        Array.from({ length: textColumns }, (_, i) => [
          i,
          {
            halign: 'left' as const,
            textColor: i === 0 ? MUTED : INK,
            font: i === 0 ? 'courier' : 'helvetica',
          },
        ]),
      ),
      didParseCell: (data) => {
        if (data.section === 'head' && data.column.index < textColumns)
          data.cell.styles.halign = 'left';
      },
      willDrawPage: (data) => {
        if (data.pageNumber > 1) paint();
      },
    });
    y = ((doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY ?? y) + 5;
  };
  const step = (n: number, s: WorkedSection): void => {
    need(14);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.2);
    doc.setTextColor(...INK);
    doc.setDrawColor(...INK);
    doc.setLineWidth(0.25);
    doc.rect(M, y, 4.6, 4.6);
    doc.text(String(n), M + 2.3, y + 3.4, { align: 'center' });
    doc.text(pdfText(s.title), M + 7, y + 3.5);
    if (s.result) {
      doc.setFont('courier', 'bold');
      doc.text(pdfText(s.result), M + width, y + 3.5, { align: 'right' });
    }
    y += 6;
    for (const line of s.lines) {
      const equation = /^F = |^N′ = |^T = /.test(line);
      para(line, { mono: equation, indent: equation ? 11 : 7, colour: equation ? INK : SOFT });
    }
    y += 2.5;
  };

  // ---- title block ----
  const cols = [0, 0.3, 0.72, 0.87, 1].map((f) => M + f * width);
  const rowH = 10.5;
  doc.setDrawColor(...INK);
  doc.setLineWidth(0.4);
  doc.rect(M, y, width, 2 * rowH);
  doc.setLineWidth(0.2);
  doc.line(M, y + rowH, M + width, y + rowH);
  for (const x of cols.slice(1, 4)) doc.line(x, y, x, y + 2 * rowH);
  const cell = (
    col: number,
    row: number,
    label: string,
    value: string,
    strong = false,
    colour: Rgb = INK,
  ): void => {
    const x = cols[col] + 2;
    const top = y + row * rowH;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.6);
    doc.setTextColor(...MUTED);
    doc.text(label.toUpperCase(), x, top + 3.3, { charSpace: 0.3 });
    doc.setTextColor(...colour);
    doc.setFont(strong ? 'helvetica' : 'courier', strong ? 'bold' : 'normal');
    doc.setFontSize(strong ? 10.5 : 8.6);
    const lines = doc.splitTextToSize(pdfText(value), cols[col + 1] - cols[col] - 4) as string[];
    doc.text(lines[0] ?? '', x, top + 8);
  };
  const state =
    governing === null
      ? 'no result'
      : governing < 1
        ? 'unstable'
        : governing < 1.25
          ? 'marginal'
          : governing < 1.5
            ? 'moderate'
            : 'adequate';
  cell(0, 0, 'Slope stability report', 'SlopeForge', true);
  cell(1, 0, 'Section', project.title, true);
  cell(2, 0, 'Date', date.toISOString().slice(0, 10));
  cell(3, 0, 'Sheet', "A-A'");
  cell(0, 1, 'Method', 'Slices, circular slip');
  cell(
    1,
    1,
    'Reported circle',
    kind === 'critical'
      ? `Critical (min. ${settings.method === 'bishop' ? 'Bishop' : 'ordinary'})`
      : 'Trial circle placed by hand',
  );
  cell(
    2,
    1,
    'F governing',
    governing === null ? '-' : fix(governing, 3),
    true,
    governing !== null && governing < 1 ? SLIP : INK,
  );
  cell(3, 1, 'Assessment', state, false, governing !== null && governing < 1 ? SLIP : INK);
  y += 2 * rowH + 5;

  // ---- figure ----
  if (figure && figure.width > 0 && figure.height > 0) {
    const w = width;
    const h = Math.min((w * figure.height) / figure.width, 125);
    const fw = (h * figure.width) / figure.height;
    doc.addImage(figure.dataUrl, 'PNG', M + (w - fw) / 2, y, fw, h);
    y += h + 2;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.6);
    doc.setTextColor(...MUTED);
    doc.text(
      `FIG. 1  CROSS-SECTION WITH THE ${kind === 'critical' ? 'CRITICAL' : 'TRIAL'} SLIP CIRCLE. CHAINAGE AND REDUCED LEVEL IN METRES.`,
      M,
      y + 3,
      { charSpace: 0.25 },
    );
    y += 8;
  }

  // ---- results ----
  heading('Result');
  const facts: [string, string][] = [
    [
      'Factor of safety, Bishop simplified',
      result.bishop.fos === null ? 'no result' : fix(result.bishop.fos, 3),
    ],
    ['Factor of safety, ordinary (Fellenius)', fix(result.fellenius.fos ?? NaN, 3)],
    ['Circle centre', `CH ${fix(result.circle.xc, 2)} m, RL ${fix(result.circle.yc, 2)} m`],
    ['Radius', `${fix(result.circle.r, 2)} m`],
    [
      'Slip surface ends',
      `CH ${fix(result.toe.x, 2)} m (toe) to CH ${fix(result.crest.x, 2)} m (crest)`,
    ],
    ['Sliding mass', `${fix(result.area, 1)} m², ${fix(result.weight, 0)} kN per metre run`],
    ['Driving moment', `${fix(result.drivingMoment, 0)} kN·m/m`],
    [
      'Resisting moment (Bishop / ordinary)',
      `${result.bishop.fos === null ? '-' : fix(result.bishop.resistingMoment, 0)} / ${fix(result.fellenius.resistingMoment, 0)} kN·m/m`,
    ],
  ];
  if (search && kind === 'critical') {
    facts.push([
      'Search',
      `${search.xs.length} x ${search.ys.length} trial centres, ${search.evaluated} circles analysed, then refined`,
    ]);
  }
  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M },
    body: facts.map(([k, v]) => [pdfText(k), pdfText(v)]),
    theme: 'plain',
    styles: {
      font: 'helvetica',
      fontSize: 8.6,
      cellPadding: { top: 0.7, bottom: 0.7, left: 0, right: 1 },
      textColor: SOFT,
      lineColor: RULE,
      lineWidth: { bottom: 0.1 },
    },
    columnStyles: { 1: { font: 'courier', halign: 'right', textColor: INK } },
  });
  y = ((doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY ?? y) + 6;

  // ---- inputs ----
  heading('Strata and loading');
  table(
    {
      caption: 'Strata, from the top down',
      head: ['Stratum', 'Description', 'γ', 'γsat', 'c′', 'φ′'],
      units: ['', '', 'kN/m³', 'kN/m³', 'kPa', 'deg'],
      rows: model.soils.map((s, i) => [
        String(i + 1),
        s.name,
        fix(s.gamma, 1),
        s.gammaSat ? fix(s.gammaSat, 1) : '-',
        fix(s.c, 1),
        fix(s.phi, 1),
      ]),
    },
    8,
    2,
  );
  const water =
    model.water.kind === 'none'
      ? 'No pore pressure (dry).'
      : model.water.kind === 'ru'
        ? `Pore pressure ratio ru = ${fix(model.water.ru, 2)}.`
        : `Phreatic line through ${model.water.points.map((p) => `(${fix(p.x, 1)}, ${fix(p.y, 1)})`).join(', ')}; pore pressure = ${fix(model.gammaW, 2)} kN/m³ x depth below the line.`;
  para(
    `Ground surface (chainage, RL): ${model.ground.map((p) => `(${fix(p.x, 1)}, ${fix(p.y, 1)})`).join(', ')}. Firm base at RL ${fix(model.base, 1)} m.`,
  );
  para(water);
  if (model.surcharges.length > 0) {
    para(
      `Surcharge: ${model.surcharges.map((s) => `${fix(s.q, 0)} kPa from CH ${fix(s.x1, 1)} to ${fix(s.x2, 1)}`).join('; ')}.`,
    );
  }
  if (model.kh > 0) para(`Horizontal seismic coefficient kh = ${fix(model.kh, 2)}.`);
  if (model.crack)
    para(
      `Tension crack ${fix(model.crack.depth, 2)} m deep, ${fix(model.crack.water * 100, 0)} % full of water.`,
    );
  y += 4;

  // ---- working ----
  heading('Calculation');
  step(1, worked.circle);
  step(2, worked.slices);
  table(worked.sliceTable);
  step(3, worked.fellenius);
  step(4, worked.bishop);
  table(worked.iterationTable, 7.6);
  if (worked.bishopTable) table(worked.bishopTable);
  step(5, worked.moments);
  if (worked.notes.length > 0) {
    heading('Notes');
    for (const note of worked.notes) para(`- ${note}`);
  }

  // ---- footers ----
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setDrawColor(...INK);
    doc.setLineWidth(0.2);
    doc.line(M, PAGE_H - M - 2, M + width, PAGE_H - M - 2);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(...MUTED);
    doc.text(
      'SlopeForge - a learning tool; not a substitute for a site-specific geotechnical assessment.',
      M,
      PAGE_H - M + 1.5,
    );
    doc.text(`Page ${p} of ${pages}`, M + width, PAGE_H - M + 1.5, { align: 'right' });
  }
  return doc;
}
