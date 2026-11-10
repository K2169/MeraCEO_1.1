import { useEffect, useState } from 'react';
import { Pressable } from 'react-native';

import { Icon } from '@/components/icon';
import { useTheme } from '@/components/use-theme';
import { useSession } from '@/features/auth/session-provider';
import { api } from '@/lib/api';
import { t } from '@/i18n';

// A bookmark that saves a professional to come back to. It fills in straight away and goes back if saving fails.
export function SaveButton({ professionalId, saved, onChange }: { professionalId: string; saved: boolean; onChange?: (saved: boolean) => void }) {
  const { colors } = useTheme();
  const { token } = useSession();
  const [on, setOn] = useState(saved);
  // Follow the value from outside (for example after the list reloads).
  useEffect(() => setOn(saved), [saved]);

  async function toggle() {
    if (!token) return;
    const next = !on;
    setOn(next);
    onChange?.(next);
    try {
      await (next ? api.saveProfessional(token, professionalId) : api.unsaveProfessional(token, professionalId));
    } catch {
      setOn(!next);
      onChange?.(!next);
    }
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      accessibilityLabel={t(on ? 'saved.remove' : 'saved.add')}
      onPress={toggle}
      hitSlop={8}
      style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}
    >
      <Icon name="bookmark" size={22} color={on ? colors.primary : colors.muted} filled={on} />
    </Pressable>
  );
}
