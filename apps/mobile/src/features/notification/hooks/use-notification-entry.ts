import { useAuth } from '@src/bootstrap/providers/auth-provider';
import { useNotificationEntryStore } from '@src/bootstrap/providers/di-context';
import { useSyncExternalStore } from 'react';

/** 눌린 푸시를 열기 전이라 첫 화면을 내보이면 안 되는지 */
export function useNotificationEntry() {
  const { status } = useAuth();
  const store = useNotificationEntryStore();
  const { pending } = useSyncExternalStore(store.subscribe, store.getState);

  return { isResolving: status === 'authenticated' && pending != null };
}
