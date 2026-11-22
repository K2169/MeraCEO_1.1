import { type Href, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Reanimated, { FadeIn, ReduceMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Icon, type IconName } from '@/components/icon';
import { useReduceMotion } from '@/components/use-reduce-motion';
import { SELECT_FADE_MS, useSelectFade } from '@/components/use-select-fade';
import { useTheme } from '@/components/use-theme';
import { progress } from '@/features/auth/progress-store';
import { t } from '@/i18n';

const roleFade = FadeIn.duration(SELECT_FADE_MS).reduceMotion(ReduceMotion.System);

const heroArt = {
  owner: require('../assets/welcome-hero.jpg'),
  professional: require('../assets/welcome-professional-hero.jpg'),
};

const roles = ['owner', 'professional'] as const;
type Role = (typeof roles)[number];

const roleIcons: Record<Role, IconName> = { owner: 'storefront', professional: 'person-outline' };
const benefitIcons: Record<Role, readonly IconName[]> = {
  owner: ['target', 'users', 'calendar-outline', 'trending-up'],
  professional: ['users', 'calendar-outline', 'trending-up', 'star'],
};

// S1 / P1: welcome artwork, role selection, role benefits and account actions.
export default function GetStarted() {
  const { colors, radius, space, type } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  const { fontScale } = useWindowDimensions();
  const [role, setRole] = useState<Role>('owner');
  const [hasSwitchedRole, setHasSwitchedRole] = useState(false);
  const ownerSelection = useSelectFade(role === 'owner');
  const professionalSelection = useSelectFade(role === 'professional');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  // Restore the most recent role selection.
  useEffect(() => {
    let active = true;
    void progress.getIntendedRole().then((saved) => {
      if (active && saved) setRole(saved);
    }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  // Persist role intent before opening the shared Google sign-in screen.
  async function enter(intent: 'signup' | 'login') {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    try {
      await progress.setIntendedRole(role);
      router.push({ pathname: '/sign-in', params: { intent } } as Href);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  const actionTone = role === 'professional' ? 'green' : 'brand';
  const benefitColors = [colors.primary, colors.purple, colors.accentText, colors.yellow];

  return (
    <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: colors.background }}>
      <StatusBar style="auto" />
      <View style={{ paddingBottom: space.sm, backgroundColor: colors.background }}>
        <Image
          source={heroArt[role]}
          transition={hasSwitchedRole && !reduceMotion ? SELECT_FADE_MS : 0}
          style={{ width: '100%', aspectRatio: 900 / 858 }}
          contentFit="contain"
          accessible
          accessibilityLabel={t('welcome.heroDescription')}
        />
        <Pressable accessibilityRole="button" accessibilityLabel={t('support.title')} onPress={() => router.push('/support' as Href)} style={{ position: 'absolute', top: space.sm, right: space.sm, width: 44, height: 44, borderRadius: radius.pill, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="information-circle-outline" size={22} color={colors.primary} />
        </Pressable>
      </View>
      <View
        style={{
          flexGrow: 1,
          gap: space.md,
          marginTop: -space.md,
          paddingTop: space.lg,
          paddingHorizontal: space.lg,
          paddingBottom: insets.bottom + space.sm,
          backgroundColor: colors.surface,
          borderTopLeftRadius: radius.lg,
          borderTopRightRadius: radius.lg,
        }}
      >
        <View style={{ gap: space.sm }}>
          <View style={{ flexDirection: 'row', gap: space.xs }}>
            {roles.map((item) => {
              const selected = item === role;
              const selectedFill = item === 'professional' ? colors.solidGreen : colors.primary;
              const selectedText = item === 'professional' ? colors.solidText : colors.primaryText;
              const foreground = selected ? selectedText : colors.text;
              const selection = item === 'owner' ? ownerSelection : professionalSelection;
              const backgroundColor = selection.interpolate({
                inputRange: [0, 1],
                outputRange: [colors.unselectedSurface, selectedFill],
              });
              return (
                <Pressable
                  key={item}
                  accessibilityRole="button"
                  accessibilityState={{ selected, disabled: busy }}
                  disabled={busy}
                  onPress={() => {
                    if (selected) return;
                    setHasSwitchedRole(true);
                    setRole(item);
                  }}
                  style={{
                    flex: 1, minHeight: 52, padding: space.sm, gap: space.sm,
                    justifyContent: 'center', alignItems: 'center', flexDirection: 'row',
                    borderRadius: radius.md,
                  }}
                >
                  <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: radius.md, backgroundColor }]} />
                  <Icon name={roleIcons[item]} size={24} color={foreground} filled={selected} />
                  <Text style={[type.caption, { color: foreground, flexShrink: 1 }]}>{t(`welcome.selector.${item}`)}</Text>
                  {selected ? (
                    <Reanimated.View
                      entering={hasSwitchedRole ? roleFade : undefined}
                      pointerEvents="none"
                      importantForAccessibility="no"
                      style={{
                        position: 'absolute',
                        bottom: -space.sm,
                        left: '50%',
                        marginLeft: -space.sm,
                        borderLeftWidth: space.sm,
                        borderRightWidth: space.sm,
                        borderTopWidth: space.sm,
                        borderColor: 'transparent',
                        borderTopColor: selectedFill,
                      }}
                    />
                  ) : null}
                </Pressable>
              );
            })}
          </View>
          <Reanimated.View
            key={role}
            entering={hasSwitchedRole ? roleFade : undefined}
            style={{
              flexDirection: 'row',
              paddingVertical: space.md,
              paddingHorizontal: space.xs,
              backgroundColor: colors.surface,
              borderRadius: radius.lg,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: colors.border,
            }}
          >
            {benefitIcons[role].map((icon, index) => (
              <View key={icon} style={{ flex: 1, alignItems: 'center', gap: space.sm, paddingHorizontal: space.xs }}>
                {index > 0 ? (
                  <View
                    pointerEvents="none"
                    style={{ position: 'absolute', left: 0, top: space.sm, bottom: space.sm, width: StyleSheet.hairlineWidth, backgroundColor: colors.muted, opacity: 0.45 }}
                  />
                ) : null}
                <Icon name={icon} size={26} color={benefitColors[index]} filled />
                <Text
                  style={[
                    type.footnote,
                    { color: colors.text, textAlign: 'center', includeFontPadding: false, minHeight: type.footnote.lineHeight * fontScale * 3 },
                  ]}
                >
                  {t(`welcome.benefit.${role}.${index + 1}`)}
                </Text>
              </View>
            ))}
          </Reanimated.View>
        </View>
        <View style={{ gap: space.md }}>
          <View style={{ gap: space.md }}>
            <Button
              tone={actionTone}
              labelPrefix={t('welcome.newUser')}
              label={t('welcome.signUp')}
              variant="outline"
              pill
              arrow
              minHeight={48}
              disabled={busy}
              onPress={() => void enter('signup')}
            />
            <Button
              tone={actionTone}
              labelPrefix={t('welcome.existingUser')}
              label={t('welcome.logIn')}
              pill
              arrow
              minHeight={48}
              disabled={busy}
              onPress={() => void enter('login')}
            />
            {failed ? <Text accessibilityRole="alert" style={[type.caption, { color: colors.danger }]}>{t('common.genericError')}</Text> : null}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: 'auto' }}>
            <View style={{ flex: 1, height: 1, backgroundColor: colors.muted, opacity: 0.45 }} />
            <Text
              style={[type.footnote, { color: colors.muted, textAlign: 'center', flexShrink: 1, maxWidth: '86%' }]}
            >
              {t('welcome.trust')}
            </Text>
            <View style={{ flex: 1, height: 1, backgroundColor: colors.muted, opacity: 0.45 }} />
          </View>
        </View>
      </View>
    </View>
  );
}
