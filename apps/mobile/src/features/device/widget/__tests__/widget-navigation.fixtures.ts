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
    createdAt: 1000,
    ...overrides,
  });
}
