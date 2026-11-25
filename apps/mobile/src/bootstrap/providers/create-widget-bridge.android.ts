import { renderAndroidWidget } from '@src/features/device/widget/components/widgets.android';
import { AndroidWidgetService } from '@src/features/device/widget/services/android-widget.service';
import type { WidgetBridge } from '@src/features/device/widget/services/widget-sync.service';
import { getAppScheme } from '@src/shared/config/app-scheme';
import { readLocalDateState } from '@src/shared/date/clock';
import { getDeviceLanguage } from '@src/shared/infra/localization/device-locale';
import { widgetStorage } from '@src/shared/infra/storage/widget-storage';

// 위젯만 깨어난 프로세스(`register-widget-task-handler.android.ts`)도 같은 저장소로 같은 서비스를 만든다
export function createWidgetBridge(): WidgetBridge {
  return new AndroidWidgetService({
    widgetStorage,
    readLocalDateKey: () => readLocalDateState().currentLocalDateKey,
    readDeviceLanguage: getDeviceLanguage,
    readAppScheme: getAppScheme,
    renderWidget: renderAndroidWidget,
  });
}
