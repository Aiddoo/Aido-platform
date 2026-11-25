import { MINUTE_MS } from '@src/shared/constants/time-units';
import { dateKeySchema } from '@src/shared/date/date-key';
import { diffMs, type Instant, instantSchema } from '@src/shared/date/instant';
import { z } from 'zod';

/** 위젯을 누른 뒤 앱이 이 시간 안에 열려야 저장된 목적지로 옮긴다 */
const WIDGET_NAVIGATION_COMMAND_TTL_MS = 5 * MINUTE_MS;

/** 피드 목적지의 칸. 모르는 칸(목적지 종류 포함)이 섞인 주소는 받지 않는다 */
export const widgetFeedParametersSchema = z.strictObject({
  date: z.union([dateKeySchema, z.literal('today')]),
  action: z.literal('add-todo').optional(),
});

/** 위젯이 여는 곳. URI 모양(외부 계약)은 `widgetNavigationUriSchema`가 읽는다 */
const widgetNavigationDestinationSchema = z.discriminatedUnion('kind', [
  widgetFeedParametersSchema.extend({ kind: z.literal('feed') }),
  z.object({ kind: z.literal('todo'), todoId: z.string() }),
]);
export type WidgetNavigationDestination = z.infer<typeof widgetNavigationDestinationSchema>;

/** 열 수 있는 URI인지는 저장 모양(`widgetNavigationCommandStorageSchema`)이 본다 */
export const widgetNavigationCommandSchema = z.object({
  id: z.string().min(1),
  uri: z.string(),
  userId: z.string().min(1),
  createdAt: instantSchema,
});
export type WidgetNavigationCommand = z.infer<typeof widgetNavigationCommandSchema>;

/** 만료를 먼저 보고(계정을 몰라도 지운다), 계정을 모르면 기다리고, 다른 계정의 명령이면 지운다 */
type WidgetCommandState = 'stale' | 'ownerUnknown' | 'foreign' | 'valid';

export const WidgetNavigationPolicy = {
  isFresh(command: WidgetNavigationCommand, now: Instant): boolean {
    const elapsedMs = diffMs(now, command.createdAt);
    return 0 <= elapsedMs && elapsedMs < WIDGET_NAVIGATION_COMMAND_TTL_MS;
  },

  isOwnedBy(command: WidgetNavigationCommand, userId: string): boolean {
    return command.userId === userId;
  },

  isSameCommand(first: WidgetNavigationCommand, second: WidgetNavigationCommand): boolean {
    return (
      first.id === second.id &&
      first.uri === second.uri &&
      first.userId === second.userId &&
      first.createdAt === second.createdAt
    );
  },

  getCommandState(
    command: WidgetNavigationCommand,
    { userId, now }: { userId: string | null; now: Instant },
  ): WidgetCommandState {
    if (!this.isFresh(command, now)) {
      return 'stale';
    }
    if (userId == null) {
      return 'ownerUnknown';
    }
    return this.isOwnedBy(command, userId) ? 'valid' : 'foreign';
  },

  /** 계정 정보가 없는 위젯(로그인 전 화면)의 클릭은 할 일이나 작성 동작 없이 피드만 연다 */
  canOpenWithoutOwner(destination: WidgetNavigationDestination): boolean {
    return destination.kind === 'feed' && destination.action == null;
  },

  /** Android 위젯이 명령을 저장한 뒤 앱을 깨우는 목적지. iOS 위젯 본문 링크와 모양이 같다 */
  isWakeDestination(destination: WidgetNavigationDestination): boolean {
    return (
      destination.kind === 'feed' && destination.date === 'today' && destination.action == null
    );
  },
};
