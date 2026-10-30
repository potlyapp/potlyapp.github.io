const ARABIC_INDIC = '٠١٢٣٤٥٦٧٨٩';
const PERSIAN_INDIC = '۰۱۲۳۴۵۶۷۸۹';

/** Folds Arabic/Persian letter variants, digits, diacritics and ZWNJ so Persian search is forgiving. */
export function normalizeText(input: string): string {
  return input
    .normalize('NFKC')
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[٠-٩]/g, (d) => String(ARABIC_INDIC.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String(PERSIAN_INDIC.indexOf(d)))
    .replace(/[ً-ٰٟ‌‍]/g, '')
    .toLowerCase()
    .trim();
}

/** Every whitespace-separated token of the query must appear in the haystack. */
export function matchesQuery(fields: ReadonlyArray<string | null | undefined>, query: string): boolean {
  const tokens = normalizeText(query).split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;
  const haystack = normalizeText(fields.filter(Boolean).join(' '));
  return tokens.every((t) => haystack.includes(t));
}
