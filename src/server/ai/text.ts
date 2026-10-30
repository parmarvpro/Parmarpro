/**
 * The text trimmed, then its first `max` characters, counted as code points so that none is split,
 * trimmed again. Shared by the feature files that send enquiry text to a model. Pure.
 */
export function firstCharacters(text: string, max: number): string {
  return Array.from(text.trim()).slice(0, max).join("").trim();
}
