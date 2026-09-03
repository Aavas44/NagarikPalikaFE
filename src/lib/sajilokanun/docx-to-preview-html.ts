import mammoth from "mammoth";
import { markSkPreviewFields } from "./mark-sk-preview-fields";

const ALIGNMENT_STYLE_MAP = [
  "p[style-name='align-center'] => p.text-center:fresh",
  "p[style-name='align-right'] => p.text-right:fresh",
  "p[style-name='align-justify'] => p.text-justify:fresh",
  "p[style-name='align-left'] => p.text-left:fresh",
  "p[style-name='align-both'] => p.text-justify:fresh",
] as const;

function alignmentStyleName(alignment: string): string | null {
  if (alignment === "center" || alignment === "right" || alignment === "left") {
    return `align-${alignment}`;
  }
  if (alignment === "both" || alignment === "justify") {
    return "align-justify";
  }
  return null;
}

/**
 * Convert a filled DOCX blob to HTML for in-app preview, preserving paragraph alignment.
 */
export async function docxToPreviewHtml(blob: Blob): Promise<string> {
  const arrayBuffer = await blob.arrayBuffer();
  const transformDocument = mammoth.transforms.paragraph((element) => {
    const styleName = element.alignment
      ? alignmentStyleName(element.alignment)
      : null;
    if (styleName) {
      return { ...element, styleName };
    }
    return element;
  });

  const result = await mammoth.convertToHtml(
    { arrayBuffer },
    {
      transformDocument,
      styleMap: [...ALIGNMENT_STYLE_MAP],
    }
  );

  return markSkPreviewFields(result.value);
}
