import { Pressable, Text, View } from 'react-native';

import { Icon } from '@/components/icon';
import { useTheme } from '@/components/use-theme';
import { t } from '@/i18n';

type Step = { id: string; stage: string };

export function OnboardingStepper({
  steps,
  current,
  furthestUnlocked,
  onSelect,
  disabled = false,
}: {
  steps: readonly Step[];
  current: number;
  furthestUnlocked: number;
  onSelect: (step: number) => void;
  disabled?: boolean;
}) {
  const { colors, space, type } = useTheme();

  return (
    <View accessibilityLabel={t('pro.stepNavigation')} style={{ flexDirection: 'row' }}>
      {steps.map((step, index) => {
        const selected = index === current;
        const completed = index < furthestUnlocked && index !== current;
        const locked = index > furthestUnlocked;
        const unavailable = locked || disabled;
        const circleColor = selected ? colors.primary : completed ? colors.blueSoft : colors.chip;
        const numberColor = selected ? colors.primaryText : locked ? colors.muted : colors.primary;
        const labelColor = selected ? colors.primary : locked ? colors.muted : colors.text;

        return (
          <View key={step.id} style={{ flex: 1, alignItems: 'center' }}>
            {index < steps.length - 1 ? (
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  top: 13,
                  left: '50%',
                  right: '-50%',
                  height: 2,
                  backgroundColor: index < furthestUnlocked ? colors.primary : colors.border,
                }}
              />
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('pro.stepNavigationItem', { current: index + 1, title: t(step.stage) })}
              accessibilityState={{ selected, disabled: unavailable }}
              disabled={unavailable}
              onPress={() => onSelect(index)}
              style={({ pressed }) => ({
                minHeight: 64,
                width: '100%',
                alignItems: 'center',
                gap: space.xs,
                opacity: pressed ? 0.72 : locked ? 0.75 : 1,
              })}
            >
              <View style={{
                zIndex: 1,
                width: 28,
                height: 28,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 14,
                backgroundColor: circleColor,
                borderWidth: selected || completed ? 0 : 1,
                borderColor: colors.border,
              }}>
                {completed ? <Icon name="checkmark" size={15} color={colors.primary} strokeWidth={2.5} /> : (
                  <Text style={[type.footnote, { color: numberColor, fontFamily: 'DMSans_700Bold' }]}>{index + 1}</Text>
                )}
              </View>
              <Text
                numberOfLines={2}
                style={[type.footnote, {
                  color: labelColor,
                  textAlign: 'center',
                  fontFamily: selected ? 'DMSans_700Bold' : 'DMSans_500Medium',
                  paddingHorizontal: space.xs,
                }]}
              >
                {t(step.stage)}
              </Text>
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}
