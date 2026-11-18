import { createContext, type ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/icon';
import { useReduceMotion } from '@/components/use-reduce-motion';
import { useTheme } from '@/components/use-theme';
import { t } from '@/i18n';

export type ToastVariant = 'success' | 'error' | 'info';

type ToastItem = {
  id: number;
  message: string;
  variant: ToastVariant;
  duration: number;
};

type ToastContextValue = {
  showToast: (message: string, variant?: ToastVariant, duration?: number) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);
const DEFAULT_DURATION: Record<ToastVariant, number> = { success: 2800, info: 3200, error: 4000 };
const STATUS: Record<ToastVariant, { icon: IconName; color: 'accentText' | 'danger' | 'primary'; soft: 'greenSoft' | 'dangerSoft' | 'blueSoft' }> = {
  success: { icon: 'checkmark-circle', color: 'accentText', soft: 'greenSoft' },
  error: { icon: 'close-circle-outline', color: 'danger', soft: 'dangerSoft' },
  info: { icon: 'information-circle-outline', color: 'primary', soft: 'blueSoft' },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const { colors, radius, shadow, space, type } = useTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  const [toast, setToast] = useState<ToastItem | null>(null);
  const nextId = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-10)).current;

  const showToast = useCallback((message: string, variant: ToastVariant = 'info', duration = DEFAULT_DURATION[variant]) => {
    if (!message.trim()) return;
    setToast({ id: ++nextId.current, message, variant, duration });
  }, []);

  const dismiss = useCallback((id: number) => {
    if (timer.current) clearTimeout(timer.current);
    if (reduceMotion) {
      setToast((current) => current?.id === id ? null : current);
      return;
    }
    Animated.parallel([
      Animated.timing(opacity, { toValue: 0, duration: 140, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: -8, duration: 140, useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (finished) setToast((current) => current?.id === id ? null : current);
    });
  }, [opacity, reduceMotion, translateY]);

  useEffect(() => {
    if (!toast) return;
    if (timer.current) clearTimeout(timer.current);

    if (reduceMotion) {
      opacity.setValue(1);
      translateY.setValue(0);
    } else {
      opacity.setValue(0);
      translateY.setValue(-10);
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.spring(translateY, { toValue: 0, damping: 18, stiffness: 220, useNativeDriver: true }),
      ]).start();
    }
    AccessibilityInfo.announceForAccessibility(toast.message);
    timer.current = setTimeout(() => dismiss(toast.id), toast.duration);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [dismiss, opacity, reduceMotion, toast, translateY]);

  const status = toast ? STATUS[toast.variant] : null;
  const statusColor = status ? colors[status.color] : colors.primary;
  const statusSoft = status ? colors[status.soft] : colors.blueSoft;

  return (
    <ToastContext.Provider value={{ showToast }}>
      <View style={{ flex: 1 }}>
        {children}
        {toast ? (
          <View pointerEvents="box-none" style={{ position: 'absolute', top: insets.top + space.md, left: space.md, right: space.md, zIndex: 1000, elevation: 1000 }}>
            <Animated.View
              accessible
              accessibilityLiveRegion="polite"
              style={{
                minHeight: 60,
                flexDirection: 'row',
                alignItems: 'center',
                gap: space.md,
                paddingLeft: space.md,
                paddingRight: space.xs,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: radius.lg,
                opacity,
                transform: [{ translateY }],
                ...shadow,
              }}
            >
              <View pointerEvents="none" style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: statusSoft }}>
                {status ? <Icon name={status.icon} size={20} color={statusColor} /> : null}
              </View>
              <Text style={[type.body, { color: colors.text, flex: 1, flexShrink: 1 }]}>{toast.message}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('common.dismissNotification')}
                onPress={() => dismiss(toast.id)}
                style={({ pressed }) => ({ width: 48, height: 48, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.65 : 1 })}
              >
                <Icon name="close-circle-outline" size={20} color={colors.muted} />
              </Pressable>
            </Animated.View>
          </View>
        ) : null}
      </View>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const value = useContext(ToastContext);
  if (!value) throw new Error('useToast must be used inside ToastProvider');
  return value;
}
