import { describe, expect, it } from 'vitest';
import { defaultProject, EXAMPLES } from '../model/examples';
import {
  parseProject,
  parseProjectText,
  ProjectFormatError,
  serializeProject,
} from './projectFile';
import { decodeProject, encodeProject, payloadFromHash, shareUrl } from './share';

describe('project files', () => {
  it('round-trips every example', () => {
    for (const e of EXAMPLES) {
      expect(parseProjectText(serializeProject(e.project))).toEqual(e.project);
    }
  });

  it('round-trips the optional parts', () => {
    const p = defaultProject();
    p.model.crack = { depth: 2, water: 0.5 };
    p.model.surcharges = [{ x1: 40, x2: 45, q: 15 }];
    p.model.water = { kind: 'ru', ru: 0.3 };
    p.settings.box = { x1: 5, x2: 30, y1: 35, y2: 60 };
    p.settings.trial = { xc: 20, yc: 40, r: 21 };
    p.settings.method = 'fellenius';
    expect(parseProjectText(serializeProject(p))).toEqual(p);
  });

  it('fills in what a hand-written file leaves out', () => {
    const p = parseProject({
      model: {
        ground: [
          { x: 0, y: 0 },
          { x: 10, y: 5 },
        ],
        soils: [{ pattern: 'clay', gamma: 18, c: 10, phi: 20, gammaSat: null }],
        base: -5,
      },
    });
    expect(p.title).toBe('Untitled slope');
    expect(p.model.soils[0].id).toBe('soil-1');
    expect(p.model.soils[0].gammaSat).toBeUndefined();
    expect(p.model.water).toEqual({ kind: 'none' });
    expect(p.model.gammaW).toBe(9.81);
    expect(p.settings.slices).toBe(30);
    expect(p.model.crack).toBeNull();
  });

  it('renumbers duplicate soil ids and clamps settings', () => {
    const p = defaultProject();
    p.model.soils.forEach((s) => (s.id = 'same'));
    p.settings.slices = 5000;
    const q = parseProjectText(serializeProject(p));
    expect(q.model.soils.map((s) => s.id)).toEqual(['soil-1', 'soil-2', 'soil-3']);
    expect(q.settings.slices).toBe(200);
  });

  const bad: [string, (p: Record<string, unknown>) => void, string][] = [
    ['a foreign format', (p) => (p.format = 'other'), 'not a SlopeForge project'],
    ['a newer version', (p) => (p.version = 2), 'newer version'],
    ['a long title', (p) => (p.title = 'x'.repeat(500)), 'short piece of text'],
    ['no model', (p) => delete p.model, 'no slope model'],
    [
      'a text coordinate',
      (p) => ((p.model as { ground: unknown[] }).ground[0] = { x: 'a', y: 0 }),
      'ground[0].x',
    ],
    [
      'a point that is not an object',
      (p) => ((p.model as { ground: unknown[] }).ground[0] = 3),
      'must be a point',
    ],
    [
      'one ground point',
      (p) => ((p.model as { ground: unknown[] }).ground = [{ x: 0, y: 0 }]),
      'list of 2',
    ],
    ['no soils', (p) => ((p.model as { soils: unknown[] }).soils = []), 'must list 1 to'],
    [
      'a soil that is not an object',
      (p) => ((p.model as { soils: unknown[] }).soils[0] = 'clay'),
      'must be an object',
    ],
    [
      'an unknown hatch',
      (p) => ((p.model as { soils: { pattern: string }[] }).soils[0].pattern = 'lava'),
      'pattern',
    ],
    [
      'an infinite unit weight',
      (p) => ((p.model as { soils: { gamma: number }[] }).soils[0].gamma = 1e99),
      'gamma',
    ],
    [
      'a missing boundary',
      (p) => (p.model as { boundaries: unknown[] }).boundaries.pop(),
      'one layer boundary',
    ],
    [
      'an odd water kind',
      (p) => ((p.model as { water: unknown }).water = { kind: 'steam' }),
      'water.kind',
    ],
    [
      'too many surcharges',
      (p) =>
        ((p.model as { surcharges: unknown }).surcharges = new Array(30).fill({
          x1: 0,
          x2: 1,
          q: 1,
        })),
      'short list',
    ],
    [
      'a broken surcharge',
      (p) => ((p.model as { surcharges: unknown }).surcharges = [7]),
      'surcharges[0]',
    ],
    [
      'an unknown method',
      (p) => ((p.settings as { method: string }).method = 'spencer'),
      'settings.method',
    ],
    [
      'a text setting',
      (p) => ((p.settings as { slices: unknown }).slices = 'many'),
      'settings.slices',
    ],
  ];
  for (const [name, change, expected] of bad) {
    it(`rejects ${name}`, () => {
      const raw = JSON.parse(serializeProject(defaultProject())) as Record<string, unknown>;
      change(raw);
      expect(() => parseProject(raw)).toThrow(ProjectFormatError);
      expect(() => parseProject(raw)).toThrow(expected);
    });
  }

  it('rejects things that are not projects at all', () => {
    expect(() => parseProject(null)).toThrow(ProjectFormatError);
    expect(() => parseProject([1, 2])).toThrow('not a SlopeForge project');
    expect(() => parseProjectText('{nope')).toThrow('not valid JSON');
  });
});

describe('share links', () => {
  it('round-trips a project through the URL fragment', async () => {
    const p = defaultProject();
    p.title = 'Shared slope — φ′ test';
    const url = await shareUrl(p, 'https://example.org/slopeforge/?x=1#old');
    expect(url.startsWith('https://example.org/slopeforge/?x=1#m=')).toBe(true);
    const payload = payloadFromHash(new URL(url).hash);
    expect(payload).not.toBeNull();
    expect(await decodeProject(payload as string)).toEqual(p);
    expect(url.length).toBeLessThan(2500);
  });

  it('reads uncompressed payloads and rejects damaged ones', async () => {
    const p = defaultProject();
    const plain = `0.${btoa(JSON.stringify(p)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`;
    expect(await decodeProject(plain)).toEqual(p);
    await expect(decodeProject('9.abc')).rejects.toThrow('does not contain');
    await expect(decodeProject('nodot')).rejects.toThrow(ProjectFormatError);
    await expect(decodeProject('1.@@@@')).rejects.toThrow('damaged');
    const encoded = await encodeProject(p);
    await expect(decodeProject(encoded.slice(0, 40))).rejects.toThrow(ProjectFormatError);
    expect(payloadFromHash('#about')).toBeNull();
    expect(payloadFromHash('m=1.abc')).toBe('1.abc');
  });
});
