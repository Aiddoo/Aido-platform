import { getAppScheme } from '@src/shared/config/app-scheme';
import { readDeviceLocalDateState } from '@src/shared/date/clock';
import { getDeviceLanguage } from '@src/shared/infra/localization/device-locale';
import { widgetStorage } from '@src/shared/infra/storage/widget-storage';
import { requestWidgetUpdate } from 'react-native-android-widget';

import { createAndroidWidgetSnapshotRepository } from '../apis/android-widget-snapshot.repository';
import { createWidgetNavigationRepository } from '../apis/widget-navigation.repository';
import { renderAndroidWidget } from '../components/widgets.android';
import { ANDROID_WIDGET_DEFINITIONS } from '../constants/widget.constants';
import { WidgetSnapshotPolicy } from '../domains/widget-snapshot.model';
import { createStoredAndroidWidgetRenderer } from './stored-android-widget.renderer';
import type { WidgetBridge } from './widget-bridge';

const snapshotRepository = createAndroidWidgetSnapshotRepository(widgetStorage);
const navigationRepository = createWidgetNavigationRepository(widgetStorage);

export const renderStoredAndroidWidget = createStoredAndroidWidgetRenderer({
  snapshotRepository,
  readLocalDateKey: () => readDeviceLocalDateState().currentLocalDateKey,
  readDeviceLanguage: getDeviceLanguage,
  readAppScheme: getAppScheme,
  renderWidget: renderAndroidWidget,
});

export function createAndroidWidgetsBridge(): WidgetBridge {
  return {
    async writeSnapshot(snapshot, userId = null) {
      if (WidgetSnapshotPolicy.isLoggedOut(snapshot)) {
        const pendingCommand = navigationRepository.findPendingCommand();
        if (pendingCommand == null) {
          navigationRepository.removeCorrupted();
        } else {
          navigationRepository.clearIfCurrent(pendingCommand);
        }
      }
      snapshotRepository.writeSnapshot(snapshot, userId);
      await Promise.all(
        ANDROID_WIDGET_DEFINITIONS.map(({ name }) =>
          requestWidgetUpdate({ widgetName: name, renderWidget: renderStoredAndroidWidget }),
        ),
      );
    },
  };
}
