import type { SyncStorage } from '@src/core/ports/sync-storage';
import type { Instant } from '@src/shared/date/instant';
import { toError } from '@src/shared/errors';
import { writeStoredValue } from '@src/shared/storage/define-stored-value';
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';

import {
  ANDROID_WIDGET_DEFINITIONS,
  ANDROID_WIDGET_NAVIGATION_ACTION,
} from '../constants/widget.constants';
import {
  parseWidgetNavigationUri,
  WidgetNavigationPolicy,
} from '../domains/widget-navigation.model';
import type { WidgetNavigationRepository } from '../repositories/widget-navigation.repository';
import { widgetHeadlessFailureStoredValue } from '../schemas/widget-headless-failure-storage.schema';
import type { renderStoredAndroidWidget } from './android-widgets.bridge';

type WidgetTaskPorts = {
  navigationRepository: WidgetNavigationRepository;
  openApp: (uri: string) => Promise<unknown>;
  isAppActive: () => boolean;
  now: () => Instant;
  createCommandId: () => string;
  /** 앱 없이 깨어난 실패를 남겨 다음 앱 시작 때 보고한다 */
  failureStorage: SyncStorage;
  renderStoredWidget: typeof renderStoredAndroidWidget;
};

export function createAndroidWidgetTaskHandler({
  navigationRepository,
  openApp,
  isAppActive,
  now,
  createCommandId,
  failureStorage,
  renderStoredWidget,
}: WidgetTaskPorts) {
  return async (task: WidgetTaskHandlerProps): Promise<void> => {
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
        const uri = task.clickActionData?.uri;
        const userId = task.clickActionData?.userId;
        if (typeof uri !== 'string') {
          return;
        }
        const destination = parseWidgetNavigationUri(uri);
        if (!destination) {
          return;
        }
        const hasOwner = typeof userId === 'string' && userId.length > 0;

        if (hasOwner) {
          const stored = navigationRepository.save({
            id: createCommandId(),
            uri,
            userId,
            createdAt: now(),
          });
          if (!stored) {
            return;
          }
        } else if (!WidgetNavigationPolicy.canOpenWithoutOwner(destination)) {
          return;
        }

        // 켜져 있는 앱은 저장된 명령을 구독해 직접 옮긴다. 꺼져 있거나 계정이 없으면 피드로 앱을 연다
        if (!hasOwner || !isAppActive()) {
          await openApp(`${new URL(uri).protocol}//feed?date=today`);
        }
        return;
      }

      task.renderWidget(renderStoredWidget(task.widgetInfo));
    } catch (error) {
      const { name, message } = toError(error);
      writeStoredValue(failureStorage, widgetHeadlessFailureStoredValue, {
        method: 'handleWidgetTask',
        name,
        message,
      });
    }
  };
}
