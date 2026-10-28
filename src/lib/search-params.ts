/** Flattens Next.js searchParams to single string values (first value wins). */
export function flattenSearchParams(params: Record<string, string | string[] | undefined>): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(params)) out[key] = Array.isArray(value) ? value[0] : value;
  return out;
}
