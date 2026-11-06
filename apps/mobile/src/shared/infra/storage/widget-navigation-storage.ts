import type { WidgetNavigationStorage } from '@src/core/ports/widget-navigation-storage';
import { noop } from 'es-toolkit';

export const widgetNavigationStorage: WidgetNavigationStorage = {
  get: () => undefined,
  set: noop,
  remove: noop,
  subscribe: () => noop,
};
