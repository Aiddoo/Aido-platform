import { toResolvedLanguage } from '@src/shared/preferences/language.preference';
import type { WidgetInfo } from 'react-native-android-widget';

import { toWidgetProps } from '../apis/widget-props.mapper';
import { ANDROID_WIDGET_DEFINITIONS } from '../constants/widget.constants';
import { WidgetSnapshotPolicy } from '../domains/widget-snapshot.model';
import type { WidgetProps } from '../schemas/widget-props.schema';
import type { WidgetSnapshot } from '../schemas/widget-snapshot.schema';
import { createInitialWidgetProps } from '../utils/widget-initial-props';

interface StoredAndroidWidgetRendererDependencies<Rendered> {
  snapshotRepository: {
    findSnapshot: () => WidgetSnapshot | null;
    findUserId: () => string | null;
  };
  readLocalDateKey: () => string;
  readDeviceLanguage: () => string | null;
  readAppScheme: () => string;
  renderWidget: (props: WidgetProps, widgetInfo: WidgetInfo, userId: string | null) => Rendered;
}

export function createStoredAndroidWidgetRenderer<Rendered>({
  snapshotRepository,
  readLocalDateKey,
  readDeviceLanguage,
  readAppScheme,
  renderWidget,
}: StoredAndroidWidgetRendererDependencies<Rendered>) {
  return (widgetInfo: WidgetInfo): Rendered => {
    const definition = ANDROID_WIDGET_DEFINITIONS.find(
      (widget) => widget.name === widgetInfo.widgetName,
    );
    const snapshot = snapshotRepository.findSnapshot();
    const userId = snapshotRepository.findUserId();
    const appScheme = readAppScheme();
    const props =
      snapshot == null
        ? {
            ...createInitialWidgetProps(toResolvedLanguage(readDeviceLanguage())),
            openAppUrl: `${appScheme}://feed?date=today`,
          }
        : toStoredWidgetProps(snapshot, userId, appScheme, readLocalDateKey());

    return renderWidget({ ...props, maxRows: definition?.maxRows ?? 0 }, widgetInfo, userId);
  };
}

function toStoredWidgetProps(
  snapshot: WidgetSnapshot,
  userId: string | null,
  appScheme: string,
  localDateKey: string,
) {
  const { day, renderState } = WidgetSnapshotPolicy.getDayForOwner(snapshot, localDateKey, userId);
  return toWidgetProps(day, renderState, appScheme);
}
