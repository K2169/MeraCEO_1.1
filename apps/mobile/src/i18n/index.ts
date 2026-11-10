import en from './en.json';

// Copy lives in JSON only (rule 7). English is the only active locale until device-language
// switching lands with W6-08; hi.json already carries the matching keys.
const dictionary: Record<string, string> = en;

// Returns the text for a key from en.json (fills {placeholders} when given). All screen text goes through here.
export function t(key: string, vars?: Record<string, string | number>): string {
  const template = dictionary[key] ?? key;
  if (!vars) return template;
  return Object.entries(vars).reduce(
    (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
    template,
  );
}
