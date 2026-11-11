import { dateKeySchema } from '@src/shared/date/date-key';
import { z } from 'zod';

/** 위젯을 누른 뒤 앱이 이 시간 안에 열려야 저장된 목적지로 옮긴다 */
const WIDGET_NAVIGATION_COMMAND_TTL_MS = 5 * 60_000;

const widgetFeedParametersSchema = z.strictObject({
  date: z.union([dateKeySchema, z.literal('today')]),
  action: z.literal('add-todo').optional(),
});

const widgetNavigationDestinationSchema = z.discriminatedUnion('kind', [
  widgetFeedParametersSchema.extend({ kind: z.literal('feed') }),
  z.object({ kind: z.literal('todo'), todoId: z.string() }),
]);
export type WidgetNavigationDestination = z.infer<typeof widgetNavigationDestinationSchema>;

/** URI는 원시값으로만 해석한다. Router·현재 계정·시계는 호출자가 제공한다. */
export function parseWidgetNavigationUri(uri: string | null): WidgetNavigationDestination | null {
  if (!uri) {
    return null;
  }

  try {
    const parsed = new URL(uri);
    if (!['aido:', 'aido-dev:', 'aido-preview:'].includes(parsed.protocol)) {
      return null;
    }
    if (parsed.username || parsed.password || parsed.hash || parsed.port) {
      return null;
    }

    const path = `/${parsed.hostname}${parsed.pathname}`.replace(/\/$/, '');
    if (path === '/feed') {
      const parameterKeys = [...parsed.searchParams.keys()];
      if (new Set(parameterKeys).size !== parameterKeys.length) {
        return null;
      }
      const parameters = Object.fromEntries(parsed.searchParams);
      const result = widgetFeedParametersSchema.safeParse(parameters);
      return result.success ? { kind: 'feed', ...result.data } : null;
    }

    const todoId = /^\/todo\/([1-9]\d*)$/.exec(path)?.[1];
    return todoId && !parsed.search && Number.isSafeInteger(Number(todoId))
      ? { kind: 'todo', todoId }
      : null;
  } catch {
    return null;
  }
}

export const widgetNavigationCommandSchema = z.object({
  id: z.string().min(1),
  uri: z.string().refine((uri) => parseWidgetNavigationUri(uri) != null),
  userId: z.string().min(1),
  createdAt: z.number().int().nonnegative(),
});
export type WidgetNavigationCommand = z.infer<typeof widgetNavigationCommandSchema>;

function isFresh(command: WidgetNavigationCommand, now: number): boolean {
  return (
    Number.isFinite(now) &&
    command.createdAt <= now &&
    now - command.createdAt < WIDGET_NAVIGATION_COMMAND_TTL_MS
  );
}

function isOwnedBy(command: WidgetNavigationCommand, userId: string): boolean {
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

/** 만료를 먼저 보고(계정을 몰라도 지운다), 계정을 모르면 기다리고, 다른 계정의 명령이면 지운다 */
type WidgetCommandState = 'stale' | 'ownerUnknown' | 'foreign' | 'valid';

function getCommandState(
  command: WidgetNavigationCommand,
  { userId, now }: { userId: string | null; now: number },
): WidgetCommandState {
  if (!isFresh(command, now)) {
    return 'stale';
  }
  if (userId == null) {
    return 'ownerUnknown';
  }
  return isOwnedBy(command, userId) ? 'valid' : 'foreign';
}

/** 계정 정보가 없는 위젯(로그인 전 화면)의 클릭은 할 일이나 작성 동작 없이 피드만 연다 */
function canOpenWithoutOwner(destination: WidgetNavigationDestination): boolean {
  return destination.kind === 'feed' && destination.action == null;
}

export const WidgetNavigationPolicy = {
  isFresh,
  isOwnedBy,
  isSameCommand,
  getCommandState,
  canOpenWithoutOwner,
} as const;
