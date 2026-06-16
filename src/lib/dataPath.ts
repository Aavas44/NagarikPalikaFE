import path from "path";

/** Resolve bundled glossary/data files (standalone repo: `frontend/data/`). */
export function dataFilePath(filename: string): string {
  const root = process.env.DATA_DIR ?? path.join(process.cwd(), "data");
  return path.join(root, filename);
}
