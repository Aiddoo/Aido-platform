import { useUserIdentity } from '@src/bootstrap/hooks/use-user-identity';
import { useWidgetAppEntry } from '@src/bootstrap/hooks/use-widget-app-entry';
import { useAuth } from '@src/bootstrap/providers/auth-provider';
import { useScreenTracking } from '@src/shared/hooks/use-screen-tracking';
import { useTheme } from '@src/shared/providers/theme-provider';
import { Stack } from 'expo-router';
import { useResolveClassNames } from 'uniwind';

export const AuthGateLayout = () => {
  const { status } = useAuth();
  const { resolvedTheme } = useTheme();
  useScreenTracking();
  useUserIdentity();
  useWidgetAppEntry();
  const { backgroundColor } = useResolveClassNames('bg-white');
  const isAuthenticated = status === 'authenticated';
  // `locked`(키체인 잠김)는 미인증이 아니라 "아직 모름"이다 — 로그인 화면으로 내려보내지 않는다.
  const isLoading = status === 'loading' || status === 'locked';

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
};
