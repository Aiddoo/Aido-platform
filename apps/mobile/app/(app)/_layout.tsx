import { useAuth } from '@src/bootstrap/providers/auth-provider';
import { useErrorReporter } from '@src/bootstrap/providers/di-context';
import { useTranslation } from '@src/shared/i18n';
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
  const { setStatus } = useAuth();
  const queryClient = useQueryClient();
  const errorReporter = useErrorReporter();

  const { t } = useTranslation();
  errorReporter.captureException(error, { feature: 'error_boundary' });

  const handleLogout = () => {
    setStatus('unauthenticated');
    queryClient.clear();
    resetAuthClient();
  };

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
