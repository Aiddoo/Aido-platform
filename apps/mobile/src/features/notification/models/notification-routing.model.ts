import { NOTIFICATION_TYPE, type NotificationType, todoCommentIdSchema } from '@aido/validators';
import { z } from 'zod';

/**
 * 알림 타입별로 이동에 필요한 재료.
 *
 * 타입마다 무엇이 있어야 갈 수 있는지가 여기 한 곳에 적혀 있어, 재료가 없으면 목적지도 만들어지지 않는다.
 * 서버가 값을 어디에 싣든(REST는 metadata, 푸시는 routing) 이 모양으로 모아 파싱한다.
 */
const notificationRoutingSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal(NOTIFICATION_TYPE.TODO_SHARED),
    todoId: z.number(),
    commentId: todoCommentIdSchema.optional(),
  }),
  z.object({ type: z.literal(NOTIFICATION_TYPE.FOLLOW_NEW) }),
  z.object({ type: z.literal(NOTIFICATION_TYPE.FOLLOW_ACCEPTED), friendId: z.string() }),
  z.object({ type: z.literal(NOTIFICATION_TYPE.CHEER_RECEIVED), friendId: z.string() }),
  z.object({ type: z.literal(NOTIFICATION_TYPE.FRIEND_COMPLETED), friendId: z.string() }),
  z.object({ type: z.literal(NOTIFICATION_TYPE.NUDGE_RECEIVED), friendId: z.string() }),
  z.object({ type: z.literal(NOTIFICATION_TYPE.NUDGE_SUGGEST), friendId: z.string() }),
  z.object({ type: z.literal(NOTIFICATION_TYPE.WEEKLY_ACHIEVEMENT) }),
  z.object({ type: z.literal(NOTIFICATION_TYPE.WEEKLY_REPORT) }),
  z.object({ type: z.literal(NOTIFICATION_TYPE.MONTHLY_REPORT) }),
  z.object({ type: z.literal(NOTIFICATION_TYPE.AI_SUGGESTION) }),
  z.object({ type: z.literal('FEED') }),
]);

export type NotificationRouting = z.infer<typeof notificationRoutingSchema>;

/** 타입만으로 피드에 보내는 알림들 — 따로 재료가 없다. */
const FEED_TYPES: ReadonlySet<NotificationType> = new Set([
  NOTIFICATION_TYPE.TODO_REMINDER,
  NOTIFICATION_TYPE.DAILY_COMPLETE,
  NOTIFICATION_TYPE.MORNING_REMINDER,
  NOTIFICATION_TYPE.EVENING_REMINDER,
  NOTIFICATION_TYPE.WINBACK,
  NOTIFICATION_TYPE.SOCIAL_DIGEST,
  NOTIFICATION_TYPE.LUNCH_NUDGE,
  NOTIFICATION_TYPE.STREAK_AT_RISK,
  NOTIFICATION_TYPE.WEATHER_MORNING,
  NOTIFICATION_TYPE.WEATHER_EVENING,
]);

export interface NotificationRoutingSource {
  type: NotificationType;
  context?: Record<string, unknown>;
  /** 전용 컬럼이 없어 metadata(REST)나 routing(푸시)에 실려 오는 값 */
  extra?: Record<string, unknown>;
}

/**
 * 알림 한 건에서 이동 재료를 모은다.
 *
 * 재료가 모자란 옛 알림은 null이 되어 목록에는 남고 이동만 하지 않는다 —
 * 제목·본문 같은 공통 필드는 이 판정과 무관하게 이미 파싱돼 있다.
 */
export function toNotificationRouting(
  source: NotificationRoutingSource,
): NotificationRouting | null {
  const candidate = {
    type: FEED_TYPES.has(source.type) ? 'FEED' : source.type,
    ...source.context,
    ...source.extra,
  };
  const parsed = notificationRoutingSchema.safeParse(candidate);

  return parsed.success ? parsed.data : null;
}
