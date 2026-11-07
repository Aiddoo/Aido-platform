import { useNotificationEntryStore } from '@src/bootstrap/providers/di-context';
import { useAuthStatus } from '@src/features/identity/auth/hooks/use-auth-status';
import { useSegments } from 'expo-router';
import { useSyncExternalStore } from 'react';

/** 앱 화면이 아직 정해지지 않은 자리. `(auth)`는 로그인 직후 Index로 넘어가기 전 한 커밋이다 */
const APP_ENTRY_SEGMENTS: ReadonlySet<string | undefined> = new Set([
  undefined,
  'loading',
  '(auth)',
]);

/**
 * 눌린 푸시를 첫 화면으로 열지 판단한다. Index가 목적지로 바로 가면 피드가 focus되지 않아
 * 피드 안내와 화면 기록이 생기지 않고, 뒤로 가기는 anchor인 피드다.
 */
export function useNotificationEntry() {
  const status = useAuthStatus();
  const store = useNotificationEntryStore();
  const { pending, ready } = useSyncExternalStore(store.subscribe, store.getState);
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
