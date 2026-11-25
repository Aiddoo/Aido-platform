import { renderAndroidWidget } from '@src/features/device/widget/components/widgets.android';
import { createWidgetNavigationRepository } from '@src/features/device/widget/repositories/widget-navigation.repository';
import { AndroidWidgetTaskService } from '@src/features/device/widget/services/android-widget-task.service';
import { AndroidWidgetService } from '@src/features/device/widget/services/android-widget.service';
import { getAppScheme } from '@src/shared/config/app-scheme';
import { getNowInstant, readLocalDateState } from '@src/shared/date/clock';
import { reactNativeAppLifecycleGateway } from '@src/shared/infra/app-lifecycle/react-native-app-lifecycle-gateway';
import { expoIdGenerator } from '@src/shared/infra/id-generator/expo-id-generator';
import { expoExternalLinkGateway } from '@src/shared/infra/linking/expo-external-link-gateway';
import { refreshAppTimezone } from '@src/shared/infra/localization/app-timezone';
import { getDeviceLanguage } from '@src/shared/infra/localization/device-locale';
import { widgetStorage } from '@src/shared/infra/storage/widget-storage';
import { registerWidgetTaskHandler as registerNativeWidgetTaskHandler } from 'react-native-android-widget';

// 위젯만 깨어난 프로세스에는 DIProvider가 없어 여기서 조립하고, 실패는 저장해 다음 앱 시작 때 `useWidgetSnapshotSync`가 보낸다
export function registerWidgetTaskHandler(): void {
  const isAppActive = () => reactNativeAppLifecycleGateway.getCurrentState() === 'active';
  const widgetService = new AndroidWidgetService({
    widgetStorage,
    readLocalDateKey: () => readLocalDateState().currentLocalDateKey,
    readDeviceLanguage: getDeviceLanguage,
    readAppScheme: getAppScheme,
    renderWidget: renderAndroidWidget,
  });
  const taskService = new AndroidWidgetTaskService({
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
      return widgetService.renderStoredWidget(widgetInfo);
    },
  });
  registerNativeWidgetTaskHandler(taskService.handleTask);
}
