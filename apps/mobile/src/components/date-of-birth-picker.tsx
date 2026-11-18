import { useMemo, useState } from 'react';
import { Keyboard, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import { Icon } from '@/components/icon';
import { useTheme } from '@/components/use-theme';
import { formatDateInput, toIsoDate } from '@/features/auth/date-of-birth';
import { t } from '@/i18n';

type DateOfBirthPickerProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  helper?: string;
  error?: string;
};

type CalendarMonth = { year: number; month: number };
const MIN_YEAR = 1900;

function dateFromValue(value: string): Date | null {
  const iso = toIsoDate(value);
  if (!iso) return null;
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year!, month! - 1, day!);
}

function monthFromDate(date: Date): CalendarMonth {
  return { year: date.getFullYear(), month: date.getMonth() };
}

function formatDayMonthYear(day: number, month: number, year: number) {
  return String(day).padStart(2, '0') + '/' + String(month + 1).padStart(2, '0') + '/' + year;
}

function shiftMonth(month: CalendarMonth, by: number): CalendarMonth {
  const shifted = new Date(month.year, month.month + by, 1);
  return monthFromDate(shifted);
}

function sameDay(a: Date | null, year: number, month: number, day: number) {
  return Boolean(a && a.getFullYear() === year && a.getMonth() === month && a.getDate() === day);
}

export function DateOfBirthPicker({ label, value, onChangeText, helper, error }: DateOfBirthPickerProps) {
  const { colors, radius, space, type } = useTheme();
  const [open, setOpen] = useState(false);
  const [showYears, setShowYears] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState<CalendarMonth>(() => {
    const selected = dateFromValue(value);
    if (selected) return monthFromDate(selected);
    const today = new Date();
    return { year: today.getFullYear() - 18, month: today.getMonth() };
  });
  const selectedDate = dateFromValue(value);
  const today = new Date();
  const currentMonth = monthFromDate(today);
  const monthLabel = new Date(visibleMonth.year, visibleMonth.month, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const weekdays = useMemo(() => Array.from({ length: 7 }, (_, index) => {
    const day = new Date(2024, 0, 7 + index);
    return day.toLocaleDateString(undefined, { weekday: 'narrow' });
  }), []);

  function openPicker() {
    Keyboard.dismiss();
    const selected = dateFromValue(value);
    if (selected) setVisibleMonth(monthFromDate(selected));
    else setVisibleMonth({ year: today.getFullYear() - 18, month: today.getMonth() });
    setShowYears(false);
    setOpen(true);
  }

  const daysInMonth = new Date(visibleMonth.year, visibleMonth.month + 1, 0).getDate();
  const firstWeekday = new Date(visibleMonth.year, visibleMonth.month, 1).getDay();
  const calendarCells = Array.from({ length: 42 }, (_, index) => {
    const day = index - firstWeekday + 1;
    return day >= 1 && day <= daysInMonth ? day : null;
  });
  const canGoNext = visibleMonth.year < currentMonth.year || (visibleMonth.year === currentMonth.year && visibleMonth.month < currentMonth.month);
  const statusText = error ?? helper;

  return (
    <View style={{ gap: space.sm }}>
      <Text style={[type.caption, { color: colors.muted }]}>{label}</Text>
      <View style={{
        minHeight: 52,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderWidth: 1.5,
        borderColor: error ? colors.danger : colors.border,
        borderRadius: radius.md,
        paddingLeft: space.lg,
        paddingRight: space.xs,
      }}>
        <TextInput
          accessibilityLabel={label}
          value={value}
          onChangeText={(next) => onChangeText(formatDateInput(next))}
          placeholder={t('age.datePlaceholder')}
          placeholderTextColor={colors.muted}
          keyboardType="number-pad"
          maxLength={10}
          style={[type.body, { flex: 1, minHeight: 50, paddingVertical: space.sm, color: colors.text }]}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('age.openCalendar')}
          onPress={openPicker}
          style={({ pressed }) => ({ width: 48, height: 48, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.65 : 1 })}
        >
          <Icon name="calendar-outline" size={22} color={colors.primary} />
        </Pressable>
      </View>
      {statusText ? <Text accessibilityRole={error ? 'alert' : undefined} style={[type.caption, { color: error ? colors.danger : colors.muted }]}>{statusText}</Text> : null}

      <BottomSheet visible={open} onClose={() => setOpen(false)} title={label} maxHeight="90%">
        <View style={{ gap: space.md }}>
          {showYears ? (
            <>
              <Text style={[type.body, { color: colors.muted }]}>{t('age.chooseYear')}</Text>
              <ScrollView
                contentOffset={{ x: 0, y: Math.max(0, today.getFullYear() - (selectedDate?.getFullYear() ?? visibleMonth.year)) * 48 }}
                style={{ maxHeight: 300 }}
                keyboardShouldPersistTaps="handled"
              >
                {Array.from({ length: today.getFullYear() - MIN_YEAR + 1 }, (_, index) => today.getFullYear() - index).map((year) => {
                  const selected = year === visibleMonth.year;
                  return (
                    <Pressable
                      key={year}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      onPress={() => {
                        setVisibleMonth((current) => ({ ...current, year }));
                        setShowYears(false);
                      }}
                      style={({ pressed }) => ({
                        minHeight: 48,
                        justifyContent: 'center',
                        alignItems: 'center',
                        borderRadius: radius.md,
                        backgroundColor: selected ? colors.blueSoft : 'transparent',
                        opacity: pressed ? 0.7 : 1,
                      })}
                    >
                      <Text style={[type.body, { color: selected ? colors.primary : colors.text, fontFamily: selected ? 'DMSans_700Bold' : 'DMSans_500Medium' }]}>{year}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </>
          ) : (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Pressable accessibilityRole="button" accessibilityLabel={t('age.previousMonth')} onPress={() => setVisibleMonth((month) => shiftMonth(month, -1))} style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="arrow-back" size={21} color={colors.primary} />
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel={t('age.chooseYear')} onPress={() => setShowYears(true)} style={{ minHeight: 48, justifyContent: 'center', paddingHorizontal: space.sm }}>
                  <Text style={[type.heading, { color: colors.text }]}>{monthLabel}</Text>
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel={t('age.nextMonth')} disabled={!canGoNext} onPress={() => setVisibleMonth((month) => shiftMonth(month, 1))} style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center', opacity: canGoNext ? 1 : 0.35 }}>
                  <Icon name="arrow-forward" size={21} color={colors.primary} />
                </Pressable>
              </View>
              <View style={{ flexDirection: 'row' }}>
                {weekdays.map((day, index) => (
                  <View key={day + index} style={{ flex: 1, minHeight: 36, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={[type.caption, { color: colors.muted }]}>{day}</Text>
                  </View>
                ))}
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                {calendarCells.map((day, index) => {
                  if (day === null) return <View key={'empty-' + index} style={{ width: '14.2857%', height: 44 }} />;
                  const future = new Date(visibleMonth.year, visibleMonth.month, day) > today;
                  const selected = sameDay(selectedDate, visibleMonth.year, visibleMonth.month, day);
                  const isToday = sameDay(today, visibleMonth.year, visibleMonth.month, day);
                  return (
                    <Pressable
                      key={day}
                      accessibilityRole="button"
                      accessibilityLabel={new Date(visibleMonth.year, visibleMonth.month, day).toLocaleDateString(undefined, { dateStyle: 'full' })}
                      accessibilityState={{ selected, disabled: future }}
                      disabled={future}
                      onPress={() => {
                        onChangeText(formatDayMonthYear(day, visibleMonth.month, visibleMonth.year));
                        setOpen(false);
                      }}
                      style={({ pressed }) => ({
                        width: '14.2857%',
                        height: 44,
                        alignItems: 'center',
                        justifyContent: 'center',
                        opacity: future ? 0.32 : pressed ? 0.65 : 1,
                      })}
                    >
                      <View style={{
                        width: 40,
                        height: 40,
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: radius.pill,
                        backgroundColor: selected ? colors.primary : 'transparent',
                        borderWidth: isToday && !selected ? 1 : 0,
                        borderColor: colors.primary,
                      }}>
                        <Text style={[type.body, { color: selected ? colors.primaryText : future ? colors.muted : colors.text, fontFamily: selected ? 'DMSans_700Bold' : 'DMSans_500Medium' }]}>{day}</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={[type.caption, { color: colors.muted, textAlign: 'center' }]}>{t('age.calendarHint')}</Text>
            </>
          )}
        </View>
      </BottomSheet>
    </View>
  );
}
