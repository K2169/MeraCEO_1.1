import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { useTheme } from '@/components/use-theme';
import { pickAndUpload } from '@/features/account/use-photo';
import { useSession } from '@/features/auth/session-provider';
import { t } from '@/i18n';

// The optional photo (professionals) or logo (owners) at the top of the first onboarding step. The picture is
// uploaded straight away; its storage key is kept in the draft and saved on the profile when onboarding finishes.
export function PhotoField({ name, uri, kind, onPicked }: { name: string; uri?: string; kind: 'photo' | 'logo'; onPicked: (key: string, uri: string) => void }) {
  const { colors, space, type } = useTheme();
  const { token } = useSession();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const isLogo = kind === 'logo';

  async function choose() {
    if (!token) return;
    setBusy(true);
    setFailed(false);
    try {
      const picked = await pickAndUpload(token, kind);
      if (picked) onPicked(picked.key, picked.uri);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
      <Avatar name={name} url={uri} size={64} icon={isLogo ? 'business' : 'person'} />
      <View style={{ flex: 1, gap: 2 }}>
        <Pressable accessibilityRole="button" onPress={choose} disabled={busy} hitSlop={8}>
          <Text style={[type.caption, { color: colors.primary, fontSize: 16, fontFamily: 'DMSans_700Bold' }]}>
            {busy ? t('photo.uploading') : uri ? t(isLogo ? 'photo.changeLogo' : 'photo.change') : t(isLogo ? 'photo.addLogo' : 'photo.add')}
          </Text>
        </Pressable>
        <Text style={[type.caption, { color: failed ? colors.danger : colors.muted, fontFamily: 'DMSans_500Medium' }]}>{failed ? t('photo.failed') : t(isLogo ? 'photo.hintLogo' : 'photo.hintPhoto')}</Text>
      </View>
    </View>
  );
}
