import { useAuth } from '@src/bootstrap/providers/auth-provider';
import { useErrorReporter } from '@src/bootstrap/providers/di-provider';
import { resetAuthClient } from '@src/shared/infra/http/auth-client';
import { HStack, Result, StyledSafeAreaView } from '@src/shared/ui';
import { useQueryClient } from '@tanstack/react-query';
import { Stack } from 'expo-router';
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
      <Stack.Screen name="todos" />
      <Stack.Screen name="friends" />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="achievements" />
      <Stack.Screen name="reports" />
      <Stack.Screen name="suggestions" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="webview/[url]" />
    </Stack>
  );
};

export default AppLayout;

interface ErrorBoundaryProps {
  error: Error;
  retry: () => void;
}

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const { setStatus } = useAuth();
  const queryClient = useQueryClient();
  const errorReporter = useErrorReporter();

  errorReporter.captureException(error, { feature: 'error_boundary' });

  const handleLogout = () => {
    setStatus('unauthenticated');
    queryClient.clear();
    resetAuthClient();
  };

  return (
    <StyledSafeAreaView className="flex-1 bg-white">
      <Result
        title="문제가 발생했어요"
        description="잠시 후 다시 시도해주세요"
        button={
          <HStack gap={8}>
            <Result.Button onPress={retry}>재시도</Result.Button>
            <Result.Button color="primary" onPress={handleLogout}>
              로그아웃
            </Result.Button>
          </HStack>
        }
      />
    </StyledSafeAreaView>
  );
}
