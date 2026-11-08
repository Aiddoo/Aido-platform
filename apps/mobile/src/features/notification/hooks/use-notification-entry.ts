import { useNotificationEntryStore } from '@src/bootstrap/providers/di-context';
import { useAuthStatus } from '@src/features/identity/auth/hooks/use-auth-status';
import { useSegments } from 'expo-router';
import { useSyncExternalStore } from 'react';

const APP_ENTRY_SEGMENTS: ReadonlySet<string | undefined> = new Set([
  undefined,
  'loading',
  '(auth)',
]);

export function useNotificationEntry() {
  const status = useAuthStatus();
  const store = useNotificationEntryStore();
  const { pending, ready } = useSyncExternalStore(store.subscribe, store.getState);
  const [firstSegment] = useSegments();
  const isEnteringApp = status === 'authenticated' && APP_ENTRY_SEGMENTS.has(firstSegment);

  return {
    isEnteringApp,
    isResolving: isEnteringApp && pending != null,
    isRedirecting: isEnteringApp && ready != null,
    href: ready?.destination.kind === 'route' ? ready.destination.href : null,
  };
}

export function useHasPendingNotificationEntry() {
  const store = useNotificationEntryStore();

  return useSyncExternalStore(store.subscribe, () => {
    const { pending, ready } = store.getState();
    return pending != null || ready != null;
  });
}
