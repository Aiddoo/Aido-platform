import type { WidgetNavigationCommand } from '../schemas/widget-navigation.schema';

export const WIDGET_NAVIGATION_COMMAND_TTL_MS = 5 * 60_000;

function isFresh(command: Pick<WidgetNavigationCommand, 'createdAt'>, now: number): boolean {
  return (
    Number.isFinite(now) &&
    command.createdAt <= now &&
    now - command.createdAt < WIDGET_NAVIGATION_COMMAND_TTL_MS
  );
}

function isOwnedBy(command: Pick<WidgetNavigationCommand, 'userId'>, userId: string): boolean {
  return command.userId === userId;
}

function isSameCommand(first: WidgetNavigationCommand, second: WidgetNavigationCommand): boolean {
  return (
    first.id === second.id &&
    first.uri === second.uri &&
    first.userId === second.userId &&
    first.createdAt === second.createdAt
  );
}

export const WidgetNavigationPolicy = {
  isFresh,
  isOwnedBy,
  isSameCommand,
} as const;
