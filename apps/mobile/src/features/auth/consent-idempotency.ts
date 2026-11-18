export interface OptionalConsentChoices {
  matching?: boolean;
  contact_sharing?: boolean;
  notifications?: boolean;
}

// Keep a canonical, stable signature so the P1D key is re-used only for the same choices.
export function consentChoiceSignature(choices?: OptionalConsentChoices): string {
  return [choices?.matching, choices?.contact_sharing, choices?.notifications]
    .map((choice) => choice === true ? '1' : '0')
    .join('');
}

// This is a de-duplication key, not a credential; it only needs to be unique and stable in the saved draft.
export function newConsentIdempotencyKey(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}-${Math.random().toString(36).slice(2, 10)}`;
}
