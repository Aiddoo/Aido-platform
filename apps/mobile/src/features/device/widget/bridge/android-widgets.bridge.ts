import { readDeviceLocalDateState } from '@src/shared/date/local-date-clock';
import { getDeviceLanguage } from '@src/shared/infra/localization/device-locale';
import { widgetNavigationStorage } from '@src/shared/infra/storage/widget-navigation-storage';
import Constants from 'expo-constants';
import { requestWidgetUpdate } from 'react-native-android-widget';

import { createAndroidWidgetSnapshotRepository } from '../apis/android-widget-snapshot.repository';
import { createWidgetNavigationRepository } from '../apis/widget-navigation.repository';
import { renderAndroidWidget } from '../components/widgets.android';
import { WidgetSnapshotPolicy } from '../domains/widget-snapshot.model';
import { ANDROID_WIDGET_DEFINITIONS } from './android-widget';
import { createStoredAndroidWidgetRenderer } from './stored-android-widget.renderer';
import type { WidgetBridge } from './widget-bridge';

const snapshotRepository = createAndroidWidgetSnapshotRepository(widgetNavigationStorage);
const navigationRepository = createWidgetNavigationRepository(widgetNavigationStorage);

export const renderStoredAndroidWidget = createStoredAndroidWidgetRenderer({
  snapshotRepository,
  readLocalDateKey: () => readDeviceLocalDateState().currentLocalDateKey,
  readDeviceLanguage: getDeviceLanguage,
  readAppScheme: () => {
    const scheme = Constants.expoConfig?.scheme;
    return typeof scheme === 'string' ? scheme : (scheme?.[0] ?? 'aido');
  },
  renderWidget: renderAndroidWidget,
});

export function createAndroidWidgetsBridge(): WidgetBridge {
  return {
    async writeSnapshot(snapshot, userId = null) {
      if (WidgetSnapshotPolicy.isLoggedOut(snapshot)) {
        navigationRepository.clearIfCurrent(navigationRepository.getPendingCommand());
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
