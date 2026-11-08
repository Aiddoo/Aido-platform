import { WIDGET_NAVIGATION_COMMAND_TTL_MS } from '../constants/widget.constants';
import type {
  WidgetNavigationCommand,
  WidgetNavigationDestination,
} from '../schemas/widget-navigation.schema';

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

/**
 * 저장된 명령을 지금 열어도 되는지. 만료를 먼저 본다(계정을 몰라도 지운다).
 * 계정을 아직 모르면 기다리고, 다른 계정의 명령이면 지운다.
 */
type WidgetCommandState = 'stale' | 'ownerUnknown' | 'foreign' | 'valid';

function getCommandState(
  command: Pick<WidgetNavigationCommand, 'createdAt' | 'userId'>,
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
