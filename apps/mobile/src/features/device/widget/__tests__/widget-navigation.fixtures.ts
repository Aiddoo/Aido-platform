import { defineFixture } from '@src/testing/fixture';

import { widgetNavigationCommandSchema } from '../domains/widget-navigation.model';

export const createWidgetNavigationCommand = defineFixture(widgetNavigationCommandSchema, {
  id: 'command-1',
  uri: 'aido://feed?date=today',
  userId: 'user-1',
  createdAt: '2026-11-05T00:00:00.000Z',
});
