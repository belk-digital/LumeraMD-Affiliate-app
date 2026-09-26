/**
 * Escapes a value for safe interpolation into HTML email templates. Every
 * value that ultimately comes from user input (affiliate email, order name,
 * admin-entered notes, etc.) must go through this before landing in an
 * outbound email's HTML — none of the templates in src/lib/email/templates
 * do their own escaping.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
