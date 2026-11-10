import { t } from '@/i18n';

// Structural subset of a Zod issue, so the app does not need to import zod directly.
export interface FormIssue {
  path: readonly PropertyKey[];
  code: string;
  minimum?: unknown;
}

// Maps schema issues to the fields of one step, using i18n copy only (rule 7).
export function errorsFor(issues: FormIssue[], fields: readonly string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of issues) {
    const field = String(issue.path[0] ?? '');
    if (!fields.includes(field) || out[field]) continue;
    out[field] =
      issue.code === 'too_small' && typeof issue.minimum === 'number' && issue.minimum >= 2
        ? t('common.minLength', { min: issue.minimum })
        : /^invalid_(string|format)$/.test(issue.code)
          ? t('common.invalid')
          : t('common.requiredField');
  }
  return out;
}

// One line for the review card: "City, State, Country", leaving out anything not filled in.
export function placeLine(place: { city?: string; state?: string; country?: string }): string {
  return [place.city, place.state, place.country].filter(Boolean).join(', ');
}

// Optional text boxes that were left empty are removed, so the rules see "not given" instead of an empty string.
export function cleanDraft<T extends object>(draft: T): T {
  return Object.fromEntries(Object.entries(draft).filter(([, value]) => value !== '')) as T;
}

// Turns what was typed into a whole number, or undefined when it is empty or not a number.
export function toNumber(text: string): number | undefined {
  const digits = text.replace(/\D/g, '');
  return digits === '' ? undefined : Number(digits);
}
