const CHUNK_SIZE = 800;
const CHUNK_OVERLAP = 200;

function findBreakPoint(text: string, start: number, end: number): number {
  const slice = text.slice(start, end);
  const breakPoints = ["\n\n", "।", ". ", "? ", "! ", "\n"];

  for (const point of breakPoints) {
    const idx = slice.lastIndexOf(point);
    if (idx > CHUNK_SIZE * 0.5) {
      return start + idx + point.length;
    }
  }

  return end;
}

export function splitTextIntoChunks(text: string): string[] {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\s+/g, " ").trim();

  if (!normalized) {
    return [];
  }

  const chunks: string[] = [];
  let start = 0;

  while (start < normalized.length) {
    let end = Math.min(start + CHUNK_SIZE, normalized.length);

    if (end < normalized.length) {
      end = findBreakPoint(normalized, start, end);
    }

    const chunk = normalized.slice(start, end).trim();
    if (chunk) {
      chunks.push(chunk);
    }

    if (end >= normalized.length) {
      break;
    }

    start = Math.max(end - CHUNK_OVERLAP, start + 1);
  }

  return chunks;
}

export { CHUNK_SIZE, CHUNK_OVERLAP };
