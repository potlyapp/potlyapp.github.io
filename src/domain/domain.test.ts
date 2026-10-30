import { buildPlant, unknownCare } from './defaults';
import { ID_PATTERN, isValidId, newId } from './id';
import { plantInputSchema, plantSchema } from './schemas';

describe('newId', () => {
  it('is 22 chars of base64url', () => {
    for (let i = 0; i < 50; i++) expect(newId()).toMatch(ID_PATTERN);
  });

  it('is unique across many calls', () => {
    const ids = new Set(Array.from({ length: 5000 }, newId));
    expect(ids.size).toBe(5000);
  });

  it('is not sequential or time-derived', () => {
    const [a, b] = [newId(), newId()];
    expect(a.slice(0, 6)).not.toBe(b.slice(0, 6));
  });

  it('validates shape', () => {
    expect(isValidId(newId())).toBe(true);
    expect(isValidId('abc')).toBe(false);
    expect(isValidId('../etc/passwd/xxxxxxxxxx')).toBe(false);
  });
});

describe('plant input schema', () => {
  it('accepts a name only', () => {
    expect(plantInputSchema.safeParse({ name: 'Monstera' }).success).toBe(true);
  });

  it('rejects empty and whitespace names', () => {
    expect(plantInputSchema.safeParse({ name: '' }).success).toBe(false);
    expect(plantInputSchema.safeParse({ name: '   ' }).success).toBe(false);
  });

  it('rejects out-of-range pot size', () => {
    expect(plantInputSchema.safeParse({ name: 'x', potSizeCm: -1 }).success).toBe(false);
    expect(plantInputSchema.safeParse({ name: 'x', potSizeCm: 500 }).success).toBe(false);
  });
});

describe('buildPlant', () => {
  const plant = buildPlant(newId(), { name: '  Pothos  ' }, 1_000);

  it('defaults every unknown field to unknown/null', () => {
    expect(plant.name).toBe('Pothos');
    expect(plant.species).toBeNull();
    expect(plant.room).toBeNull();
    expect(plant.light).toBe('unknown');
    expect(plant.potMaterial).toBe('unknown');
    expect(plant.potSizeCm).toBeNull();
    expect(plant.soil).toBe('unknown');
    expect(plant.lastWateredAt).toBeNull();
    expect(plant.archivedAt).toBeNull();
  });

  it('never invents care intervals', () => {
    for (const season of Object.values(plant.care)) {
      expect(season.water.mode).toBe('unknown');
      expect(season.fertilize.mode).toBe('unknown');
      expect(season.water.source).toBe('default');
    }
  });

  it('produces a schema-valid plant', () => {
    expect(plantSchema.safeParse(plant).success).toBe(true);
  });

  it('turns blank optional text into null', () => {
    const p = buildPlant(newId(), { name: 'a', species: '  ', room: '' }, 1);
    expect(p.species).toBeNull();
    expect(p.room).toBeNull();
  });

  it('returns independent care objects', () => {
    expect(unknownCare()).not.toBe(unknownCare());
  });
});
