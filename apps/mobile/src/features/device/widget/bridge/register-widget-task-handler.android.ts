import { expoIdGenerator } from '@src/shared/infra/id-generator/expo-id-generator';
import { expoExternalLinkGateway } from '@src/shared/infra/linking/expo-external-link-gateway';
import { widgetStorage } from '@src/shared/infra/storage/widget-storage';
// oxlint-disable-next-line aido/app-state-location -- 1.15.2 전환 #1400
import { AppState } from 'react-native';
import { registerWidgetTaskHandler as registerNativeWidgetTaskHandler } from 'react-native-android-widget';

import { createWidgetNavigationRepository } from '../repositories/widget-navigation.repository';
import { createAndroidWidgetTaskHandler } from './android-widget-task-handler';
import { renderStoredAndroidWidget } from './android-widgets.bridge';

// 위젯만 깨어난 프로세스에는 DIProvider가 없어 실패를 저장해 두고 다음 앱 시작 때 `reportHeadlessFailure`가 보낸다
export function registerWidgetTaskHandler(): void {
  registerNativeWidgetTaskHandler(
    createAndroidWidgetTaskHandler({
      navigationRepository: createWidgetNavigationRepository(widgetStorage),
      openApp: expoExternalLinkGateway.open,
      isAppActive: () => AppState.currentState === 'active',
      now: Date.now,
      createCommandId: expoIdGenerator.create,
      failureStorage: widgetStorage,
      renderStoredWidget: renderStoredAndroidWidget,
    }),
  );
}
