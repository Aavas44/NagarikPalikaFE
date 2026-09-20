function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeHtmlText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function decodePreviewMarkers(html: string): string {
  return html
    .replace(/&#x0*e000;/gi, "\uE000")
    .replace(/&#x0*e001;/gi, "\uE001")
    .replace(/&#x0*e002;/gi, "\uE002")
    .replace(/&#x0*e003;/gi, "\uE003")
    .replace(/&#57344;/g, "\uE000")
    .replace(/&#57345;/g, "\uE001")
    .replace(/&#57346;/g, "\uE002")
    .replace(/&#57347;/g, "\uE003");
}

function stripTags(value: string): string {
  return value.replace(/<[^>]+>/g, "");
}

/** Convert preview-only field markers from the backend into highlightable spans. */
export function markSkPreviewFields(html: string): string {
  return decodePreviewMarkers(html).replace(
    /\uE000([\s\S]*?)\uE001([\s\S]*?)\uE002([\s\S]*?)\uE003/g,
    (match, keyRaw: string, content: string, keyEndRaw: string) => {
      const key = stripTags(keyRaw).trim();
      const endKey = stripTags(keyEndRaw).trim();
      if (!key || key !== endKey) return match;
      return `<mark class="sk-preview-field" data-sk-field="${escapeHtmlAttr(key)}">${escapeHtmlText(stripTags(content))}</mark>`;
    }
  );
}

const MARK_FIELD_RE =
  /(<mark\b[^>]*\bdata-sk-field="([^"]+)"[^>]*>)([\s\S]*?)(<\/mark>)/gi;

/**
 * Replace text inside preview field marks from current form values (client-side live preview).
 * `displayForKey(key, value)` should return the visible string (including empty-state labels).
 */
export function applyValuesToSkPreviewHtml(
  html: string,
  values: Record<string, string>,
  displayForKey: (key: string, value: string) => string
): string {
  if (!html.includes("data-sk-field")) return html;
  return html.replace(MARK_FIELD_RE, (_match, open: string, key: string, _content: string, close: string) => {
    const display = displayForKey(key, values[key] ?? "");
    return `${open}${escapeHtmlText(display)}${close}`;
  });
}

/** True when the preview HTML still has live-editable field marks. */
export function skPreviewHtmlHasFieldMarks(html: string): boolean {
  return /data-sk-field="/i.test(html);
}
