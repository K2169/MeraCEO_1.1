import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import { Button } from '@/components/button';
import { useTheme } from '@/components/use-theme';
import { t } from '@/i18n';

// Business hours offered for a consultation, every 30 minutes from 9:00 to 18:00.
const SLOTS = Array.from({ length: 19 }, (_, i) => ({ hour: 9 + Math.floor(i / 2), minute: i % 2 ? 30 : 0 }));
const DAYS_AHEAD = 14;

// Short day name for a date pill, like "Mon 12 Nov".
const dayLabel = (d: Date) => d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
// Clock time for a slot, like "4:30 PM".
const slotLabel = (d: Date) => d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

// A bottom sheet for picking when a consultation starts: a day from the next two weeks, then a time slot.
// Times that have already passed today are left out.
export function TimeSheet({ visible, onClose, onConfirm, busy }: { visible: boolean; onClose: () => void; onConfirm: (iso: string) => void; busy: boolean }) {
  const { colors, radius, space, type } = useTheme();
  const [dayIndex, setDayIndex] = useState<number | null>(null);
  const [slotIndex, setSlotIndex] = useState<number | null>(null);

  // Midnight of each of the next days.
  const days = Array.from({ length: DAYS_AHEAD }, (_, i) => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + i);
    return d;
  });
  // The start time for the picked day and slot (null until both are picked).
  const startsAt = dayIndex === null || slotIndex === null ? null : new Date(days[dayIndex]!.getFullYear(), days[dayIndex]!.getMonth(), days[dayIndex]!.getDate(), SLOTS[slotIndex]!.hour, SLOTS[slotIndex]!.minute);
  const pill = (selected: boolean) => ({
    paddingHorizontal: space.md + 2,
    height: 40,
    justifyContent: 'center' as const,
    borderRadius: radius.pill,
    backgroundColor: selected ? colors.primary : colors.surface,
    borderWidth: 1.5,
    borderColor: selected ? colors.primary : colors.border,
  });

  return (
    <BottomSheet visible={visible} onClose={onClose} title={t('consult.sheetTitle')}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: space.lg, paddingBottom: space.md }}>
        <View style={{ gap: space.sm }}>
          <Text style={[type.caption, { color: colors.muted }]}>{t('consult.pickDate')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
            {days.map((d, i) => (
              <Pressable key={d.toISOString()} accessibilityRole="button" accessibilityState={{ selected: dayIndex === i }} onPress={() => { setDayIndex(i); setSlotIndex(null); }} style={pill(dayIndex === i)}>
                <Text style={{ fontSize: 14, fontFamily: 'DMSans_600SemiBold', color: dayIndex === i ? colors.primaryText : colors.text }}>{dayLabel(d)}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {dayIndex !== null ? (
          <View style={{ gap: space.sm }}>
            <Text style={[type.caption, { color: colors.muted }]}>{t('consult.pickTime')}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
              {SLOTS.map((slot, i) => {
                const when = new Date(days[dayIndex]!.getFullYear(), days[dayIndex]!.getMonth(), days[dayIndex]!.getDate(), slot.hour, slot.minute);
                if (when.getTime() <= Date.now()) return null;
                return (
                  <Pressable key={i} accessibilityRole="button" accessibilityState={{ selected: slotIndex === i }} onPress={() => setSlotIndex(i)} style={pill(slotIndex === i)}>
                    <Text style={{ fontSize: 14, fontFamily: 'DMSans_600SemiBold', color: slotIndex === i ? colors.primaryText : colors.text }}>{slotLabel(when)}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        <Button label={t('consult.confirm')} disabled={!startsAt || busy} onPress={() => startsAt && onConfirm(startsAt.toISOString())} />
      </ScrollView>
    </BottomSheet>
  );
}
