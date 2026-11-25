import { getNowInstant } from '@src/shared/date/clock';
import { reactNativeAppLifecycleGateway } from '@src/shared/infra/app-lifecycle/react-native-app-lifecycle-gateway';
import { expoIdGenerator } from '@src/shared/infra/id-generator/expo-id-generator';
import { expoExternalLinkGateway } from '@src/shared/infra/linking/expo-external-link-gateway';
import { refreshAppTimezone } from '@src/shared/infra/localization/app-timezone';
import { widgetStorage } from '@src/shared/infra/storage/widget-storage';
import { registerWidgetTaskHandler as registerNativeWidgetTaskHandler } from 'react-native-android-widget';

import { createWidgetNavigationRepository } from '../repositories/widget-navigation.repository';
import { createAndroidWidgetTaskHandler } from './android-widget-task-handler';
import { renderStoredAndroidWidget } from './android-widgets.bridge';

// 위젯만 깨어난 프로세스에는 DIProvider가 없어 실패를 저장해 두고 다음 앱 시작 때 `useWidgetSnapshotSync`가 꺼내 보낸다
export function registerWidgetTaskHandler(): void {
  const isAppActive = () => reactNativeAppLifecycleGateway.getCurrentState() === 'active';
  registerNativeWidgetTaskHandler(
    createAndroidWidgetTaskHandler({
      navigationRepository: createWidgetNavigationRepository(widgetStorage),
      openApp: expoExternalLinkGateway.open,
      isAppActive,
      now: getNowInstant,
      createCommandId: expoIdGenerator.create,
      failureStorage: widgetStorage,
      // 앱이 뒤에 있거나 위젯만 깨어난 프로세스는 LocalDateProvider가 시간대를 다시 정하지 않아 그리기 전에 정한다
      renderStoredWidget: (widgetInfo) => {
        if (!isAppActive()) {
          refreshAppTimezone();
        }
        return renderStoredAndroidWidget(widgetInfo);
      },
    }),
  );
}
