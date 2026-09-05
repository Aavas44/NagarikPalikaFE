const FIELD_MARKER_RE = /\uE000([^\uE001]+)\uE001([\s\S]*?)\uE002\1\uE003/g;

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

/** Convert preview-only field markers from the backend into highlightable spans. */
export function markSkPreviewFields(html: string): string {
  return html.replace(FIELD_MARKER_RE, (_match, key: string, content: string) => {
    const safeKey = escapeHtmlAttr(key);
    const safeContent = escapeHtmlText(content);
    return `<mark class="sk-preview-field" data-sk-field="${safeKey}">${safeContent}</mark>`;
  });
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
