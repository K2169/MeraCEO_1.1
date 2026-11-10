import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from './icon';
import { useTheme } from './use-theme';

// Page wrapper for the four bottom-bar tabs, and for pages opened from them (with back). A compact top bar (title on the left, small actions on the
// right, a thin line under it) stays fixed while the content below scrolls. No long intro text: a tab
// says what it is with its title and shows its content straight away.
export function TabScreen({ title, actions, back = false, children }: { title: string; actions?: ReactNode; back?: boolean; children: ReactNode }) {
  const { colors, space, type } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View
        style={{
          paddingTop: insets.top,
          backgroundColor: colors.surface,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <View style={{ height: 56, paddingHorizontal: space.xl - 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            {/* Pages opened from a tab (like Settings) get a back arrow before the title */}
            {back ? (
              <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} hitSlop={10} style={{ width: 36, height: 36, marginLeft: -6, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="arrow-back" size={22} color={colors.text} />
              </Pressable>
            ) : null}
            <Text accessibilityRole="header" style={[type.title, { color: colors.text }]}>
              {title}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>{actions}</View>
        </View>
      </View>
      <ScrollView contentContainerStyle={{ gap: space.md, padding: space.lg, paddingBottom: space.xl }} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
    </View>
  );
}
