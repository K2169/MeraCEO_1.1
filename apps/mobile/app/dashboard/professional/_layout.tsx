import { AppTabs } from '@/components/app-tabs';
import { useUnread, useUnreadPolling } from '@/features/notifications/unread-store';
import { t } from '@/i18n';

// Bottom tabs for professionals, following PRD section 08: opportunity feed, requests, consultations,
// and professional identity (profile).
export default function ProfessionalTabs() {
  useUnreadPolling();
  const unread = useUnread();
  return (
    <AppTabs
      items={[
        { name: 'index', href: '/dashboard/professional', label: t('tab.opportunities'), icon: 'briefcase-outline' },
        { name: 'requests', href: '/dashboard/professional/requests', label: t('tab.requests'), icon: 'mail-outline', badge: unread },
        { name: 'consultations', href: '/dashboard/professional/consultations', label: t('tab.consultations'), icon: 'calendar-outline' },
        { name: 'account', href: '/dashboard/professional/account', label: t('tab.profile'), icon: 'person-circle-outline' },
      ]}
    />
  );
}
