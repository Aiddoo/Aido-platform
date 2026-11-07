import type { ErrorReporter } from '@src/core/ports/error-reporter';
import { toError } from '@src/shared/errors';
import { errorReporter } from '@src/shared/infra/error-reporter/global-error-reporter';
import { expoIdGenerator } from '@src/shared/infra/id-generator/expo-id-generator';
import { expoExternalLinkGateway } from '@src/shared/infra/linking/expo-linking.gateway';
import { widgetStorage } from '@src/shared/infra/storage/widget-storage';
import { AppState } from 'react-native';
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';

import {
  createWidgetNavigationRepository,
  type WidgetNavigationRepository,
} from '../apis/widget-navigation.repository';
import {
  ANDROID_WIDGET_DEFINITIONS,
  ANDROID_WIDGET_NAVIGATION_ACTION,
} from '../constants/widget.constants';
import { parseWidgetNavigationUri } from '../schemas/widget-navigation.schema';
import { renderStoredAndroidWidget } from './android-widgets.bridge';

type WidgetTaskDependencies = {
  navigationRepository: WidgetNavigationRepository;
  openApp: (uri: string) => Promise<unknown>;
  isAppActive: () => boolean;
  now: () => number;
  createCommandId: () => string;
  errorReporter: ErrorReporter;
  renderStoredWidget: typeof renderStoredAndroidWidget;
};

export function createAndroidWidgetTaskHandler({
  navigationRepository,
  openApp,
  isAppActive,
  now,
  createCommandId,
  errorReporter,
  renderStoredWidget,
}: WidgetTaskDependencies) {
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
          const stored = navigationRepository.store({
            id: createCommandId(),
            uri,
            userId,
            createdAt: now(),
          });
          if (!stored) {
            return;
          }
        } else if (destination.kind !== 'feed' || destination.action != null) {
          return;
        }

        if (!hasOwner || !isAppActive()) {
          await openApp(`${new URL(uri).protocol}//feed?date=today`);
        }
        return;
      }

      task.renderWidget(renderStoredWidget(task.widgetInfo));
    } catch (error) {
      try {
        errorReporter.captureException(toError(error), {
          feature: 'widget',
          method: 'handleWidgetTask',
        });
      } catch {
        return;
      }
    }
  };
}

export const androidWidgetTaskHandler = createAndroidWidgetTaskHandler({
  navigationRepository: createWidgetNavigationRepository(widgetStorage),
  openApp: expoExternalLinkGateway.open,
  isAppActive: () => AppState.currentState === 'active',
  now: Date.now,
  createCommandId: expoIdGenerator.create,
  errorReporter,
  renderStoredWidget: renderStoredAndroidWidget,
});
