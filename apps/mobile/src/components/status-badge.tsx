import { Text, View } from 'react-native';

import type { RequestStatus } from '@meraceo/shared';

import { t } from '@/i18n';

import { useTheme } from './use-theme';

// Coloured label showing a request status (pending, accepted, declined, cancelled, completed).
export function StatusBadge({ status }: { status: RequestStatus }) {
  const { colors, radius, space, type } = useTheme();
  const tone = {
    pending: colors.warning,
    accepted: colors.accent,
    completed: colors.primary,
    declined: colors.danger,
    cancelled: colors.danger,
  }[status];

  return (
    <View
      accessibilityRole="text"
      style={{
        alignSelf: 'flex-start',
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: tone,
        paddingHorizontal: space.sm,
        paddingVertical: space.xs,
      }}
    >
      <Text style={[type.caption, { color: tone }]}>{t(`status.${status}`)}</Text>
    </View>
  );
}
