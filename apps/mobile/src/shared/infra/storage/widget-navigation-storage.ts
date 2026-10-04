import type { WidgetNavigationStorage } from '@src/features/widget/bridge/widget-navigation-storage';

export const widgetNavigationStorage: WidgetNavigationStorage = {
  getString: () => undefined,
  set: () => {},
  delete: () => {},
  subscribe: () => () => {},
};
