import { usePushNotificationEntryStore } from '@src/bootstrap/providers/di-context';
import { useSegments } from 'expo-router';
import { useLayoutEffect } from 'react';

/** `(auth)`는 로그인 직후 Index로 넘어가기 전 한 커밋이고, `auth`는 곧 닫히는 Android OAuth 콜백 화면이다 */
const APP_ENTRY_SEGMENTS: ReadonlySet<string | undefined> = new Set([
  undefined,
  'loading',
  '(auth)',
  'auth',
]);

/** URL마다 다시 그려지므로 레이아웃이 아니라 null 자식(`RouteWatchers`)이 부르고, 그리기 전에 적어 스플래시 판단이 늦지 않는다 */
export function useAppEntrySegmentSync(): void {
  const store = usePushNotificationEntryStore();
  const [firstSegment] = useSegments();
  const isAtAppEntry = APP_ENTRY_SEGMENTS.has(firstSegment);

  useLayoutEffect(() => {
    store.markAppEntry(isAtAppEntry);
  }, [store, isAtAppEntry]);
}
