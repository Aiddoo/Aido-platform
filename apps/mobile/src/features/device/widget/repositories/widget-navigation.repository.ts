import type { ObservableSyncStorage } from '@src/core/ports/observable-sync-storage';
import { diffMs } from '@src/shared/date/instant';
import { parseStoredJson } from '@src/shared/utils/parse-stored-json';

import {
  type WidgetNavigationCommand,
  WidgetNavigationPolicy,
} from '../domains/widget-navigation.model';
import { widgetNavigationCommandStorageSchema } from '../schemas/widget-navigation-command-storage.schema';

export const WIDGET_NAVIGATION_COMMAND_KEY = 'aido_widget_pending_navigation_v1';

export interface WidgetNavigationRepository {
  findPendingCommand(): WidgetNavigationCommand | null;
  subscribe(listener: () => void): () => void;
  save(command: WidgetNavigationCommand): boolean;
  clearIfCurrent(command: WidgetNavigationCommand): boolean;
  /** 읽을 수 없는 저장 값만 지운다. 유효한 명령은 건드리지 않는다 */
  removeCorrupted(): boolean;
}

export function createWidgetNavigationRepository(
  storage: ObservableSyncStorage,
): WidgetNavigationRepository {
  let cachedRaw: string | undefined;
  let cachedCommand: WidgetNavigationCommand | null = null;

  const findPendingCommand = (): WidgetNavigationCommand | null => {
    const raw = storage.get(WIDGET_NAVIGATION_COMMAND_KEY);
    if (raw === cachedRaw) {
      return cachedCommand;
    }

    cachedRaw = raw;
    cachedCommand = parseStoredJson(raw, widgetNavigationCommandStorageSchema);
    return cachedCommand;
  };

  return {
    findPendingCommand,
    subscribe: (listener) => storage.subscribe(WIDGET_NAVIGATION_COMMAND_KEY, listener),
    save: (command) => {
      const stored = widgetNavigationCommandStorageSchema.safeEncode(command);
      if (!stored.success) {
        return false;
      }
      const current = findPendingCommand();
      if (current != null && diffMs(current.createdAt, command.createdAt) > 0) {
        return false;
      }
      storage.set(WIDGET_NAVIGATION_COMMAND_KEY, JSON.stringify(stored.data));
      return true;
    },
    clearIfCurrent: (command) => {
      const current = findPendingCommand();
      if (current == null || !WidgetNavigationPolicy.isSameCommand(command, current)) {
        return false;
      }
      storage.remove(WIDGET_NAVIGATION_COMMAND_KEY);
      return true;
    },
    removeCorrupted: () => {
      if (findPendingCommand() != null || cachedRaw == null) {
        return false;
      }
      storage.remove(WIDGET_NAVIGATION_COMMAND_KEY);
      return true;
    },
  };
}
