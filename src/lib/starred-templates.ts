export function sortStarredFirst<T extends { id: string }>(
  items: T[],
  starredIds: readonly string[] | undefined
): T[] {
  if (!starredIds?.length) return items;
  const starred = new Set(starredIds);
  const pinned: T[] = [];
  const rest: T[] = [];
  for (const item of items) {
    if (starred.has(item.id)) pinned.push(item);
    else rest.push(item);
  }
  return [...pinned, ...rest];
}

export function toggleStarredId(ids: readonly string[], templateId: string): string[] {
  return ids.includes(templateId)
    ? ids.filter((id) => id !== templateId)
    : [...ids, templateId];
}
