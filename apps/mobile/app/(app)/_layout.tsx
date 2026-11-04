import { useAuth } from '@src/bootstrap/providers/auth-provider';
import { useErrorReporter } from '@src/bootstrap/providers/di-context';
import { ActivationPushPermissionDialog } from '@src/features/activation/components/activation-push-permission-dialog';
import { classifyBoundaryError } from '@src/shared/errors';
import { useTranslation } from '@src/shared/i18n';
import { HStack, Result, SHEET_ROUTE_SCREEN_OPTIONS, StyledSafeAreaView } from '@src/shared/ui';
import { useQueryErrorResetBoundary } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { useResolveClassNames } from 'uniwind';

const SHEET_ROUTES = [
  'todo/new',
  'todo/[todoId]/actions',
  'todo/[todoId]/edit',
  'todo/[todoId]/date',
  'todo/[todoId]/time',
  'todo/[todoId]/category',
  'todo/[todoId]/thanks',
  'todo/[todoId]/report',
  'todo/[todoId]/comments/[commentId]/report',
  'todo/[todoId]/sub-todos/new',
  'todo/[todoId]/sub-todos/[subTodoId]/actions',
  'todo/[todoId]/sub-todos/[subTodoId]/edit',
  'todo-categories/new',
  'todo-categories/[categoryId]/edit',
  'invite-welcome/[friendId]',
  'users/[userId]/block',
  'users/[userId]/report',
  'users/[userId]/nudge',
] as const;

export const unstable_settings = {
  anchor: '(tabs)',
};

function AppLayout() {
  const { backgroundColor } = useResolveClassNames('bg-white');

  return (
    <>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          animationTypeForReplace: 'push',
          contentStyle: { backgroundColor },
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="friends" />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="nudges" />
        <Stack.Screen name="achievements" />
        <Stack.Screen name="reports" />
        <Stack.Screen name="suggestions" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="weather" />
        <Stack.Screen
          name="memo"
          options={{ animation: 'fade_from_bottom', animationDuration: 200 }}
        />
        {/* 녹음을 실수로 잃지 않게 스와이프로 닫지 않는다. 시스템 모달은 쓰지 않는다(토스트·한도 안내가 그 뒤로 가려진다) */}
        <Stack.Screen
          name="voice-notes"
          options={{ animation: 'slide_from_bottom', gestureEnabled: false }}
        />
        {SHEET_ROUTES.map((name) => (
          <Stack.Screen key={name} name={name} options={SHEET_ROUTE_SCREEN_OPTIONS} />
        ))}
      </Stack>
      <ActivationPushPermissionDialog />
    </>
  );
}

export default AppLayout;

interface ErrorBoundaryProps {
  error: Error;
  retry: () => void;
}

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const { status, setStatus } = useAuth();
  const errorReporter = useErrorReporter();
  const { reset: resetQueryErrors } = useQueryErrorResetBoundary();
  const { t } = useTranslation();

  // 세션이 끝난 뒤 도착한 401만 조용히 로그인으로 넘긴다. 세션이 살아있는데 401이 여기까지
  // 새어왔다면 컨테인먼트 구멍이므로, null 빈 화면 대신 재시도 UI를 보여주고 리포트한다.
  const isAuthTransition =
    status !== 'authenticated' && classifyBoundaryError(error) === 'auth-transition';

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

  // 실패한 Suspense 조회는 리셋 없이 다시 마운트하면 재요청 없이 같은 오류를 다시 던진다
  const handleRetry = () => {
    resetQueryErrors();
    retry();
  };

  return (
    <StyledSafeAreaView className="flex-1 bg-white">
      <Result
        title={t('appError.title')}
        description={t('appError.description')}
        button={
          <HStack gap={8}>
            <Result.Button onPress={handleRetry}>{t('appError.retry')}</Result.Button>
            <Result.Button color="primary" onPress={handleLogout}>
              {t('appError.logout')}
            </Result.Button>
          </HStack>
        }
      />
    </StyledSafeAreaView>
  );
}
