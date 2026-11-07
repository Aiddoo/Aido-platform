import { createEnvironmentErrorReporter } from '@src/shared/infra/error-reporter/create-environment-error-reporter';
import { expoIdGenerator } from '@src/shared/infra/id-generator/expo-id-generator';
import { expoExternalLinkGateway } from '@src/shared/infra/linking/expo-external-link-gateway';
import { initErrorReporting } from '@src/shared/infra/observability/error-reporting';
import { widgetStorage } from '@src/shared/infra/storage/widget-storage';
import { AppState } from 'react-native';
import { registerWidgetTaskHandler as registerNativeWidgetTaskHandler } from 'react-native-android-widget';

import { createWidgetNavigationRepository } from '../apis/widget-navigation.repository';
import { createAndroidWidgetTaskHandler } from './android-widget-task-handler';
import { renderStoredAndroidWidget } from './android-widgets.bridge';

/**
 * 위젯만 깨어난 프로세스에는 앱 트리(DIProvider)가 없어 전역 접근자가 콘솔로만 남긴다.
 * 이 진입점이 환경별 오류 보고기를 직접 조립한다.
 */
export function registerWidgetTaskHandler(): void {
  initErrorReporting();

  registerNativeWidgetTaskHandler(
    createAndroidWidgetTaskHandler({
      navigationRepository: createWidgetNavigationRepository(widgetStorage),
      openApp: expoExternalLinkGateway.open,
      isAppActive: () => AppState.currentState === 'active',
      now: Date.now,
      createCommandId: expoIdGenerator.create,
      errorReporter: createEnvironmentErrorReporter(),
      renderStoredWidget: renderStoredAndroidWidget,
    }),
  );
}
