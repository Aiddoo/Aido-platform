import { useClaimDeviceDataForUser } from '@src/bootstrap/hooks/use-claim-device-data-for-user';
import { useOrientationLock } from '@src/bootstrap/hooks/use-orientation-lock';
import { useSyncUserIdentity } from '@src/bootstrap/hooks/use-sync-user-identity';
import { useWidgetAppEntry } from '@src/bootstrap/hooks/use-widget-app-entry';
import { useAuthStatus } from '@src/features/identity/auth/hooks/use-auth-status';
import type { selectedMemoParamsSchema } from '@src/features/notes/memo/schemas/memo-params.schema';
import { NOTIFICATION_ENTRY_HOLD_MAX_MS } from '@src/features/notification/constants/notification.constants';
import { useAppEntrySegmentSync } from '@src/features/notification/hooks/use-app-entry-segment-sync';
import { usePushNotificationEntry } from '@src/features/notification/hooks/use-push-notification-entry';
import { usePushNotificationResponse } from '@src/features/notification/hooks/use-push-notification-response';
import type { feedParamsSchema } from '@src/features/planning/todo/schemas/feed-params.schema';
import { useInstallReferrerCapture } from '@src/features/social/invite/hooks/use-install-referrer-capture';
import { type PaneDetailScreen, useScreenTracking } from '@src/shared/hooks/use-screen-tracking';
import { useAppTheme } from '@src/shared/providers/theme-provider';
import type { ScreenName } from '@src/shared/utils/to-screen-name';
import { useIsRestoring } from '@tanstack/react-query';
import { noop } from 'es-toolkit';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useResolveClassNames } from 'uniwind';
import type { z } from 'zod';

const ROOT_STACK_ANIMATION_DURATION_MS = 250;

/** 첫 화면을 정하는 동안 스플래시 뒤로 지나가는 입구(Index·복원 대기·Android OAuth 콜백). 사용자가 보지 못해 조회로 세지 않는다 */
const ENTRY_REDIRECT_SCREENS: ReadonlySet<ScreenName> = new Set([
  '/',
  '/loading',
  '/auth/[provider]',
]);

/** 넓은 화면(iPad·폴더블)에서 목록 옆 칸에 여는 상세. 좁은 화면의 상세 route 이름으로 세 두 화면 크기의 조회 수를 견줄 수 있다 */
const PANE_DETAIL_SCREENS = [
  {
    listScreen: '/feed',
    param: 'todoId' satisfies keyof z.output<typeof feedParamsSchema>,
    detailScreen: '/todo/[todoId]',
  },
  {
    listScreen: '/memo',
    param: 'memoId' satisfies keyof z.output<typeof selectedMemoParamsSchema>,
    detailScreen: '/memo/[memoId]',
  },
] as const satisfies readonly PaneDetailScreen[];

export function AuthGateLayout() {
  const status = useAuthStatus();
  const isRestoring = useIsRestoring();
  const { resolvedTheme } = useAppTheme();
  const entry = usePushNotificationEntry();
  const { backgroundColor } = useResolveClassNames('bg-white');
  const isAuthenticated = status === 'authenticated';
  // `locked`(키체인 잠김)는 미인증이 아니라 "아직 모름"이다 — 로그인 화면으로 내려보내지 않는다.
  // 저장한 조회 캐시를 복원하는 동안에도 기다려야 화면의 Suspense 조회가 복원과 겹쳐 새로 요청하지 않는다.
  // 눌린 푸시의 읽음 확인 중에도 기다려야 Index가 목적지로 바로 가 피드가 먼저 focus되지 않는다.
  const isLoading = status === 'loading' || status === 'locked' || isRestoring || entry.isResolving;
  // 첫 화면이 정해질 때까지 스플래시를 둬 로딩 스피너가 한 번 깜빡이지 않게 한다. 잠긴 키체인은 기다림이 길어 스피너로 넘긴다
  const isEntryPending = entry.isResolving || entry.isRedirecting;
  const isSplashDone = status !== 'loading' && !isRestoring && !isEntryPending;

  useEffect(() => {
    if (!isSplashDone) {
      return;
    }
    // 첫 화면이 그려진 다음 프레임에 내려야 앞 화면이 비치지 않는다
    const frameId = requestAnimationFrame(() => SplashScreen.hideAsync().catch(noop));
    return () => cancelAnimationFrame(frameId);
  }, [isSplashDone]);

  useEffect(() => {
    if (!isEntryPending) {
      return;
    }
    const timer = setTimeout(
      () => SplashScreen.hideAsync().catch(noop),
      NOTIFICATION_ENTRY_HOLD_MAX_MS,
    );
    return () => clearTimeout(timer);
  }, [isEntryPending]);

  // Stack을 항상 렌더링해 navigationRef가 즉시 ready가 되도록 한다. cold start의 push 알림 탭에서 "Attempted to navigate before mounting the Root Layout" 크래시를 막는다
  return (
    <>
      <Stack
        screenOptions={{
          headerShown: false,
          statusBarStyle: resolvedTheme === 'dark' ? 'light' : 'dark',
          animation: 'fade',
          animationDuration: ROOT_STACK_ANIMATION_DURATION_MS,
          animationTypeForReplace: 'pop',
          contentStyle: { backgroundColor },
        }}
      >
        <Stack.Screen name="index" />
        {/* 초대 카드·코드 입력은 로그인 전에도 열린다. 로그인 뒤 다시 연 카드가 로그인 전 카드를 대신해 끝난 카드가 아래에 남지 않는다 */}
        <Stack.Screen name="invite" dangerouslySingular />

        <Stack.Protected guard={isLoading} redirectTo="/">
          <Stack.Screen name="loading" options={{ animation: 'none' }} />
        </Stack.Protected>

        <Stack.Protected guard={isAuthenticated} redirectTo="/">
          <Stack.Screen name="(app)" />
        </Stack.Protected>

        <Stack.Protected guard={!isAuthenticated && !isLoading} redirectTo="/">
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
      </Stack>
      <RouteWatchers />
      <WindowWatchers />
      <SessionWatchers />
      <AppEntryWatchers />
    </>
  );
}

/**
 * URL을 읽는 루트 훅은 레이아웃이 아니라 null을 그리는 이 형제에서 부른다.
 * `setParams`·이동마다 이것만 다시 그려지고 AuthGateLayout·Stack은 그대로다
 */
function RouteWatchers() {
  useScreenTracking({
    untrackedScreens: ENTRY_REDIRECT_SCREENS,
    paneDetailScreens: PANE_DETAIL_SCREENS,
  });
  useWidgetAppEntry();
  useAppEntrySegmentSync();

  return null;
}

// 아래 셋도 레이아웃이 아니라 null 형제에서 부른다. 효과 순서(창 → 내 정보 → 진입)는 레이아웃 몸체에서 부를 때와 같다

/** 창 크기를 구독해 Mac·iPad 창 크기를 바꾸는 동안 이것만 다시 그려진다 */
function WindowWatchers() {
  useOrientationLock();

  return null;
}

/** 내 정보(`data`·`dataUpdatedAt`)를 구독해 내 정보를 다시 받을 때 이것만 다시 그려진다 */
function SessionWatchers() {
  useSyncUserIdentity();
  useClaimDeviceDataForUser();

  return null;
}

/** 푸시 응답은 목적지를 창 크기로 고르므로 창 크기도 구독한다. 레이아웃은 결과(entry)만 읽는다 */
function AppEntryWatchers() {
  useInstallReferrerCapture();
  usePushNotificationResponse();

  return null;
}
