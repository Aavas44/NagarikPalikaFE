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

async function convertDocxToAlignedHtml(blob: Blob): Promise<string> {
  const arrayBuffer = await blob.arrayBuffer();
  const result = await mammoth.convertToHtml(
    { arrayBuffer },
    {
      transformDocument: transformDocumentForAlignment,
      styleMap: [...ALIGNMENT_STYLE_MAP],
    }
  );
  return result.value || "";
}

/**
 * Turn mammoth alignment classes into inline styles so contentEditable editors
 * and html-to-docx round-trips keep center/justify/right formatting.
 */
export function applyInlineAlignmentStyles(html: string): string {
  const alignFromClass: Array<[RegExp, string]> = [
    [/\btext-center\b/i, "center"],
    [/\btext-right\b/i, "right"],
    [/\btext-justify\b/i, "justify"],
    [/\btext-left\b/i, "left"],
  ];

  return html.replace(/<p\b([^>]*)>/gi, (full, attrs: string) => {
    const classMatch = attrs.match(/\bclass\s*=\s*"([^"]*)"/i);
    if (!classMatch) return full;
    const className = classMatch[1];
    let align: string | null = null;
    for (const [re, value] of alignFromClass) {
      if (re.test(className)) {
        align = value;
        break;
      }
    }
    if (!align) return full;

    if (/\bstyle\s*=\s*"/i.test(attrs)) {
      return `<p${attrs.replace(
        /\bstyle\s*=\s*"/i,
        `style="text-align: ${align}; `
      )}>`;
    }
    return `<p${attrs} style="text-align: ${align}">`;
  });
}

/**
 * Convert a filled DOCX blob to HTML for in-app preview, preserving paragraph alignment.
 */
export async function docxToPreviewHtml(blob: Blob): Promise<string> {
  const html = await convertDocxToAlignedHtml(blob);
  return markSkPreviewFields(html);
}

/**
 * Convert a template DOCX to editable HTML with alignment preserved as inline styles.
 */
export async function docxToEditableHtml(blob: Blob): Promise<string> {
  const html = await convertDocxToAlignedHtml(blob);
  return applyInlineAlignmentStyles(html) || "<p></p>";
}
