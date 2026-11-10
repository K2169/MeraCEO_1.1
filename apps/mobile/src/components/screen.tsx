import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from './icon';
import { PressSurface } from './press-surface';
import { useTheme } from './use-theme';

// Page wrapper for every screen: background, soft decorative shapes, safe-area padding.
// Set scroll={false} for screens that should not scroll. Set back to show a back arrow at the top.
// Set decor for the soft corner circles, which only the welcome and onboarding screens use.
// Set tabs on screens inside the bottom tab bar, which already covers the bottom safe area.
export function Screen({ children, scroll = true, back = false, tabs = false, decor = false }: { children: ReactNode; scroll?: boolean; back?: boolean; tabs?: boolean; decor?: boolean }) {
  const { colors, space } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const padding = { paddingTop: insets.top + space.lg, paddingBottom: (tabs ? 0 : insets.bottom) + space.lg, paddingHorizontal: space.xl };

  // Round, flat button with a thin outline. It is the first item on the
  // page, so it scrolls away with the content instead of floating over the title.
  const backButton = back ? (
    <View style={{ alignSelf: 'flex-start' }}>
      <PressSurface
        face={colors.surface}
        borderColor={colors.border}
        radius={22}
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/get-started'))}
        style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
      >
        <Icon name="arrow-back" size={24} color={colors.primary} />
      </PressSurface>
    </View>
  ) : null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, overflow: 'hidden' }}>
      {decor ? (
        <>
        {/* Decorative soft shapes in the corners. They never take touches. */}
        <View pointerEvents="none" style={{ position: 'absolute', width: 260, height: 260, borderRadius: 130, backgroundColor: colors.blueSoft, top: -90, right: -110, opacity: 0.6 }} />
        <View pointerEvents="none" style={{ position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: colors.greenSoft, bottom: -80, left: -90, opacity: 0.6 }} />
        </>
      ) : null}
      {scroll ? (
        <ScrollView contentContainerStyle={{ flexGrow: 1, gap: space.xl, ...padding }} keyboardShouldPersistTaps="handled">
          {backButton}
          {children}
        </ScrollView>
      ) : (
        <View style={{ flex: 1, gap: space.xl, ...padding }}>
          {backButton}
          {children}
        </View>
      )}
    </View>
  );
}
