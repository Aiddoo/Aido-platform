import { widgetNavigationStorage } from '@src/shared/infra/storage/widget-navigation-storage';
import { formatDate } from '@src/shared/utils/date';
import Constants from 'expo-constants';
import { requestWidgetUpdate, type WidgetInfo } from 'react-native-android-widget';

import { WidgetSnapshotPolicy } from '../models/widget-snapshot.model';
import { createInitialWidgetProps } from '../presentations/widget-initial-props';
import { renderAndroidWidget } from '../presentations/widgets.android';
import { createAndroidWidgetSnapshotRepository } from '../services/android-widget-snapshot.repository';
import { createWidgetNavigationRepository } from '../services/widget-navigation.repository';
import { toWidgetProps } from '../services/widget-props.mapper';
import { ANDROID_WIDGET_DEFINITIONS } from './android-widget.constant';
import type { WidgetBridge } from './widget-bridge';

const snapshotRepository = createAndroidWidgetSnapshotRepository(widgetNavigationStorage);
const navigationRepository = createWidgetNavigationRepository(widgetNavigationStorage);

export function renderStoredAndroidWidget(widgetInfo: WidgetInfo) {
  const definition = ANDROID_WIDGET_DEFINITIONS.find(
    (widget) => widget.name === widgetInfo.widgetName,
  );
  const snapshot = snapshotRepository.getSnapshot();
  const userId = snapshotRepository.getUserId();
  const scheme = Constants.expoConfig?.scheme;
  const appScheme = typeof scheme === 'string' ? scheme : (scheme?.[0] ?? 'aido');
  const state = snapshot
    ? userId == null && snapshot.state !== 'loggedOut'
      ? 'stale'
      : WidgetSnapshotPolicy.renderState(snapshot, formatDate(new Date()))
    : null;
  const props =
    snapshot && state
      ? toWidgetProps(snapshot, state, appScheme)
      : { ...createInitialWidgetProps(), openAppUrl: `${appScheme}://feed?date=today` };

  return renderAndroidWidget({ ...props, maxRows: definition?.maxRows ?? 0 }, widgetInfo, userId);
}

export function createAndroidWidgetsBridge(): WidgetBridge {
  return {
    async writeSnapshot(snapshot, userId = null) {
      if (snapshot.state === 'loggedOut') {
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
