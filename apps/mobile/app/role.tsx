import { type Href, useRouter } from 'expo-router';
import { Text, View } from 'react-native';

import { Icon } from '@/components/icon';
import { ChoiceCard } from '@/components/choice-card';
import { Screen } from '@/components/screen';
import { useTheme } from '@/components/use-theme';
import { progress } from '@/features/auth/progress-store';
import { t } from '@/i18n';

// Role choice: two big cards, each with a short list of what you get. The pick is kept until
// sign-in, then saved to the server once. A note at the bottom says the choice is permanent.
export default function RoleSelection() {
  const { colors, space, type } = useTheme();
  const router = useRouter();

  // Remember the pick, then go to sign-in.
  async function choose(role: 'owner' | 'professional') {
    await progress.setIntendedRole(role);
    router.push('/sign-in' as Href);
  }

  return (
    <Screen back decor>
      <View style={{ gap: space.xs }}>
        <Text style={[type.title, { color: colors.text }]}>{t('role.title')}</Text>
        <Text style={[type.body, { color: colors.muted }]}>{t('role.subtitle')}</Text>
      </View>

      <View style={{ gap: space.md }}>
        <ChoiceCard
          icon="briefcase-outline"
          title={t('welcome.ownerTitle')}
          body={t('welcome.ownerBody')}
          points={[t('role.ownerPoint1'), t('role.ownerPoint2'), t('role.ownerPoint3')]}
          color="blue"
          onPress={() => choose('owner')}
        />
        <ChoiceCard
          icon="school-outline"
          title={t('welcome.proTitle')}
          body={t('welcome.proBody')}
          points={[t('role.proPoint1'), t('role.proPoint2'), t('role.proPoint3')]}
          color="green"
          onPress={() => choose('professional')}
        />
      </View>

      {/* Reminder that the choice cannot be changed later */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm }}>
        <Icon name="lock-closed-outline" size={18} color={colors.muted} />
        <Text style={[type.caption, { color: colors.muted }]}>{t('role.permanent')}</Text>
      </View>
    </Screen>
  );
}
