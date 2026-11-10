import { AppTabs } from '@/components/app-tabs';
import { useUnread, useUnreadPolling } from '@/features/notifications/unread-store';
import { t } from '@/i18n';

// Bottom tabs for business owners, following PRD section 07: discover experts, manage requests,
// consultations, and account.
export default function OwnerTabs() {
  useUnreadPolling();
  const unread = useUnread();
  return (
    <AppTabs
      items={[
        { name: 'index', href: '/dashboard/owner', label: t('tab.discover'), icon: 'compass-outline' },
        { name: 'requests', href: '/dashboard/owner/requests', label: t('tab.requests'), icon: 'paper-plane-outline', badge: unread },
        { name: 'consultations', href: '/dashboard/owner/consultations', label: t('tab.consultations'), icon: 'calendar-outline' },
        { name: 'account', href: '/dashboard/owner/account', label: t('tab.account'), icon: 'person-outline' },
      ]}
    />
  );
}
