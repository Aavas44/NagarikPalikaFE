export const TABLE_ROW_COUNT_KEY = "__table_row_count";
export const MAX_TABLE_ROWS = 15;

export type NumberedRowGroup<T extends { key: string }> =
  | { type: "loose"; field: T }
  | { type: "row"; row: number; fields: T[] };

export type FormLayoutGroup<T extends { key: string; section?: string }> =
  | { type: "loose"; field: T }
  | { type: "repeatable"; tableGroup: string; columns: T[] }
  | { type: "fixed-row"; tableGroup: string; title: string; fields: T[] };

type FieldLike = { key: string; section?: string };

const ROW_SUFFIX = /_(\d+)$/;
const DEVANAGARI_DIGITS = "०१२३४५६७८९";
const TABLE_SERIAL_KEY = /^(?:tblx\d+_)?क्र_सं_\d+$/;
const TABLE_PREFIX = /^tblx(\d+)_/;

export function isTableSerialKey(key: string): boolean {
  return TABLE_SERIAL_KEY.test(key.trim());
}

export function rowNumberFromFieldKey(key: string): number | null {
  const match = key.trim().match(ROW_SUFFIX);
  if (!match) return null;
  const row = Number(match[1]);
  return Number.isInteger(row) && row > 0 ? row : null;
}

export function tableGroupId(field: FieldLike): string | null {
  const section = field.section ?? "";
  const fromSection = section.match(/^table:(\d+)/);
  if (fromSection) return fromSection[1];
  const fromKey = field.key.trim().match(TABLE_PREFIX);
  return fromKey ? fromKey[1] : null;
}

export function fixedTableRowMeta(section?: string): {
  table: string;
  row: string;
  title: string;
} | null {
  const match = (section ?? "").match(/^table-row:(\d+):(\d+)(?::(.*))?$/);
  if (!match) return null;
  return { table: match[1], row: match[2], title: (match[3] || "").trim() };
}

function columnBases(fields: FieldLike[]): string[] {
  return fields.map((field) => field.key.replace(ROW_SUFFIX, ""));
}

function sameColumnBases(a: FieldLike[], b: FieldLike[]): boolean {
  const left = columnBases(a);
  const right = columnBases(b);
  return (
    left.length === right.length && left.every((key, index) => key === right[index])
  );
}

function allowsSingleColumnRow(field: FieldLike): boolean {
  return tableGroupId(field) != null || Boolean(field.section?.startsWith("table:"));
}

/** Group consecutive fields that share a `_1` / `_2` suffix into visual table rows. */
export function groupFieldsByNumberedRow<T extends FieldLike>(
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
      rowNumberFromFieldKey(fields[cursor].key) === row &&
      tableGroupId(fields[cursor]) === tableGroupId(fields[index])
    ) {
      sameRow.push(fields[cursor]);
      cursor += 1;
    }
    if (sameRow.length >= 2 || allowsSingleColumnRow(sameRow[0])) {
      groups.push({ type: "row", row, fields: sameRow });
    } else {
      groups.push({ type: "loose", field: sameRow[0] });
    }
    index = cursor;
  }
  return groups;
}

/** Consecutive `_1` / `_2` blocks and detected Word tables become add/remove editors. */
export function layoutFormFields<T extends FieldLike>(
  fields: T[]
): FormLayoutGroup<T>[] {
  const visible = fields.filter((field) => !isTableSerialKey(field.key));
  const layout: FormLayoutGroup<T>[] = [];
  let index = 0;
  while (index < visible.length) {
    const field = visible[index];
    const fixed = fixedTableRowMeta(field.section);
    if (fixed) {
      const rowFields: T[] = [];
      while (index < visible.length) {
        const next = fixedTableRowMeta(visible[index].section);
        if (!next || next.table !== fixed.table || next.row !== fixed.row) break;
        rowFields.push(visible[index]);
        index += 1;
      }
      layout.push({
        type: "fixed-row",
        tableGroup: fixed.table,
        title: fixed.title || rowGroupTitle(Number(fixed.row) || 1),
        fields: rowFields,
      });
      continue;
    }

    const injectedGroup = tableGroupId(field);
    const row = rowNumberFromFieldKey(field.key);
    if (injectedGroup != null && (row === 1 || row == null)) {
      const columns: T[] = [];
      while (index < visible.length) {
        const current = visible[index];
        if (fixedTableRowMeta(current.section)) break;
        if (tableGroupId(current) !== injectedGroup) break;
        const currentRow = rowNumberFromFieldKey(current.key);
        if (currentRow != null && currentRow !== 1) {
          index += 1;
          continue;
        }
        columns.push(current);
        index += 1;
      }
      if (columns.length > 0) {
        layout.push({
          type: "repeatable",
          tableGroup: injectedGroup,
          columns,
        });
        continue;
      }
    }

    const grouped = groupFieldsByNumberedRow(visible.slice(index));
    const group = grouped[0];
    if (!group) break;
    if (group.type === "loose") {
      layout.push({ type: "loose", field: group.field });
      index += 1;
      continue;
    }
    layout.push({
      type: "repeatable",
      tableGroup: tableGroupId(group.fields[0]) ?? `legacy-${group.fields[0].key}`,
      columns: group.fields,
    });
    index += group.fields.length;
    while (index < visible.length) {
      const following = groupFieldsByNumberedRow(visible.slice(index))[0];
      if (!following || following.type !== "row") break;
      if (!sameColumnBases(group.fields, following.fields)) break;
      index += following.fields.length;
    }
  }
  return layout;
}

export function fieldKeyForRow(templateKey: string, row: number): string {
  if (!ROW_SUFFIX.test(templateKey)) return `${templateKey}_${row}`;
  return templateKey.replace(ROW_SUFFIX, `_${row}`);
}

export function layoutHasRepeatableRows<T extends FieldLike>(
  layout: FormLayoutGroup<T>[]
): boolean {
  return layout.some((group) => group.type === "repeatable");
}

export function repeatableTableGroups<T extends FieldLike>(
  layout: FormLayoutGroup<T>[]
): Array<{ tableGroup: string; columns: T[] }> {
  return layout.flatMap((group) =>
    group.type === "repeatable"
      ? [{ tableGroup: group.tableGroup, columns: group.columns }]
      : []
  );
}

function toDevanagari(value: number): string {
  return String(value).replace(
    /\d/g,
    (digit) => DEVANAGARI_DIGITS[Number(digit)] ?? digit
  );
}

export function withTableRowRequestValues(
  values: Record<string, string>,
  rowCount: number | Record<string, number>,
  enabled = true
): Record<string, string> {
  if (!enabled) return values;
  const counts: Record<string, number> =
    typeof rowCount === "number" ? { "1": rowCount } : { ...rowCount };
  const numericCounts = Object.values(counts);
  const maxCount = Math.max(1, ...numericCounts, typeof rowCount === "number" ? rowCount : 1);
  const next: Record<string, string> = {
    ...values,
    [TABLE_ROW_COUNT_KEY]: String(
      typeof rowCount === "number" ? rowCount : maxCount
    ),
  };
  if (typeof rowCount !== "number") {
    for (const [id, count] of Object.entries(counts)) {
      next[`${TABLE_ROW_COUNT_KEY}_${id}`] = String(count);
    }
  }
  const serialTargets = new Set<string>([""]);
  for (const id of Object.keys(counts)) {
    serialTargets.add(`tblx${id}_`);
  }
  for (const [id, count] of Object.entries(counts)) {
    for (let row = 1; row <= count; row += 1) {
      const serial = toDevanagari(row);
      for (const prefix of serialTargets) {
        next[`${prefix}क्र_सं_${row}`] = serial;
      }
      next[`tblx${id}_क्र_सं_${row}`] = serial;
    }
  }
  return next;
}

export function rowGroupTitle(row: number, locale: "en" | "ne" = "ne"): string {
  if (locale === "en") return `Row ${row}`;
  return `क्रम ${toDevanagari(row)}`;
}

export function tableGroupTitle(
  tableGroup: string,
  locale: "en" | "ne" = "ne"
): string {
  const index = Number(tableGroup);
  const n = Number.isFinite(index) ? index : 1;
  if (locale === "en") return `Table ${n}`;
  return `तालिका ${toDevanagari(n)}`;
}

export function labelWithoutRowNumber(label: string, row: number): string {
  const ne = toDevanagari(row);
  return label
    .replace(new RegExp(`\\s*[（(]\\s*(?:${row}|${ne})\\s*[）)]`, "g"), "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function isInjectedTableField(field: FieldLike): boolean {
  return (
    Boolean(field.section?.startsWith("table:")) ||
    Boolean(field.section?.startsWith("table-row:")) ||
    TABLE_PREFIX.test(field.key)
  );
}

export function initialTableRowCounts<T extends FieldLike>(
  layout: FormLayoutGroup<T>[],
  suggested = 1
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const group of layout) {
    if (group.type !== "repeatable") continue;
    const injected = group.columns.some(isInjectedTableField);
    counts[group.tableGroup] = injected ? 1 : Math.max(1, suggested);
  }
  return counts;
}
