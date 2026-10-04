import type { ErrorReporter } from '@src/core/ports/error-reporter';
import { toError } from '@src/shared/errors';
import { errorReporter } from '@src/shared/infra/error-reporter/global-error-reporter';
import { widgetNavigationStorage } from '@src/shared/infra/storage/widget-navigation-storage';
import { randomUUID } from 'expo-crypto';
import { openURL } from 'expo-linking';
import { AppState } from 'react-native';
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';

import { parseWidgetNavigationUri } from '../models/widget-navigation.model';
import {
  createWidgetNavigationRepository,
  type WidgetNavigationRepository,
} from '../services/widget-navigation.repository';
import {
  ANDROID_WIDGET_DEFINITIONS,
  ANDROID_WIDGET_NAVIGATION_ACTION,
} from './android-widget.constant';
import { renderStoredAndroidWidget } from './android-widgets.bridge';

type WidgetTaskDependencies = {
  navigationRepository: WidgetNavigationRepository;
  openApp: (uri: string) => Promise<unknown>;
  isAppActive: () => boolean;
  now: () => number;
  createCommandId: () => string;
  errorReporter: ErrorReporter;
};

export function createAndroidWidgetTaskHandler({
  navigationRepository,
  openApp,
  isAppActive,
  now,
  createCommandId,
  errorReporter,
}: WidgetTaskDependencies) {
  return async (task: WidgetTaskHandlerProps): Promise<void> => {
    if (!ANDROID_WIDGET_DEFINITIONS.some(({ name }) => name === task.widgetInfo.widgetName)) {
      return;
    }
    if (task.widgetAction === 'WIDGET_DELETED') return;

    try {
      if (
        task.widgetAction === 'WIDGET_CLICK' &&
        task.clickAction === ANDROID_WIDGET_NAVIGATION_ACTION
      ) {
        const uri = task.clickActionData?.uri;
        const userId = task.clickActionData?.userId;
        if (typeof uri !== 'string') return;
        const destination = parseWidgetNavigationUri(uri);
        if (!destination) return;
        const hasOwner = typeof userId === 'string' && userId.length > 0;

        if (hasOwner) {
          const stored = navigationRepository.store({
            id: createCommandId(),
            uri,
            userId,
            createdAt: now(),
          });
          if (!stored) return;
        } else if (destination.kind !== 'feed' || destination.action != null) {
          return;
        }

        if (!hasOwner || !isAppActive()) await openApp(uri);
        return;
      }

      task.renderWidget(renderStoredAndroidWidget(task.widgetInfo));
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
  navigationRepository: createWidgetNavigationRepository(widgetNavigationStorage),
  openApp: openURL,
  isAppActive: () => AppState.currentState === 'active',
  now: Date.now,
  createCommandId: randomUUID,
  errorReporter,
});
