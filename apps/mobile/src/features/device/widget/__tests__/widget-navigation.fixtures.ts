import { toInstant } from '@src/shared/date/instant';

import {
  type WidgetNavigationCommand,
  widgetNavigationCommandSchema,
} from '../domains/widget-navigation.model';

export function createWidgetNavigationCommand(
  overrides: Partial<WidgetNavigationCommand> = {},
): WidgetNavigationCommand {
  return widgetNavigationCommandSchema.parse({
    id: 'command-1',
    uri: 'aido://feed?date=today',
    userId: 'user-1',
    createdAt: toInstant('2026-11-05T00:00:00.000Z'),
    ...overrides,
  });
}
