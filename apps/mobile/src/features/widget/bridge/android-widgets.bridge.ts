import { widgetNavigationStorage } from '@src/shared/infra/storage/widget-navigation-storage';
import { readDeviceLocalDateState } from '@src/shared/utils/local-date-clock';
import Constants from 'expo-constants';
import { requestWidgetUpdate, type WidgetInfo } from 'react-native-android-widget';

import { createAndroidWidgetSnapshotRepository } from '../apis/android-widget-snapshot.repository';
import { createWidgetNavigationRepository } from '../apis/widget-navigation.repository';
import { toWidgetProps } from '../apis/widget-props.mapper';
import { renderAndroidWidget } from '../components/widgets.android';
import { type WidgetSnapshot, WidgetSnapshotPolicy } from '../domains/widget-snapshot.model';
import { createInitialWidgetProps } from '../utils/widget-initial-props';
import { ANDROID_WIDGET_DEFINITIONS } from './android-widget';
import type { WidgetBridge } from './widget-bridge';

const snapshotRepository = createAndroidWidgetSnapshotRepository(widgetNavigationStorage);
const navigationRepository = createWidgetNavigationRepository(widgetNavigationStorage);

function toStoredWidgetProps(snapshot: WidgetSnapshot, userId: string | null, appScheme: string) {
  const { day, renderState } = WidgetSnapshotPolicy.selectDayForOwner(
    snapshot,
    readDeviceLocalDateState().currentLocalDateKey,
    userId,
  );
  return toWidgetProps(day, renderState, appScheme);
}

export function renderStoredAndroidWidget(widgetInfo: WidgetInfo) {
  const definition = ANDROID_WIDGET_DEFINITIONS.find(
    (widget) => widget.name === widgetInfo.widgetName,
  );
  const snapshot = snapshotRepository.getSnapshot();
  const userId = snapshotRepository.getUserId();
  const scheme = Constants.expoConfig?.scheme;
  const appScheme = typeof scheme === 'string' ? scheme : (scheme?.[0] ?? 'aido');
  const props =
    snapshot == null
      ? { ...createInitialWidgetProps(), openAppUrl: `${appScheme}://feed?date=today` }
      : toStoredWidgetProps(snapshot, userId, appScheme);

  return renderAndroidWidget({ ...props, maxRows: definition?.maxRows ?? 0 }, widgetInfo, userId);
}

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
