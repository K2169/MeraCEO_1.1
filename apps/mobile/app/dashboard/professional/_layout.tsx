import type { Href } from 'expo-router';

import { AppTabs } from '@/components/app-tabs';
import { useUnread, useUnreadPolling } from '@/features/notifications/unread-store';
import { t } from '@/i18n';

// Professional navigation keeps the dashboard, opportunities, requests, consultations and profile separate.
export default function ProfessionalTabs() {
  useUnreadPolling();
  const unread = useUnread();
  return (
    <AppTabs
      items={[
        { name: 'index', href: '/dashboard/professional', label: t('tab.home'), icon: 'home-outline' },
        { name: 'opportunities', href: '/dashboard/professional/opportunities' as Href, label: t('tab.opportunities'), icon: 'briefcase-outline' },
        { name: 'requests', href: '/dashboard/professional/requests', label: t('tab.requests'), icon: 'mail-outline', badge: unread },
        { name: 'consultations', href: '/dashboard/professional/consultations', label: t('tab.consultations'), icon: 'calendar-outline' },
        { name: 'account', href: '/dashboard/professional/account', label: t('tab.profile'), icon: 'person-circle-outline' },
      ]}
      hiddenItems={[{ name: 'insights', href: '/dashboard/professional/insights' as Href }]}
    />
  );
}
