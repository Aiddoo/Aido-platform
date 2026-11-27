import type { SyncStorage } from '@src/core/ports/sync-storage';
import type { Instant } from '@src/shared/date/instant';
import { toError } from '@src/shared/errors';
import { writeStoredValue } from '@src/shared/storage/define-stored-value';
import type {
  WidgetInfo,
  WidgetRepresentation,
  WidgetTaskHandlerProps,
} from 'react-native-android-widget';

import { parseWidgetNavigation } from '../apis/widget-navigation.mapper';
import {
  ANDROID_WIDGET_DEFINITIONS,
  ANDROID_WIDGET_NAVIGATION_ACTION,
} from '../constants/widget.constants';
import { WidgetNavigationPolicy } from '../domains/widget-navigation.model';
import type { WidgetNavigationRepository } from '../repositories/widget-navigation.repository';
import { widgetHeadlessFailureStoredValue } from '../schemas/widget-headless-failure-storage.schema';

interface AndroidWidgetTaskPorts {
  navigationRepository: WidgetNavigationRepository;
  openApp: (uri: string) => Promise<unknown>;
  isAppActive: () => boolean;
  now: () => Instant;
  createCommandId: () => string;
  /** 앱 없이 깨어난 실패를 남겨 다음 앱 시작 때 보고한다 */
  failureStorage: SyncStorage;
  renderStoredWidget: (widgetInfo: WidgetInfo) => WidgetRepresentation;
}

/** Android가 앱 밖에서 부르는 위젯 작업(그리기·누름). 실패는 던지지 않고 저장소에 남긴다 */
export class AndroidWidgetTaskService {
  readonly #ports: AndroidWidgetTaskPorts;

  constructor(ports: AndroidWidgetTaskPorts) {
    this.#ports = ports;
  }

  handleTask = async (task: WidgetTaskHandlerProps): Promise<void> => {
    if (!ANDROID_WIDGET_DEFINITIONS.some(({ name }) => name === task.widgetInfo.widgetName)) {
      return;
    }
    if (task.widgetAction === 'WIDGET_DELETED') {
      return;
    }

    try {
      if (
        task.widgetAction === 'WIDGET_CLICK' &&
        task.clickAction === ANDROID_WIDGET_NAVIGATION_ACTION
      ) {
        await this.#openTappedDestination(task.clickActionData);
        return;
      }

      task.renderWidget(this.#ports.renderStoredWidget(task.widgetInfo));
    } catch (error) {
      const { name, message } = toError(error);
      writeStoredValue(this.#ports.failureStorage, widgetHeadlessFailureStoredValue, {
        method: 'handleWidgetTask',
        name,
        message,
      });
    }
  };

  #openTappedDestination = async (clickActionData: WidgetTaskHandlerProps['clickActionData']) => {
    const uri = clickActionData?.uri;
    const userId = clickActionData?.userId;
    if (typeof uri !== 'string') {
      return;
    }
    const destination = parseWidgetNavigation(uri);
    if (!destination) {
      return;
    }
    const hasOwner = typeof userId === 'string' && userId.length > 0;

    if (hasOwner) {
      const stored = this.#ports.navigationRepository.save({
        id: this.#ports.createCommandId(),
        uri,
        userId,
        createdAt: this.#ports.now(),
      });
      if (!stored) {
        return;
      }
    } else if (!WidgetNavigationPolicy.canOpenWithoutOwner(destination)) {
      return;
    }

    // 켜져 있는 앱은 저장된 명령을 구독해 직접 옮긴다. 꺼져 있거나 계정이 없으면 피드로 앱을 연다
    if (!hasOwner || !this.#ports.isAppActive()) {
      await this.#ports.openApp(`${new URL(uri).protocol}//feed?date=today`);
    }
  };
}
