import type { WidgetNavigationStorage } from '@src/features/widget/bridge/widget-navigation-storage';
import { noop } from 'es-toolkit';

export const widgetNavigationStorage: WidgetNavigationStorage = {
  getString: () => undefined,
  set: noop,
  delete: noop,
  subscribe: () => noop,
};
