import { LIGHT_VALUES, POT_MATERIAL_VALUES, SOIL_VALUES, plantInputSchema, type PlantInput } from './schemas';

/** Template columns, in order. Only `name` is required; blank cells become `unknown`/empty. */
export const CSV_COLUMNS = ['name', 'species', 'room', 'light', 'pot_material', 'pot_size_cm', 'soil', 'notes'] as const;
export type CsvColumn = (typeof CSV_COLUMNS)[number];

export const CSV_MAX_ROWS = 500;

export type CsvErrorCode =
  | 'empty'
  | 'no_name_column'
  | 'too_many_rows'
  | 'name_required'
  | 'too_long'
  | 'invalid_value'
  | 'invalid_number'
  | 'unterminated_quote'
  | 'wrong_cell_count';

export interface CsvError {
  /** Spreadsheet row number: the header is row 1, the first plant row 2. `0` = whole file. */
  row: number;
  code: CsvErrorCode;
  column?: CsvColumn;
}

export interface CsvRow {
  row: number;
  input: PlantInput;
}

export interface CsvParseResult {
  rows: CsvRow[];
  errors: CsvError[];
  /** Header cells that are not template columns; their data is ignored. */
  ignoredColumns: string[];
}

export function csvTemplate(): string {
  return `\uFEFF${CSV_COLUMNS.join(',')}\r\n`;
}

const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

function toLatinDigits(s: string): string {
  return s
    .replace(/[۰-۹]/g, (c) => String(PERSIAN_DIGITS.indexOf(c)))
    .replace(/[٠-٩]/g, (c) => String(ARABIC_DIGITS.indexOf(c)))
    .replace(/[٫,]/g, '.');
}

/** RFC-4180-style records. Handles quotes, escaped quotes, embedded newlines, CRLF and a BOM. */
function splitRecords(text: string, delimiter: string): { records: string[][]; unterminated: boolean } {
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const records: string[][] = [];
  let record: string[] = [];
  let cell = '';
  let quoted = false;

  const endCell = () => {
    record.push(cell);
    cell = '';
  };
  const endRecord = () => {
    endCell();
    records.push(record);
    record = [];
  };

  for (let i = 0; i < src.length; i++) {
    const ch = src.charAt(i);
    if (quoted) {
      if (ch === '"') {
        if (src.charAt(i + 1) === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
      continue;
    }
    if (ch === '"' && cell === '') {
      quoted = true;
    } else if (ch === delimiter) {
      endCell();
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src.charAt(i + 1) === '\n') i++;
      endRecord();
    } else cell += ch;
  }
  if (quoted) return { records, unterminated: true };
  if (cell !== '' || record.length > 0) endRecord();
  return { records, unterminated: false };
}

/** Spreadsheet apps in some locales write `;`. Pick whichever the header line uses more. */
function detectDelimiter(text: string): string {
  const header = text.replace(/^\uFEFF/, '').split(/\r?\n/, 1)[0] ?? '';
  const semi = (header.match(/;/g) ?? []).length;
  const comma = (header.match(/,/g) ?? []).length;
  return semi > comma ? ';' : ',';
}

const COLUMN_SET: ReadonlySet<string> = new Set(CSV_COLUMNS);

function isColumn(s: string): s is CsvColumn {
  return COLUMN_SET.has(s);
}

function maxLengthIssue(column: CsvColumn, value: string): boolean {
  const limits: Partial<Record<CsvColumn, number>> = { name: 100, species: 100, room: 60, notes: 5000 };
  const limit = limits[column];
  return limit !== undefined && value.length > limit;
}

/** Parse and validate plant CSV. Every problem is reported with its row; valid rows are still returned. */
export function parsePlantCsv(text: string): CsvParseResult {
  const result: CsvParseResult = { rows: [], errors: [], ignoredColumns: [] };
  if (text.trim() === '') {
    result.errors.push({ row: 0, code: 'empty' });
    return result;
  }

  const { records, unterminated } = splitRecords(text, detectDelimiter(text));
  if (unterminated) {
    result.errors.push({ row: 0, code: 'unterminated_quote' });
    return result;
  }
  const isBlank = (r: string[]) => r.every((c) => c.trim() === '');
  const firstIdx = records.findIndex((r) => !isBlank(r));
  const [header, ...body] = firstIdx === -1 ? [] : records.slice(firstIdx);
  if (!header) {
    result.errors.push({ row: 0, code: 'empty' });
    return result;
  }

  const columns = header.map((h) => h.trim().toLowerCase());
  result.ignoredColumns = header.map((h) => h.trim()).filter((h, i) => h !== '' && !isColumn(columns[i] ?? ''));
  if (!columns.includes('name')) {
    result.errors.push({ row: 1, code: 'no_name_column', column: 'name' });
    return result;
  }
  if (body.filter((r) => !isBlank(r)).length > CSV_MAX_ROWS) {
    result.errors.push({ row: 0, code: 'too_many_rows' });
    return result;
  }

  body.forEach((cells, i) => {
    const row = i + 2;
    if (isBlank(cells)) return;
    if (cells.length > columns.length && cells.slice(columns.length).some((c) => c.trim() !== '')) {
      result.errors.push({ row, code: 'wrong_cell_count' });
      return;
    }
    const get = (column: CsvColumn): string => {
      const idx = columns.indexOf(column);
      return idx === -1 ? '' : (cells[idx] ?? '').trim();
    };
    const before = result.errors.length;
    const fail = (code: CsvErrorCode, column: CsvColumn) => result.errors.push({ row, code, column });

    const name = get('name');
    if (name === '') fail('name_required', 'name');
    for (const c of CSV_COLUMNS) if (maxLengthIssue(c, get(c))) fail('too_long', c);

    const light = get('light').toLowerCase();
    const pot = get('pot_material').toLowerCase();
    const soil = get('soil').toLowerCase();
    if (light !== '' && !(LIGHT_VALUES as readonly string[]).includes(light)) fail('invalid_value', 'light');
    if (pot !== '' && !(POT_MATERIAL_VALUES as readonly string[]).includes(pot)) fail('invalid_value', 'pot_material');
    if (soil !== '' && !(SOIL_VALUES as readonly string[]).includes(soil)) fail('invalid_value', 'soil');

    let potSize: number | null = null;
    const rawSize = get('pot_size_cm');
    if (rawSize !== '') {
      const n = Number(toLatinDigits(rawSize));
      if (!Number.isFinite(n) || n <= 0 || n > 200) fail('invalid_number', 'pot_size_cm');
      else potSize = n;
    }
    if (result.errors.length > before) return;

    const parsed = plantInputSchema.safeParse({
      name,
      species: get('species') || null,
      room: get('room') || null,
      light: light || 'unknown',
      potMaterial: pot || 'unknown',
      potSizeCm: potSize,
      soil: soil || 'unknown',
      notes: get('notes'),
    });
    if (parsed.success) result.rows.push({ row, input: parsed.data });
    else fail('invalid_value', 'name');
  });
  return result;
}
