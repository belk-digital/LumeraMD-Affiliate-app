/**
 * Where an emailed login link may send a member afterwards. Only a sign-in request on this site is
 * allowed, so a login link can never be turned into a redirect to somewhere else.
 */
export function safeOidcNext(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2000) return null;
  if (!value.startsWith("/oauth/authorize?")) return null;
  if (/[\\\r\n\t\0]/.test(value)) return null;
  return value;
}
