import type { WidgetNavigationStorage } from '../bridge/widget-navigation-storage';
import {
  type WidgetNavigationCommand,
  widgetNavigationCommandSchema,
  WidgetNavigationPolicy,
} from '../models/widget-navigation.model';

export const WIDGET_NAVIGATION_COMMAND_KEY = 'aido_widget_pending_navigation_v1';

export interface WidgetNavigationRepository {
  getPendingCommand(): WidgetNavigationCommand | null;
  subscribe(listener: () => void): () => void;
  store(command: WidgetNavigationCommand): boolean;
  clearIfCurrent(command: WidgetNavigationCommand | null): boolean;
}

export function createWidgetNavigationRepository(
  storage: WidgetNavigationStorage,
): WidgetNavigationRepository {
  let cachedRaw: string | undefined;
  let cachedCommand: WidgetNavigationCommand | null = null;

  const getPendingCommand = (): WidgetNavigationCommand | null => {
    const raw = storage.getString(WIDGET_NAVIGATION_COMMAND_KEY);
    if (raw === cachedRaw) return cachedCommand;

    cachedRaw = raw;
    cachedCommand = null;
    if (raw === undefined) return null;

    try {
      const value: unknown = JSON.parse(raw);
      const result = widgetNavigationCommandSchema.safeParse(value);
      cachedCommand = result.success ? result.data : null;
    } catch {
      // 오래되거나 손상된 저장 값은 탐색 명령으로 취급하지 않는다.
    }
    return cachedCommand;
  };

  return {
    getPendingCommand,
    subscribe: (listener) => storage.subscribe(WIDGET_NAVIGATION_COMMAND_KEY, listener),
    store: (command) => {
      const result = widgetNavigationCommandSchema.safeParse(command);
      if (!result.success) return false;
      const current = getPendingCommand();
      if (current && current.createdAt > result.data.createdAt) return false;
      storage.set(WIDGET_NAVIGATION_COMMAND_KEY, JSON.stringify(result.data));
      return true;
    },
    clearIfCurrent: (command) => {
      const current = getPendingCommand();
      if (
        command === null
          ? current !== null || cachedRaw === undefined
          : current === null || !WidgetNavigationPolicy.isSameCommand(command, current)
      ) {
        return false;
      }
      storage.delete(WIDGET_NAVIGATION_COMMAND_KEY);
      return true;
    },
  };
}
