export const TABLE_ROW_COUNT_KEY = "__table_row_count";
export const MAX_TABLE_ROWS = 15;

export type NumberedRowGroup<T extends { key: string }> =
  | { type: "loose"; field: T }
  | { type: "row"; row: number; fields: T[] };

export type FormLayoutGroup<T extends { key: string }> =
  | { type: "loose"; field: T }
  | { type: "repeatable"; columns: T[] };

const ROW_SUFFIX = /_(\d+)$/;
const DEVANAGARI_DIGITS = "०१२३४५६७८९";
const TABLE_SERIAL_KEY = /^क्र_सं_\d+$/;

export function isTableSerialKey(key: string): boolean {
  return TABLE_SERIAL_KEY.test(key);
}

export function rowNumberFromFieldKey(key: string): number | null {
  const match = key.trim().match(ROW_SUFFIX);
  if (!match) return null;
  const row = Number(match[1]);
  return Number.isInteger(row) && row > 0 ? row : null;
}

/** Group consecutive fields that share a `_1` / `_2` suffix into visual table rows. */
export function groupFieldsByNumberedRow<T extends { key: string }>(
  fields: T[]
): NumberedRowGroup<T>[] {
  const groups: NumberedRowGroup<T>[] = [];
  let index = 0;
  while (index < fields.length) {
    const row = rowNumberFromFieldKey(fields[index].key);
    if (row == null) {
      groups.push({ type: "loose", field: fields[index] });
      index += 1;
      continue;
    }
    const sameRow: T[] = [fields[index]];
    let cursor = index + 1;
    while (
      cursor < fields.length &&
      rowNumberFromFieldKey(fields[cursor].key) === row
    ) {
      sameRow.push(fields[cursor]);
      cursor += 1;
    }
    if (sameRow.length >= 2) {
      groups.push({ type: "row", row, fields: sameRow });
    } else {
      groups.push({ type: "loose", field: sameRow[0] });
    }
    index = cursor;
  }
  return groups;
}

/** Consecutive `_1` / `_2` / `_3` blocks become one add/remove row editor. */
export function layoutFormFields<T extends { key: string }>(
  fields: T[]
): FormLayoutGroup<T>[] {
  const grouped = groupFieldsByNumberedRow(
    fields.filter((field) => !isTableSerialKey(field.key))
  );
  const layout: FormLayoutGroup<T>[] = [];
  let index = 0;
  while (index < grouped.length) {
    const group = grouped[index];
    if (group.type === "loose") {
      layout.push({ type: "loose", field: group.field });
      index += 1;
      continue;
    }
    layout.push({ type: "repeatable", columns: group.fields });
    index += 1;
    while (index < grouped.length && grouped[index].type === "row") {
      index += 1;
    }
  }
  return layout;
}

export function fieldKeyForRow(templateKey: string, row: number): string {
  if (!ROW_SUFFIX.test(templateKey)) return `${templateKey}_${row}`;
  return templateKey.replace(ROW_SUFFIX, `_${row}`);
}

export function layoutHasRepeatableRows<T extends { key: string }>(
  layout: FormLayoutGroup<T>[]
): boolean {
  return layout.some((group) => group.type === "repeatable");
}

export function withTableRowRequestValues(
  values: Record<string, string>,
  rowCount: number,
  enabled = true
): Record<string, string> {
  if (!enabled) return values;
  const next = { ...values, [TABLE_ROW_COUNT_KEY]: String(rowCount) };
  for (let row = 1; row <= rowCount; row += 1) {
    next[`क्र_सं_${row}`] = String(row).replace(
      /\d/g,
      (digit) => DEVANAGARI_DIGITS[Number(digit)] ?? digit
    );
  }
  return next;
}

export function rowGroupTitle(row: number, locale: "en" | "ne" = "ne"): string {
  if (locale === "en") return `Row ${row}`;
  const ne = String(row).replace(
    /\d/g,
    (digit) => DEVANAGARI_DIGITS[Number(digit)] ?? digit
  );
  return `क्रम ${ne}`;
}

export function labelWithoutRowNumber(label: string, row: number): string {
  const ne = String(row).replace(
    /\d/g,
    (digit) => DEVANAGARI_DIGITS[Number(digit)] ?? digit
  );
  return label
    .replace(new RegExp(`\\s*[（(]\\s*(?:${row}|${ne})\\s*[）)]`, "g"), "")
    .replace(/\s{2,}/g, " ")
    .trim();
}
