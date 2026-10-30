import { CSV_COLUMNS, CSV_MAX_ROWS, csvTemplate, parsePlantCsv } from './csv';

describe('csv template', () => {
  it('has a BOM, all columns and no data rows', () => {
    const t = csvTemplate();
    expect(t.charCodeAt(0)).toBe(0xfeff);
    expect(t.slice(1)).toBe(`${CSV_COLUMNS.join(',')}\r\n`);
  });

  it('parses back to zero rows without errors', () => {
    const r = parsePlantCsv(csvTemplate());
    expect(r.rows).toEqual([]);
    expect(r.errors).toEqual([]);
  });
});

describe('parsePlantCsv', () => {
  it('imports a name-only file', () => {
    const r = parsePlantCsv('name\nپتوس\nفیکوس\n');
    expect(r.errors).toEqual([]);
    expect(r.rows.map((x) => x.input.name)).toEqual(['پتوس', 'فیکوس']);
  });

  it('numbers rows from the sheet, header being row 1', () => {
    const r = parsePlantCsv('name\nA\n\nB\n');
    expect(r.rows.map((x) => x.row)).toEqual([2, 4]);
  });

  it('reads quoted cells with commas, quotes and newlines', () => {
    const r = parsePlantCsv('name,notes\r\n"A, b","say ""hi""\nline2"\r\n');
    expect(r.errors).toEqual([]);
    expect(r.rows[0]?.input.name).toBe('A, b');
    expect(r.rows[0]?.input.notes).toBe('say "hi"\nline2');
  });

  it('accepts semicolon delimiters and a BOM', () => {
    const r = parsePlantCsv('﻿name;room\nA;اتاق\n');
    expect(r.errors).toEqual([]);
    expect(r.rows[0]?.input).toMatchObject({ name: 'A', room: 'اتاق' });
  });

  it('reads Persian digits in the pot size', () => {
    const r = parsePlantCsv('name,pot_size_cm\nA,۱۴\n');
    expect(r.errors).toEqual([]);
    expect(r.rows[0]?.input.potSizeCm).toBe(14);
  });

  it('reports a missing name per row and still returns the good rows', () => {
    const r = parsePlantCsv('name,room\nA,x\n,y\nC,z\n');
    expect(r.rows.map((x) => x.input.name)).toEqual(['A', 'C']);
    expect(r.errors).toEqual([{ row: 3, code: 'name_required', column: 'name' }]);
  });

  it('reports a bad number with its column', () => {
    const r = parsePlantCsv('name,pot_size_cm\nA,abc\n');
    expect(r.rows).toEqual([]);
    expect(r.errors[0]).toMatchObject({ row: 2, code: 'invalid_number', column: 'pot_size_cm' });
  });

  it('reports an unknown light value', () => {
    const r = parsePlantCsv('name,light\nA,disco\n');
    expect(r.errors[0]).toMatchObject({ row: 2, code: 'invalid_value', column: 'light' });
  });

  it('lists ignored columns instead of failing', () => {
    const r = parsePlantCsv('name,color\nA,red\n');
    expect(r.ignoredColumns).toEqual(['color']);
    expect(r.rows).toHaveLength(1);
  });

  it('fails the whole file when there is no name column', () => {
    expect(parsePlantCsv('room\nx\n').errors).toEqual([{ row: 1, code: 'no_name_column', column: 'name' }]);
  });

  it('fails an empty file', () => {
    expect(parsePlantCsv('').errors).toEqual([{ row: 0, code: 'empty' }]);
  });

  it('flags an unterminated quote', () => {
    const r = parsePlantCsv('name\n"oops\n');
    expect(r.errors.map((e) => e.code)).toContain('unterminated_quote');
    expect(r.rows).toEqual([]);
  });

  it('refuses files with too many rows', () => {
    const body = Array.from({ length: CSV_MAX_ROWS + 1 }, (_, i) => `P${i}`).join('\n');
    const r = parsePlantCsv(`name\n${body}\n`);
    expect(r.errors).toEqual([{ row: 0, code: 'too_many_rows' }]);
    expect(r.rows).toEqual([]);
  });
});
