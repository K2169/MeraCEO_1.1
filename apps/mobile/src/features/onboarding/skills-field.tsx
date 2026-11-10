import { useState } from 'react';

import { Input } from '@/components/input';
import { t } from '@/i18n';

// A box for a short list typed with commas, such as "Pricing, Exports". It keeps what was typed in a text
// box of its own so the commas stay put while typing, and hands the cleaned list to the form.
export function SkillsField({ value, onChange, error }: { value: string[]; onChange: (skills: string[]) => void; error?: string }) {
  const [text, setText] = useState(value.join(', '));
  return (
    <Input
      label={t('pro.skills')}
      helper={t('pro.skillsHelper')}
      value={text}
      error={error}
      onChangeText={(v) => {
        setText(v);
        onChange(v.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 10));
      }}
    />
  );
}
