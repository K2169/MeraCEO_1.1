import { type Href } from 'expo-router';
import { TabList, TabSlot, Tabs, TabTrigger } from 'expo-router/ui';
import { Animated, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from './icon';
import { useSelectFade } from './use-select-fade';
import { useTheme } from './use-theme';

export interface TabItem {
  name: string; // route file name inside the layout folder (index, requests, account)
  href: Href;
  label: string;
  icon: IconName;
  badge?: number; // a small red count on the icon (for example unread notifications)
}

// One button in the bar: icon over label. The selected tab gets a soft blue pill behind its icon that fades
// in over 200ms, a thicker icon line, and a blue bold label. The tab trigger passes isFocused and the press handlers.
function TabButton({ item, isFocused, ...rest }: { item: TabItem; isFocused?: boolean }) {
  const { colors } = useTheme();
  const fade = useSelectFade(!!isFocused);
  const color = isFocused ? colors.primary : colors.muted;
  return (
    <Pressable accessibilityRole="tab" accessibilityState={{ selected: !!isFocused }} {...rest} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 8 }}>
      <View style={{ width: 60, height: 32, alignItems: 'center', justifyContent: 'center' }}>
        {/* The pill behind the icon */}
        <Animated.View style={{ position: 'absolute', width: 60, height: 32, borderRadius: 16, backgroundColor: colors.blueSoft, opacity: fade }} />
        <View>
          <Icon name={item.icon} size={22} color={color} strokeWidth={isFocused ? 2.4 : 1.8} />
          {item.badge ? (
            <View style={{ position: 'absolute', top: -5, right: -9, minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: 9, backgroundColor: colors.danger, borderWidth: 2, borderColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: colors.solidText, fontSize: 10, lineHeight: 13, fontFamily: 'DMSans_700Bold' }}>{item.badge > 9 ? '9+' : item.badge}</Text>
            </View>
          ) : null}
        </View>
      </View>
      <Text numberOfLines={1} style={{ marginTop: 2, fontSize: 11, lineHeight: 14, color, fontFamily: isFocused ? 'DMSans_600SemiBold' : 'DMSans_500Medium' }}>
        {item.label}
      </Text>
    </Pressable>
  );
}

// The bottom tab bar shared by the owner and professional homes: a normal full-width bar with a thin line on
// top, sitting above the phone's gesture area. Each home passes its own tabs.
export function AppTabs({ items }: { items: TabItem[] }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Tabs>
      <TabSlot />
      <TabList
        style={{
          flexDirection: 'row',
          backgroundColor: colors.surface,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          paddingBottom: insets.bottom,
        }}
      >
        {items.map((item) => (
          <TabTrigger key={item.name} name={item.name} href={item.href} asChild>
            <TabButton item={item} />
          </TabTrigger>
        ))}
      </TabList>
    </Tabs>
  );
}
