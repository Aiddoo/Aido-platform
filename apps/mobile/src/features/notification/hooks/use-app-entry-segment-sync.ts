import { usePushNotificationEntryStore } from '@src/bootstrap/providers/di-context';
import { useSegments } from 'expo-router';
import { useLayoutEffect } from 'react';

/**
 * 앱 화면이 아직 정해지지 않은 자리. `(auth)`는 로그인 직후 Index로 넘어가기 전 한 커밋이다.
 * `auth`는 Android OAuth 콜백 화면이다. 곧 닫혀 로그인 화면으로 돌아가고 로그인은 Index가 이어 받는다
 */
const APP_ENTRY_SEGMENTS: ReadonlySet<string | undefined> = new Set([
  undefined,
  'loading',
  '(auth)',
  'auth',
]);

/**
 * 첫 세그먼트가 앱 입구인지 푸시 진입 슬롯에 적는다. 경로를 구독해 URL이 바뀔 때마다 다시 그려지므로
 * 레이아웃이 아니라 null 자식(`RouteWatchers`)이 부른다. 그리기 전에 적어 스플래시 판단이 한 프레임 늦지 않는다
 */
export function useAppEntrySegmentSync(): void {
  const store = usePushNotificationEntryStore();
  const [firstSegment] = useSegments();
  const isAtAppEntry = APP_ENTRY_SEGMENTS.has(firstSegment);

  useLayoutEffect(() => {
    store.markAppEntry(isAtAppEntry);
  }, [store, isAtAppEntry]);
}
