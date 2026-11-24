/**
 * Small, dependency-free CSV parser for build-time upstream tables.
 *
 * The CH32 source publishes RFC-4180-style CSV with a header row, quoted
 * fields (only where a value contains a comma, quote, or newline), and either
 * LF or CRLF line endings. Values are always read by column name: upstream
 * explicitly reserves the right to add or reorder columns.
 */

export interface CsvTable {
  columns: string[];
  rows: Array<Record<string, string>>;
}

/** Parses CSV text into named records, preserving empty cells as ''. */
export function parseCsv(text: string): CsvTable {
  const source = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const records: string[][] = [];
  let field = '';
  let record: string[] = [];
  let quoted = false;

  const finishField = (): void => {
    record.push(field);
    field = '';
  };
  const finishRecord = (): void => {
    finishField();
    if (record.some((value) => value !== '')) {
      records.push(record);
    }
    record = [];
  };

  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (quoted) {
      if (ch === '"') {
        if (source[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"' && field === '') {
      quoted = true;
    } else if (ch === ',') {
      finishField();
    } else if (ch === '\n') {
      finishRecord();
    } else if (ch === '\r') {
      if (source[i + 1] === '\n') i++;
      finishRecord();
    } else {
      field += ch;
    }
  }
  if (field !== '' || record.length > 0) finishRecord();

  const columns = records.shift() ?? [];
  const rows = records.map((values) => {
    const row: Record<string, string> = {};
    for (let i = 0; i < columns.length; i++) {
      row[columns[i]] = values[i] ?? '';
    }
    return row;
  });
  return { columns, rows };
}

/** Throws a named error when a required upstream column is absent. */
export function requireColumns(
  columns: string[],
  required: readonly string[],
  label: string,
): void {
  const available = new Set(columns);
  const missing = required.filter((name) => !available.has(name));
  if (missing.length > 0) {
    throw new Error(
      `CH32 source ${label} is missing required column(s): ${missing.join(', ')}.`,
    );
  }
}
