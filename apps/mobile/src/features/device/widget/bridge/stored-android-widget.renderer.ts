import type { DateKey } from '@src/shared/date/date-key';
import { toResolvedLanguage } from '@src/shared/preferences/language.preference';
import type { WidgetInfo } from 'react-native-android-widget';

import { toWidgetProps } from '../apis/widget-props.mapper';
import { ANDROID_WIDGET_DEFINITIONS } from '../constants/widget.constants';
import { WidgetSnapshotPolicy } from '../domains/widget-snapshot.model';
import type { WidgetProps } from '../schemas/widget-props-payload.schema';
import type { WidgetSnapshot } from '../schemas/widget-snapshot-storage.schema';
import { createInitialWidgetProps } from '../utils/widget-initial-props.view-model';

interface StoredAndroidWidgetRendererPorts<Rendered> {
  snapshotRepository: {
    findSnapshot: () => WidgetSnapshot | null;
    findUserId: () => string | null;
  };
  readLocalDateKey: () => DateKey;
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
}: StoredAndroidWidgetRendererPorts<Rendered>) {
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
            // 첫 동기화 전에는 앱 언어 설정을 알 수 없으므로 기기 언어(ko, 그 밖은 en)를 따른다
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
  localDateKey: DateKey,
) {
  const { day, renderState } = WidgetSnapshotPolicy.getDayForOwner(snapshot, localDateKey, userId);
  return toWidgetProps(day, renderState, appScheme);
}
