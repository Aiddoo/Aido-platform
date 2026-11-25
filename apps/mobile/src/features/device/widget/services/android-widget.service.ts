import type { ObservableSyncStorage } from '@src/core/ports/observable-sync-storage';
import type { DateKey } from '@src/shared/date/date-key';
import { toResolvedLanguage } from '@src/shared/preferences/language.preference';
import {
  requestWidgetUpdate,
  type WidgetInfo,
  type WidgetRepresentation,
} from 'react-native-android-widget';

import {
  toInitialWidgetProps,
  toWidgetOpenAppUrl,
  toWidgetProps,
} from '../apis/widget-props.mapper';
import { ANDROID_WIDGET_DEFINITIONS } from '../constants/widget.constants';
import { WidgetSnapshotPolicy } from '../domains/widget-snapshot.model';
import {
  type AndroidWidgetSnapshotRepository,
  createAndroidWidgetSnapshotRepository,
} from '../repositories/android-widget-snapshot.repository';
import {
  createWidgetNavigationRepository,
  type WidgetNavigationRepository,
} from '../repositories/widget-navigation.repository';
import type { WidgetProps } from '../schemas/widget-props-payload.schema';
import type { StoredWidgetSnapshot } from '../schemas/widget-snapshot-storage.schema';
import { getInitialWidgetCopy } from '../utils/widget-initial-copy.view-model';
import type { WidgetBridge } from './widget-sync.service';

interface AndroidWidgetPorts {
  /** 앱과 위젯만 깨어난 프로세스가 함께 읽는 위젯 저장소 */
  widgetStorage: ObservableSyncStorage;
  readLocalDateKey: () => DateKey;
  readDeviceLanguage: () => string | null;
  readAppScheme: () => string;
  /** `renderAndroidWidget`. 조립이 넣어 테스트가 그리기 전 props를 본다 */
  renderWidget: (
    props: WidgetProps,
    widgetInfo: WidgetInfo,
    userId: string | null,
  ) => WidgetRepresentation;
}

/** Android 위젯의 저장된 스냅숏 쓰기와 그리기. 앱 조립과 위젯만 깨어난 프로세스(HeadlessJS)가 같은 저장소로 만든다 */
export class AndroidWidgetService implements WidgetBridge {
  readonly #snapshotRepository: AndroidWidgetSnapshotRepository;
  readonly #navigationRepository: WidgetNavigationRepository;
  readonly #readLocalDateKey: () => DateKey;
  readonly #readDeviceLanguage: () => string | null;
  readonly #readAppScheme: () => string;
  readonly #renderWidget: AndroidWidgetPorts['renderWidget'];

  constructor(ports: AndroidWidgetPorts) {
    this.#snapshotRepository = createAndroidWidgetSnapshotRepository(ports.widgetStorage);
    this.#navigationRepository = createWidgetNavigationRepository(ports.widgetStorage);
    this.#readLocalDateKey = ports.readLocalDateKey;
    this.#readDeviceLanguage = ports.readDeviceLanguage;
    this.#readAppScheme = ports.readAppScheme;
    this.#renderWidget = ports.renderWidget;
  }

  renderStoredWidget = (widgetInfo: WidgetInfo): WidgetRepresentation => {
    const definition = ANDROID_WIDGET_DEFINITIONS.find(
      (widget) => widget.name === widgetInfo.widgetName,
    );
    const snapshot = this.#snapshotRepository.findSnapshot();
    const userId = this.#snapshotRepository.findUserId();
    const appScheme = this.#readAppScheme();
    const props =
      snapshot == null
        ? {
            // 첫 동기화 전에는 앱 언어 설정을 알 수 없으므로 기기 언어(ko, 그 밖은 en)를 따른다
            ...toInitialWidgetProps(
              getInitialWidgetCopy(toResolvedLanguage(this.#readDeviceLanguage())),
            ),
            openAppUrl: toWidgetOpenAppUrl(appScheme),
          }
        : this.#toStoredWidgetProps(snapshot, userId, appScheme);

    return this.#renderWidget({ ...props, maxRows: definition?.maxRows ?? 0 }, widgetInfo, userId);
  };

  writeSnapshot = async (snapshot: StoredWidgetSnapshot, userId: string | null): Promise<void> => {
    if (WidgetSnapshotPolicy.isLoggedOut(snapshot)) {
      const pendingCommand = this.#navigationRepository.findPendingCommand();
      if (pendingCommand == null) {
        this.#navigationRepository.removeCorrupted();
      } else {
        this.#navigationRepository.clearIfCurrent(pendingCommand);
      }
    }
    this.#snapshotRepository.writeSnapshot(snapshot, userId);
    await Promise.all(
      ANDROID_WIDGET_DEFINITIONS.map(({ name }) =>
        requestWidgetUpdate({ widgetName: name, renderWidget: this.renderStoredWidget }),
      ),
    );
  };

  #toStoredWidgetProps = (
    snapshot: StoredWidgetSnapshot,
    userId: string | null,
    appScheme: string,
  ) => {
    const { day, renderState } = WidgetSnapshotPolicy.getDayForOwner(
      snapshot,
      this.#readLocalDateKey(),
      userId,
    );
    return toWidgetProps(day, renderState, appScheme);
  };
}
