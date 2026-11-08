import { expoIdGenerator } from '@src/shared/infra/id-generator/expo-id-generator';
import { expoExternalLinkGateway } from '@src/shared/infra/linking/expo-external-link-gateway';
import { widgetStorage } from '@src/shared/infra/storage/widget-storage';
import { AppState } from 'react-native';
import { registerWidgetTaskHandler as registerNativeWidgetTaskHandler } from 'react-native-android-widget';

import { createWidgetHeadlessFailureRepository } from '../apis/widget-headless-failure.repository';
import { createWidgetNavigationRepository } from '../apis/widget-navigation.repository';
import { createAndroidWidgetTaskHandler } from './android-widget-task-handler';
import { renderStoredAndroidWidget } from './android-widgets.bridge';

/** 위젯만 깨어난 프로세스에는 앱 트리(DIProvider)가 없다 */
export function registerWidgetTaskHandler(): void {
  registerNativeWidgetTaskHandler(
    createAndroidWidgetTaskHandler({
      navigationRepository: createWidgetNavigationRepository(widgetStorage),
      openApp: expoExternalLinkGateway.open,
      isAppActive: () => AppState.currentState === 'active',
      now: Date.now,
      createCommandId: expoIdGenerator.create,
      failureRepository: createWidgetHeadlessFailureRepository(widgetStorage),
      renderStoredWidget: renderStoredAndroidWidget,
    }),
  );
}
