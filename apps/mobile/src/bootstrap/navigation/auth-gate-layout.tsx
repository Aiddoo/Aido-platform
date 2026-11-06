import { useUserIdentity } from '@src/bootstrap/hooks/use-user-identity';
import { useWidgetAppEntry } from '@src/bootstrap/hooks/use-widget-app-entry';
import { useAuth } from '@src/bootstrap/providers/auth-provider';
import { NOTIFICATION_ENTRY_HOLD_MAX_MS } from '@src/features/notification/constants/notification.constants';
import { useNotificationEntry } from '@src/features/notification/hooks/use-notification-entry';
import { useNotificationResponseObserver } from '@src/features/notification/hooks/use-notification-response-observer';
import { useInstallReferrerCapture } from '@src/features/social/invite/hooks/use-install-referrer-capture';
import { useInviteAppEntry } from '@src/features/social/invite/hooks/use-invite-app-entry';
import { useScreenTracking } from '@src/shared/hooks/use-screen-tracking';
import { useTheme } from '@src/shared/providers/theme-provider';
import { useIsRestoring } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useResolveClassNames } from 'uniwind';

export function AuthGateLayout() {
  const { status } = useAuth();
  const isRestoring = useIsRestoring();
  const { resolvedTheme } = useTheme();
  useScreenTracking();
  useUserIdentity();
  useWidgetAppEntry();
  useInstallReferrerCapture();
  useInviteAppEntry();
  useNotificationResponseObserver();
  const entry = useNotificationEntry();
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
    const frameId = requestAnimationFrame(() => SplashScreen.hideAsync());
    return () => cancelAnimationFrame(frameId);
  }, [isSplashDone]);

  useEffect(() => {
    if (!isEntryPending) {
      return;
    }
    const timer = setTimeout(() => SplashScreen.hideAsync(), NOTIFICATION_ENTRY_HOLD_MAX_MS);
    return () => clearTimeout(timer);
  }, [isEntryPending]);

  // Stack을 항상 렌더링하여 expo-router의 navigationRef가 즉시 ready 상태가 되도록 함.
  // 이를 통해 cold start 시 push notification 탭으로 인한
  // "Attempted to navigate before mounting the Root Layout" 크래시를 방지.
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        statusBarStyle: resolvedTheme === 'dark' ? 'light' : 'dark',
        animation: 'fade',
        animationDuration: 250,
        animationTypeForReplace: 'pop',
        contentStyle: { backgroundColor },
      }}
    >
      <Stack.Screen name="index" />
      {/* 초대 카드·코드 입력은 로그인 전에도 열린다 */}
      <Stack.Screen name="invite" />

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
  );
}
