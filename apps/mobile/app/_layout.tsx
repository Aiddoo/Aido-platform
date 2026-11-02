import { useAppFonts } from '@src/bootstrap/hooks/use-app-fonts';
import { useEncryptedStorageBootstrap } from '@src/bootstrap/hooks/use-encrypted-storage-bootstrap';
import { AuthGateLayout } from '@src/bootstrap/navigation/auth-gate-layout';
import { AppProviders } from '@src/bootstrap/providers/app-providers';
import { errorMessageOf } from '@src/shared/errors';
import { useTranslation } from '@src/shared/i18n';
import { logger } from '@src/shared/infra/logger/global-logger';
import { createEnvironmentErrorReporter } from '@src/shared/infra/observability-env';
import { initSentry, wrapRootComponent } from '@src/shared/infra/observability/sentry';
import { openSupportMail } from '@src/shared/ui';

import '../global.css';
import '@src/shared/i18n/init';
import { reloadAppAsync } from 'expo';
import type { ErrorBoundaryProps } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import * as Updates from 'expo-updates';
import { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';

initSentry();

SplashScreen.preventAutoHideAsync();

// 루트 경계는 DI 밖에서 그려질 수 있어 같은 규칙(Sentry/console)으로 직접 만든다
const rootErrorReporter = createEnvironmentErrorReporter();

function AppBootstrapLayout() {
  const fontsLoaded = useAppFonts();
  const encryptedStorageBootstrap = useEncryptedStorageBootstrap();
  const isReady = fontsLoaded && encryptedStorageBootstrap != null;

  if (!isReady) {
    return null;
  }

  return (
    <AppProviders encryptedStorageBootstrap={encryptedStorageBootstrap}>
      <AuthGateLayout />
    </AppProviders>
  );
}

export default wrapRootComponent(AppBootstrapLayout);

// OTA가 켜져 있으면 받아 둔 업데이트로, 아니면(개발 빌드) 같은 번들로 다시 띄운다
const restartApp = () =>
  (Updates.isEnabled ? Updates.reloadAsync() : reloadAppAsync()).catch((error: unknown) =>
    logger.warn('root_error_boundary.restart_failed', { error: errorMessageOf(error) }),
  );

/**
 * Provider 안에서 던져진 오류의 마지막 경계. Provider·내비게이터가 없을 수 있어
 * RN 기본 컴포넌트와 디자인 토큰만 쓰고, 문의는 화면 이동 대신 메일로 연다.
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const { t } = useTranslation('common');

  useEffect(() => {
    SplashScreen.hideAsync();
    rootErrorReporter.captureException(error, { feature: 'error_boundary' });
  }, [error]);

  return (
    <View className="flex-1 items-center justify-center bg-white px-6" testID="root-error-fallback">
      <Text className="text-b3 font-medium text-gray-6 text-center">
        {t('errorBoundary.title')}
      </Text>
      <Text className="mt-1 text-b4 text-gray-5 text-center">{t('errorBoundary.description')}</Text>
      <Pressable
        accessibilityRole="button"
        className="mt-6 h-10 items-center justify-center rounded-xl bg-gray-9 px-4 dark:bg-gray-3"
        onPress={retry}
      >
        <Text className="text-b4 font-semibold text-white dark:text-gray-9">
          {t('actions.retry')}
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        className="mt-2 h-10 items-center justify-center rounded-xl bg-gray-9/5 px-4 dark:bg-gray-9/20"
        onPress={restartApp}
      >
        <Text className="text-b4 font-semibold text-gray-9">{t('errorBoundary.restart')}</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        className="mt-2 h-8 items-center justify-center px-3"
        onPress={openSupportMail}
      >
        <Text className="text-e1 text-gray-6">{t('errorBoundary.inquiry')}</Text>
      </Pressable>
    </View>
  );
}
