import { datesWithAvailability, slotsForDate, zonedTimeToIso, type WeeklyAvailabilityWindow } from '@meraceo/shared';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import { Button } from '@/components/button';
import { useTheme } from '@/components/use-theme';
import { t } from '@/i18n';

const DAYS_AHEAD = 14;

function dateLabel(dateKey: string, timezone: string): string {
  const instant = zonedTimeToIso(dateKey, '12:00', timezone);
  if (!instant) return dateKey;
  return new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short', timeZone: timezone }).format(new Date(instant));
}

function timeLabel(instant: string, timezone: string): string {
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', timeZone: timezone }).format(new Date(instant));
}

// Lets both people on a request choose a start time from the professional's recurring
// availability. Dates and times are interpreted in the professional's time zone.
export function TimeSheet({
  visible,
  onClose,
  onConfirm,
  busy,
  availabilityWindows,
  timezone,
  durationMinutes,
}: {
  visible: boolean;
  onClose: () => void;
  onConfirm: (iso: string) => void;
  busy: boolean;
  availabilityWindows: readonly WeeklyAvailabilityWindow[];
  timezone: string | null;
  durationMinutes: number | null;
}) {
  const { colors, radius, space, type } = useTheme();
  const [chosenDate, setChosenDate] = useState<string | null>(null);
  const [chosenStart, setChosenStart] = useState<string | null>(null);
  const now = new Date();
  const availableDates = timezone && durationMinutes
    ? datesWithAvailability(now, timezone, durationMinutes, availabilityWindows, DAYS_AHEAD)
    : [];
  const selectedDate = chosenDate && availableDates.includes(chosenDate) ? chosenDate : availableDates[0] ?? null;
  const availableSlots = selectedDate && timezone && durationMinutes
    ? slotsForDate(selectedDate, timezone, durationMinutes, availabilityWindows, now)
    : [];
  const selectedSlot = availableSlots.find((slot) => slot.startsAt === chosenStart) ?? null;
  const configured = Boolean(timezone && durationMinutes && availabilityWindows.length);

  const pill = (selected: boolean) => ({
    paddingHorizontal: space.md + 2,
    height: 44,
    justifyContent: 'center' as const,
    borderRadius: radius.pill,
    backgroundColor: selected ? colors.primary : colors.surface,
    borderWidth: 1.5,
    borderColor: selected ? colors.primary : colors.border,
  });

  return (
    <BottomSheet visible={visible} onClose={onClose} title={t('consult.sheetTitle')}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: space.lg, paddingBottom: space.md }}>
        {configured ? (
          <Text style={[type.caption, { color: colors.muted }]}>
            {t('consult.timezoneDuration', { timezone: timezone ?? '', minutes: durationMinutes ?? '' })}
          </Text>
        ) : (
          <Text style={[type.body, { color: colors.muted }]}>{t('consult.availabilityMissing')}</Text>
        )}

        {configured && availableDates.length === 0 ? (
          <Text style={[type.body, { color: colors.muted }]}>{t('consult.noAvailability')}</Text>
        ) : null}

        {configured && availableDates.length > 0 && timezone ? (
          <>
            <View style={{ gap: space.sm }}>
              <Text style={[type.caption, { color: colors.muted }]}>{t('consult.pickDate')}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
                {availableDates.map((dateKey) => {
                  const selected = selectedDate === dateKey;
                  const label = dateLabel(dateKey, timezone);
                  return (
                    <Pressable
                      key={dateKey}
                      accessibilityRole="button"
                      accessibilityLabel={label}
                      accessibilityState={{ selected }}
                      onPress={() => { setChosenDate(dateKey); setChosenStart(null); }}
                      style={pill(selected)}
                    >
                      <Text style={{ fontSize: 14, fontFamily: 'DMSans_600SemiBold', color: selected ? colors.primaryText : colors.text }}>{label}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            {selectedDate ? (
              <View style={{ gap: space.sm }}>
                <Text style={[type.caption, { color: colors.muted }]}>{t('consult.pickTime')}</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
                  {availableSlots.map((slot) => {
                    const selected = selectedSlot?.startsAt === slot.startsAt;
                    return (
                      <Pressable
                        key={slot.startsAt}
                        accessibilityRole="button"
                        accessibilityLabel={timeLabel(slot.startsAt, timezone)}
                        accessibilityState={{ selected }}
                        onPress={() => setChosenStart(slot.startsAt)}
                        style={pill(selected)}
                      >
                        <Text style={{ fontSize: 14, fontFamily: 'DMSans_600SemiBold', color: selected ? colors.primaryText : colors.text }}>{timeLabel(slot.startsAt, timezone)}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null}
          </>
        ) : null}

        <Button label={t('consult.confirm')} disabled={!selectedSlot || busy} onPress={() => selectedSlot && onConfirm(selectedSlot.startsAt)} />
      </ScrollView>
    </BottomSheet>
  );
}
