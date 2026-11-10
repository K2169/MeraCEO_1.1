import { RequestsScreen } from '@/features/requests/requests-screen';

// Owner's Consultations tab: accepted requests.
export default function OwnerConsultations() {
  return <RequestsScreen viewer="owner" section="consultations" />;
}
