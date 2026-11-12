import { AuthGateLayout } from '@src/bootstrap/navigation/auth-gate-layout';
import { openSupportMail } from '@src/bootstrap/navigation/open-support-mail';
import { ROOT_ERROR_BOUNDARY_LOG_EVENT } from '@src/bootstrap/navigation/root-error-boundary-log-events';
import { AppProviders } from '@src/bootstrap/providers/app-providers';
import { compositionRoot } from '@src/bootstrap/providers/composition-root';
import { getErrorMessage } from '@src/shared/errors';
import { useTranslation } from '@src/shared/i18n';
import { reloadApp } from '@src/shared/infra/application/app-bundle';
import { createEnvironmentErrorReporter } from '@src/shared/infra/error-reporter/create-environment-error-reporter';
import { logger } from '@src/shared/infra/logger/global-logger';
import {
  initErrorReporting,
  wrapRootComponent,
} from '@src/shared/infra/observability/error-reporting';
import { ErrorIllustration } from '@src/shared/ui';

import '../global.css';
import '@src/shared/i18n/init';
import { noop } from 'es-toolkit';
import type { ErrorBoundaryProps } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';

initErrorReporting();

SplashScreen.preventAutoHideAsync().catch(noop);

// 루트 경계는 DI 밖에서 그려질 수 있어 같은 규칙(Sentry/console)으로 직접 만든다
const rootErrorReporter = createEnvironmentErrorReporter();

function AppBootstrapLayout() {
  return (
    <AppProviders root={compositionRoot}>
      <AuthGateLayout />
    </AppProviders>
  );
}

export default wrapRootComponent(AppBootstrapLayout);

function restartApp() {
  return reloadApp().catch((error: unknown) =>
    logger.warn(ROOT_ERROR_BOUNDARY_LOG_EVENT.RESTART_FAILED, { error: getErrorMessage(error) }),
  );
}

/** Provider·내비게이터가 없을 수 있어 RN 기본 컴포넌트와 디자인 토큰으로 `Result`·`QueryErrorFallback`과 같은 모양을 그리고, 문의는 화면 이동 대신 메일로 연다. 글자는 앱 `Text`처럼 OS 글꼴 배율을 따르지 않는다 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const { t } = useTranslation('common');

  useEffect(() => {
    SplashScreen.hideAsync().catch(noop);
    rootErrorReporter.captureException(error, { feature: 'root_error_boundary' });
  }, [error]);

  return (
    <View className="flex-1 items-center justify-center bg-white px-6" testID="root-error-fallback">
      <View accessible={false} importantForAccessibility="no" className="mb-4">
        <ErrorIllustration />
      </View>
      <Text
        allowFontScaling={false}
        className="text-b3 font-semibold text-gray-9 text-center"
        lineBreakStrategyIOS="hangul-word"
        textBreakStrategy="highQuality"
      >
        {t('errorBoundary.title')}
      </Text>
      <Text
        allowFontScaling={false}
        className="mt-1 text-b4 text-gray-6 text-center"
        lineBreakStrategyIOS="hangul-word"
        textBreakStrategy="highQuality"
      >
        {t('errorBoundary.description')}
      </Text>
      <Pressable
        accessibilityRole="button"
        className="mt-5 h-10 items-center justify-center rounded-xl bg-gray-9 px-4 dark:bg-gray-3"
        onPress={retry}
      >
        <Text
          allowFontScaling={false}
          className="text-b4 font-semibold text-white dark:text-gray-9"
        >
          {t('actions.retry')}
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        className="mt-2 h-10 items-center justify-center rounded-xl bg-gray-9/5 px-4 dark:bg-gray-9/20"
        onPress={restartApp}
      >
        <Text allowFontScaling={false} className="text-b4 font-semibold text-gray-9">
          {t('errorBoundary.restart')}
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        className="mt-2 h-8 items-center justify-center px-3"
        onPress={openSupportMail}
      >
        <Text allowFontScaling={false} className="text-e1 text-gray-6">
          {t('errorBoundary.inquiry')}
        </Text>
      </Pressable>
    </View>
  );
}
