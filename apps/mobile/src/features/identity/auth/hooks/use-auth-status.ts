import { useAuthSessionStore } from '@src/bootstrap/providers/di-context';
import { useSyncExternalStore } from 'react';

export function useAuthStatus() {
  const store = useAuthSessionStore();
  return useSyncExternalStore(store.subscribe, () => store.getSnapshot().status);
}
