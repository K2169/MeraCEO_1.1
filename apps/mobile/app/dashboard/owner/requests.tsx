import { RequestsScreen } from '@/features/requests/requests-screen';

// Owner's Requests tab.
export default function OwnerRequests() {
  return <RequestsScreen viewer="owner" section="requests" />;
}
