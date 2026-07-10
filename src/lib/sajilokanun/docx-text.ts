import mammoth from "mammoth";

export async function extractTextFromDocx(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer: buffer });
  return result.value;
}

export function isLegacyDocFile(filename: string): boolean {
  return /\.doc$/i.test(filename) && !/\.docx$/i.test(filename);
}

export function isSupportedConverterFile(filename: string): boolean {
  return /\.(txt|docx)$/i.test(filename);
}
