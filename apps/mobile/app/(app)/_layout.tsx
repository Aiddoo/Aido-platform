import { useAuth } from '@src/bootstrap/providers/auth-provider';
import { useErrorReporter } from '@src/bootstrap/providers/di-context';
import { isApiError } from '@src/shared/errors';
import { useTranslation } from '@src/shared/i18n';
import { HStack, Result, StyledSafeAreaView } from '@src/shared/ui';
import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { useResolveClassNames } from 'uniwind';

const AppLayout = () => {
  const { backgroundColor } = useResolveClassNames('bg-white');

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        animationTypeForReplace: 'push',
        contentStyle: { backgroundColor: backgroundColor as string },
      }}
    >
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="friends" />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="achievements" />
      <Stack.Screen name="reports" />
      <Stack.Screen name="suggestions" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="weather" />
      <Stack.Screen name="webview/[url]" />
      <Stack.Screen
        name="memo"
        options={{ animation: 'fade_from_bottom', animationDuration: 200 }}
      />
    </Stack>
  );
};

export default AppLayout;

interface ErrorBoundaryProps {
  error: Error;
  retry: () => void;
}

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const { status, setStatus } = useAuth();
  const errorReporter = useErrorReporter();
  const { t } = useTranslation();

  // 세션이 끝난 뒤 도착한 401은 장애가 아니라 인증 전환이다. 라우트 게이트가 곧 로그인 화면으로
  // 바꾸므로, 재시도 UI를 보여주지도 리포팅하지도 않는다.
  // (세션이 살아있는데 401이면 진짜 문제이므로 아래 에러 화면을 그대로 보여준다.)
  const isAuthTransition = isApiError(error) && error.status === 401 && status !== 'authenticated';

  // 렌더 중 부수효과 금지 — 리렌더마다 중복 캡처된다.
  useEffect(() => {
    if (isAuthTransition) {
      return;
    }

    errorReporter.captureException(error, { feature: 'error_boundary' });
  }, [error, errorReporter, isAuthTransition]);

  if (isAuthTransition) {
    return null;
  }

  // 캐시 정리는 상태 소유자(AuthProvider)가 미인증 전환 후에 수행한다.
  const handleLogout = () => setStatus('unauthenticated');

  return (
    <StyledSafeAreaView className="flex-1 bg-white">
      <Result
        title={t('appError.title')}
        description={t('appError.description')}
        button={
          <HStack gap={8}>
            <Result.Button onPress={retry}>{t('appError.retry')}</Result.Button>
            <Result.Button color="primary" onPress={handleLogout}>
              {t('appError.logout')}
            </Result.Button>
          </HStack>
        }
      />
    </StyledSafeAreaView>
  );
}
