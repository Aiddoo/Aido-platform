import { usePushNotificationEntryStore } from '@src/bootstrap/providers/di-context';
import { useAuthStatus } from '@src/features/identity/auth/hooks/use-auth-status';
import { useSegments } from 'expo-router';
import { useSyncExternalStore } from 'react';

/** 앱 화면이 아직 정해지지 않은 자리. `(auth)`는 로그인 직후 Index로 넘어가기 전 한 커밋이다 */
const APP_ENTRY_SEGMENTS: ReadonlySet<string | undefined> = new Set([
  undefined,
  'loading',
  '(auth)',
]);

/** Index가 목적지로 바로 가면 피드가 focus되지 않아 피드 안내와 화면 기록이 생기지 않는다 */
export function useNotificationEntry() {
  const status = useAuthStatus();
  const store = usePushNotificationEntryStore();
  const { pending, ready } = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const [firstSegment] = useSegments();
  const isEnteringApp = status === 'authenticated' && APP_ENTRY_SEGMENTS.has(firstSegment);

  return {
    isEnteringApp,
    /** 읽음 확인 중이라 첫 화면을 정하지 못했다 */
    isResolving: isEnteringApp && pending != null,
    /** 첫 화면은 정해졌고 Index가 그리로 가는 중이다 */
    isRedirecting: isEnteringApp && ready != null,
    href: ready?.destination.kind === 'route' ? ready.destination.href : null,
  };
}

/** 눌린 푸시가 열 곳을 정하는 중이거나 아직 열리지 않았다. 피드 자동 안내가 그 앞에 끼어들지 않게 한다 */
export function useHasPendingNotificationEntry() {
  const store = usePushNotificationEntryStore();

  return useSyncExternalStore(store.subscribe, () => {
    const { pending, ready } = store.getSnapshot();
    return pending != null || ready != null;
  });
}
