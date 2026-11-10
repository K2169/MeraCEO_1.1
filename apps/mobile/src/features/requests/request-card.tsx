import { useState } from 'react';
import { Text, View } from 'react-native';

import { Icon } from '@/components/icon';
import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { useTheme } from '@/components/use-theme';
import { placeLine } from '@/features/onboarding/wizard-utils';
import type { RequestItem } from '@/lib/api';
import { t } from '@/i18n';

import { TimeSheet } from './time-sheet';

type Action = 'accept' | 'decline' | 'cancel' | 'complete';

// A planned start time written for people, like "Mon, 12 Nov, 4:00 pm".
export const formatWhen = (iso: string) => new Date(iso).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

// One request. Owners see who they asked; professionals see who asked and about what.
// The buttons shown depend on the status and who is looking (the same rules the server enforces).
export function RequestCard({
  item,
  viewer,
  busy,
  onAction,
  onSchedule,
}: {
  item: RequestItem;
  viewer: 'owner' | 'professional';
  busy: boolean;
  onAction: (action: Action) => void;
  onSchedule: (iso: string) => Promise<boolean>;
}) {
  const { colors, radius, space, type } = useTheme();
  const [picking, setPicking] = useState(false);
  const waiting = item.status === 'pending';
  const accepted = item.status === 'accepted';
  const canAnswer = viewer === 'professional' && waiting;
  const canCancel = waiting || accepted;
  // The consultation can be marked completed once its planned start has passed.
  const started = !!item.scheduledAt && new Date(item.scheduledAt).getTime() <= Date.now();

  // The other person in this request: owners see the professional, professionals see the business.
  const otherName = viewer === 'owner' ? item.professional?.name ?? '' : item.owner?.businessName ?? '';
  const otherPhoto = viewer === 'owner' ? item.professional?.photoUrl : item.owner?.photoUrl;
  const statusTone = accepted ? { bg: colors.greenSoft, fg: colors.accentText } : item.status === 'declined' || item.status === 'cancelled' ? { bg: colors.blueSoft, fg: colors.muted } : { bg: colors.blueSoft, fg: colors.primary };

  return (
    <Card>
      {/* Top: who it is with, what it is about, and the status */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <Avatar name={otherName} url={otherPhoto} size={44} icon={viewer === 'owner' ? 'person' : 'business'} />
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={[type.heading, { color: colors.text }]}>{otherName}</Text>
          <Text numberOfLines={1} style={[type.body, { color: colors.muted }]}>{item.need?.title ?? ''}</Text>
        </View>
        <View style={{ backgroundColor: statusTone.bg, borderRadius: radius.pill, paddingHorizontal: space.md - 2, paddingVertical: 3 }}>
          <Text style={[type.caption, { color: statusTone.fg }]}>{t(`status.${item.status}`)}</Text>
        </View>
      </View>

      {/* The professional also sees what the owner needs and where they are. */}
      {viewer === 'professional' && item.need?.challenge ? <Text numberOfLines={3} style={[type.body, { color: colors.text }]}>{item.need.challenge}</Text> : null}
      {viewer === 'professional' && item.owner ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs + 2 }}>
          <Icon name="location-outline" size={15} color={colors.muted} />
          <Text style={[type.caption, { color: colors.muted, fontFamily: 'DMSans_500Medium' }]}>{item.owner.name} · {placeLine({ city: item.owner.city, state: item.owner.state ?? undefined, country: item.owner.country })}</Text>
        </View>
      ) : null}
      {item.note ? (
        <View style={{ borderLeftWidth: 3, borderLeftColor: colors.border, paddingLeft: space.md }}>
          <Text style={[type.body, { color: colors.muted }]}>{item.note}</Text>
        </View>
      ) : null}

      {/* Accepted requests show when the consultation is planned. */}
      {accepted || item.status === 'completed' ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: colors.background, borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: space.sm + 2 }}>
          <Icon name="calendar-outline" size={16} color={colors.primary} />
          <Text style={[type.caption, { color: item.scheduledAt ? colors.text : colors.muted }]}>
            {item.scheduledAt ? t(started || item.status === 'completed' ? 'consult.was' : 'consult.when', { when: formatWhen(item.scheduledAt) }) : t('consult.notScheduled')}
          </Text>
        </View>
      ) : null}

      {/* Footer: a thin line, then the actions that fit this status and person */}
      {accepted || canAnswer || canCancel ? (
        <View style={{ marginTop: space.xs, paddingTop: space.md, borderTopWidth: 1, borderTopColor: colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm }}>
          {canAnswer ? (
            <>
              <Button label={t('request.decline')} variant="secondary" small disabled={busy} onPress={() => onAction('decline')} />
              <Button label={t('request.accept')} small disabled={busy} onPress={() => onAction('accept')} />
            </>
          ) : (
            <>
              <Button label={t('request.cancel')} variant="secondary" small disabled={busy} onPress={() => onAction('cancel')} />
              {accepted ? (
                <View style={{ flexDirection: 'row', gap: space.sm }}>
                  <Button label={item.scheduledAt ? t('consult.change') : t('consult.schedule')} variant={started ? 'secondary' : 'primary'} small disabled={busy} onPress={() => setPicking(true)} />
                  {started ? <Button label={t('request.complete')} small disabled={busy} onPress={() => onAction('complete')} /> : null}
                </View>
              ) : null}
            </>
          )}
        </View>
      ) : null}
      <TimeSheet
        visible={picking}
        onClose={() => setPicking(false)}
        busy={busy}
        onConfirm={async (iso) => {
          if (await onSchedule(iso)) setPicking(false);
        }}
      />
    </Card>
  );
}
