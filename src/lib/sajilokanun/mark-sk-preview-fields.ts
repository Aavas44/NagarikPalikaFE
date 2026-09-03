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
