import { type Href, usePathname, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { useSession } from '@/features/auth/session-provider';
import { api } from '@/lib/api';

// Mounted once at the root so every signed-in screen can receive foreground calls.
export function IncomingCallListener() {
  const { token } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const seen = useRef<string | null>(null);
  useEffect(() => {
    seen.current = null;
    if (!token) return;
    let live = true;
    let pending = false;
    const check = async () => {
      if (pending || AppState.currentState !== 'active' || pathname.startsWith('/call/')) return;
      pending = true;
      try {
        const { call } = await api.getIncomingCall(token);
        if (!live) return;
        if (!call) { seen.current = null; return; }
        if (seen.current === call.id) return;
        seen.current = call.id;
        router.push(`/call/${call.requestId}?callId=${call.id}` as Href);
      } catch { /* Retry on the next poll after a temporary network failure. */ }
      finally { pending = false; }
    };
    void check();
    const timer = setInterval(() => { void check(); }, 3000);
    const subscription = AppState.addEventListener('change', (state) => { if (state === 'active') void check(); });
    return () => { live = false; clearInterval(timer); subscription.remove(); };
  }, [pathname, router, token]);
  return null;
}
