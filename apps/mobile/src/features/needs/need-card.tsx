import { Text, View } from 'react-native';

import { Icon } from '@/components/icon';
import { PressSurface } from '@/components/press-surface';
import { useTheme } from '@/components/use-theme';
import type { Need } from '@/lib/api';
import { t } from '@/i18n';

// One of the owner's needs as a tappable row: its title with an open/closed label, the expertise asked for
// as small tags, and a chevron.
export function NeedCard({ need, onPress }: { need: Need; onPress: () => void }) {
  const { colors, radius, space, type } = useTheme();
  const open = need.status === 'open';
  return (
    <PressSurface face={colors.surface} borderColor={colors.border} radius={radius.lg} onPress={onPress} style={{ padding: space.lg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <View style={{ flex: 1, gap: space.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <Text numberOfLines={1} style={[type.heading, { color: colors.text, flexShrink: 1 }]}>{need.title}</Text>
            <View style={{ backgroundColor: open ? colors.greenSoft : colors.blueSoft, borderRadius: radius.pill, paddingHorizontal: space.sm + 2, paddingVertical: 2 }}>
              <Text style={[type.caption, { color: open ? colors.accentText : colors.muted, fontSize: 12 }]}>{t(open ? 'need.open' : 'need.closed')}</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs + 2 }}>
            {need.expertise.map((id) => (
              <View key={id} style={{ backgroundColor: colors.blueSoft, borderRadius: radius.pill, paddingHorizontal: space.sm + 2, paddingVertical: 3 }}>
                <Text style={[type.caption, { color: colors.primary, fontSize: 12 }]}>{t(`expertise.${id}`)}</Text>
              </View>
            ))}
          </View>
        </View>
        <Icon name="chevron-forward" size={20} color={colors.muted} />
      </View>
    </PressSurface>
  );
}
