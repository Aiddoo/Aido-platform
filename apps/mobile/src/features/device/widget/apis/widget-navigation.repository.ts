import type { ObservableSyncStorage } from '@src/core/ports/observable-sync-storage';
import { parseStoredJson } from '@src/shared/utils/parse-stored-json';

import { WidgetNavigationPolicy } from '../domains/widget-navigation.model';
import {
  type WidgetNavigationCommand,
  widgetNavigationCommandSchema,
} from '../schemas/widget-navigation.schema';

export const WIDGET_NAVIGATION_COMMAND_KEY = 'aido_widget_pending_navigation_v1';

export interface WidgetNavigationRepository {
  getPendingCommand(): WidgetNavigationCommand | null;
  subscribe(listener: () => void): () => void;
  save(command: WidgetNavigationCommand): boolean;
  clearIfCurrent(command: WidgetNavigationCommand | null): boolean;
}

export function createWidgetNavigationRepository(
  storage: ObservableSyncStorage,
): WidgetNavigationRepository {
  let cachedRaw: string | undefined;
  let cachedCommand: WidgetNavigationCommand | null = null;

  const getPendingCommand = (): WidgetNavigationCommand | null => {
    const raw = storage.get(WIDGET_NAVIGATION_COMMAND_KEY);
    if (raw === cachedRaw) {
      return cachedCommand;
    }

    cachedRaw = raw;
    cachedCommand = parseStoredJson(raw, widgetNavigationCommandSchema);
    return cachedCommand;
  };

  return {
    getPendingCommand,
    subscribe: (listener) => storage.subscribe(WIDGET_NAVIGATION_COMMAND_KEY, listener),
    save: (command) => {
      const result = widgetNavigationCommandSchema.safeParse(command);
      if (!result.success) {
        return false;
      }
      const current = getPendingCommand();
      if (current && current.createdAt > result.data.createdAt) {
        return false;
      }
      storage.set(WIDGET_NAVIGATION_COMMAND_KEY, JSON.stringify(result.data));
      return true;
    },
    clearIfCurrent: (command) => {
      const current = getPendingCommand();
      if (
        command == null
          ? current != null || cachedRaw == null
          : current == null || !WidgetNavigationPolicy.isSameCommand(command, current)
      ) {
        return false;
      }
      storage.remove(WIDGET_NAVIGATION_COMMAND_KEY);
      return true;
    },
  };
}
