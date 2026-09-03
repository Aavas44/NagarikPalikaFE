import mammoth from "mammoth";
import { markSkPreviewFields } from "./mark-sk-preview-fields";

const ALIGNMENT_STYLE_MAP = [
  "p[style-name='align-center'] => p.text-center:fresh",
  "p[style-name='align-right'] => p.text-right:fresh",
  "p[style-name='align-justify'] => p.text-justify:fresh",
  "p[style-name='align-left'] => p.text-left:fresh",
  "p[style-name='align-both'] => p.text-justify:fresh",
] as const;

type MammothDocumentElement = {
  type?: string;
  alignment?: string | null;
  styleName?: string | null;
  children?: MammothDocumentElement[];
  [key: string]: unknown;
};

function alignmentStyleName(alignment: string): string | null {
  if (alignment === "center" || alignment === "right" || alignment === "left") {
    return `align-${alignment}`;
  }
  if (alignment === "both" || alignment === "justify") {
    return "align-justify";
  }
  return null;
}

/** Apply alignment-derived style names so mammoth styleMap can emit CSS classes. */
function transformDocumentForAlignment(
  element: MammothDocumentElement
): MammothDocumentElement {
  const children = element.children?.map(transformDocumentForAlignment);
  const next: MammothDocumentElement = children
    ? { ...element, children }
    : { ...element };

  if (next.type === "paragraph" && next.alignment) {
    const styleName = alignmentStyleName(next.alignment);
    if (styleName) {
      return { ...next, styleName };
    }
  }

  return next;
}

/**
 * Convert a filled DOCX blob to HTML for in-app preview, preserving paragraph alignment.
 */
export async function docxToPreviewHtml(blob: Blob): Promise<string> {
  const arrayBuffer = await blob.arrayBuffer();
  const result = await mammoth.convertToHtml(
    { arrayBuffer },
    {
      transformDocument: transformDocumentForAlignment,
      styleMap: [...ALIGNMENT_STYLE_MAP],
    }
  );

  return markSkPreviewFields(result.value);
}
