import { Image } from 'expo-image';
import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/button';
import { GoogleButton } from '@/components/google-button';
import { Icon } from '@/components/icon';
import { Screen } from '@/components/screen';
import { useTheme } from '@/components/use-theme';
import { progress } from '@/features/auth/progress-store';
import { signInWithGoogle } from '@/features/auth/google-sign-in';
import { useSession } from '@/features/auth/session-provider';
import { t } from '@/i18n';
import { api } from '@/lib/api';

type Role = 'owner' | 'professional';

const roles: Role[] = ['owner', 'professional'];
const roleIcons: Record<Role, 'storefront' | 'person-outline'> = {
  owner: 'storefront',
  professional: 'person-outline',
};
const heroArt = {
  owner: require('../assets/p2-owner-hero-source.jpg'),
  professional: require('../assets/p2-professional-hero-source.jpg'),
};

// P2: role-aware login. Google uses the verified server flow; password and OTP
// stay visibly unavailable until the API and delivery provider support them.
export default function SignInScreen() {
  const { colors, radius, space, type } = useTheme();
  const router = useRouter();
  const { intent } = useLocalSearchParams<{ intent?: string }>();
  const { startSession } = useSession();
  const [role, setRole] = useState<Role>('professional');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void progress.getIntendedRole().then((saved) => {
      if (active && saved) setRole(saved);
    }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  async function chooseRole(nextRole: Role) {
    setRole(nextRole);
    setMessage(null);
    try {
      await progress.setIntendedRole(nextRole);
    } catch {
      setMessage(t('common.genericError'));
    }
  }

  async function onGoogle() {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      await progress.setIntendedRole(role);
      const idToken = await signInWithGoogle();
      if (!idToken) {
        setMessage(t('auth.cancelled'));
        return;
      }
      const { sessionToken } = await api.signInWithGoogleToken(idToken);
      await startSession(sessionToken);
      router.replace('/' as Href);
    } catch {
      // Never show or log the token or raw provider errors.
      setMessage(t('auth.failed'));
    } finally {
      setBusy(false);
    }
  }

  async function onPasswordLogin() {
    if (busy) return;
    if (intent === 'signup') {
      setMessage(t('auth.googleSignupFirst'));
      return;
    }
    if (!identifier.trim() || !password) {
      setMessage(t('auth.enterCredentials'));
      return;
    }
    setBusy(true); setMessage(null);
    try {
      await progress.setIntendedRole(role);
      const { sessionToken } = await api.signInWithPassword(identifier.trim(), password);
      await startSession(sessionToken);
      setPassword('');
      router.replace('/' as Href);
    } catch { setMessage(t('auth.invalidCredentials')); }
    finally { setBusy(false); }
  }

  function onOtpLogin() {
    setMessage(t('auth.otpComingSoon'));
  }

  const actionTone = role === 'professional' ? 'green' : 'brand';

  return (
    <Screen scroll>
      <View style={{ gap: space.md }}>
        <View style={{ marginHorizontal: -space.xl, marginTop: -space.lg, backgroundColor: colors.background }}>
          <View style={{ width: '100%', aspectRatio: 900 / 680, overflow: 'hidden', backgroundColor: colors.surface }}>
            <Image
              source={heroArt[role]}
              style={{ width: '100%', aspectRatio: role === 'professional' ? 900 / 640 : 900 / 680 }}
              contentFit="cover"
              contentPosition="top"
              accessible
              accessibilityLabel={t('welcome.heroDescription')}
            />
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: space.xs }}>
          {roles.map((item) => {
            const selected = item === role;
            const fill = item === 'professional' ? colors.solidGreen : colors.primary;
            const foreground = selected ? (item === 'professional' ? colors.solidText : colors.primaryText) : colors.text;
            return (
              <Pressable
                key={item}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => void chooseRole(item)}
                style={{
                  flex: 1,
                  minHeight: 48,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: space.sm,
                  paddingHorizontal: space.sm,
                  backgroundColor: selected ? fill : colors.unselectedSurface,
                  borderRadius: radius.pill,
                }}
              >
                <Icon name={roleIcons[item]} size={22} color={foreground} filled={selected} />
                <Text numberOfLines={1} style={[type.caption, { color: foreground, flexShrink: 1 }]}>
                  {t(`welcome.selector.${item}`)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={{ gap: space.md }}>
          <View
            style={{
              minHeight: 52,
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: space.md,
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderWidth: 1.5,
              borderRadius: radius.md,
            }}
          >
            <Icon name="mail-outline" size={21} color={colors.muted} />
            <TextInput
              accessibilityLabel={t('auth.identifier')}
              value={identifier}
              onChangeText={setIdentifier}
              placeholder={t('auth.identifier')}
              placeholderTextColor={colors.muted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="username"
              returnKeyType="next"
              style={{ ...type.body, flex: 1, minHeight: 50, marginLeft: space.md, color: colors.text }}
            />
          </View>

          <View
            style={{
              minHeight: 52,
              flexDirection: 'row',
              alignItems: 'center',
              paddingLeft: space.md,
              paddingRight: space.xs,
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderWidth: 1.5,
              borderRadius: radius.md,
            }}
          >
            <Icon name="lock-closed-outline" size={21} color={colors.muted} />
            <TextInput
              accessibilityLabel={t('auth.password')}
              value={password}
              onChangeText={setPassword}
              placeholder={t('auth.password')}
              placeholderTextColor={colors.muted}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoComplete="current-password"
              returnKeyType="done"
              onSubmitEditing={onPasswordLogin}
              style={{ ...type.body, flex: 1, minHeight: 50, marginLeft: space.md, color: colors.text }}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t(showPassword ? 'auth.hidePassword' : 'auth.showPassword')}
              accessibilityState={{ selected: showPassword }}
              onPress={() => setShowPassword((value) => !value)}
              style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
            >
              <Icon name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={21} color={colors.muted} />
            </Pressable>
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={() => setMessage(t('auth.forgotUnavailable'))}
          style={{ minHeight: 36, alignSelf: 'flex-end', justifyContent: 'center', paddingHorizontal: space.xs }}
        >
          <Text style={[type.caption, { color: colors.primary }]}>{t('auth.forgotPassword')}</Text>
        </Pressable>

        <View style={{ gap: space.md }}>
          <Button tone={actionTone} label={intent === 'signup' ? t('welcome.createAccount') : t('auth.login')} onPress={onPasswordLogin} disabled={busy} arrow pill minHeight={48} />

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
            <Text style={[type.caption, { color: colors.muted }]}>{t('common.or')}</Text>
            <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
          </View>

          <Button
            tone={actionTone}
            label={t('auth.loginViaOtpComingSoon')}
            variant="outline"
            pill
            minHeight={48}
            disabled
            onPress={onOtpLogin}
          />
          <GoogleButton label={busy ? t('common.loading') : t('auth.googleLogin')} onPress={() => void onGoogle()} disabled={busy} />
        </View>

        {message ? (
          <Text accessibilityRole="alert" style={[type.caption, { color: colors.danger, textAlign: 'center' }]}>
            {message}
          </Text>
        ) : null}
      </View>
    </Screen>
  );
}
