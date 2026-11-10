import { type Href, useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { Icon } from '@/components/icon';
import { useTheme } from '@/components/use-theme';
import { t } from '@/i18n';

import { useUnread } from './unread-store';

// The bell in the top bar. It opens the notification list; the red number is how many are unread.
export function BellButton() {
  const { colors } = useTheme();
  const router = useRouter();
  const unread = useUnread();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('notif.bell')}
      onPress={() => router.push('/notifications' as Href)}
      hitSlop={10}
      style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}
    >
      <Icon name="notifications" size={22} color={colors.text} filled={unread > 0} />
      {unread ? (
        <View style={{ position: 'absolute', top: 3, right: 1, minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: 9, backgroundColor: colors.danger, borderWidth: 2, borderColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: colors.solidText, fontSize: 10, lineHeight: 13, fontFamily: 'DMSans_700Bold' }}>{unread > 9 ? '9+' : unread}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}
