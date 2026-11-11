import {
  NOTIFICATION_ACTION_TYPE,
  NOTIFICATION_ACTIVITY_KIND,
  NOTIFICATION_CATEGORY,
  NOTIFICATION_TYPE,
} from '@aido/api/vocabulary';
import type { AppLifecycleState } from '@src/core/ports/app-lifecycle-gateway';
import type { ForegroundPushPresentation } from '@src/core/ports/push-notification-gateway';
import type { AuthStatus } from '@src/core/session/auth-status';
import { MINUTE_MS, SECOND_MS } from '@src/shared/constants/time-units';
import { instantSchema } from '@src/shared/date/instant';
import { cursorPageSchema } from '@src/shared/domains/cursor-page.model';
import { entityIdSchema } from '@src/shared/domains/entity-id.model';
import { takeRight, without } from 'es-toolkit';
import { match } from 'ts-pattern';
import { z } from 'zod';

import {
  MARKETING_OPT_OUT_ACTION,
  NOTIFICATION_TYPE_TRAITS,
} from '../constants/notification.constants';
import type {
  NotificationNavigation,
  PushNotificationPayload,
} from '../schemas/push-notification-payload.schema';

const notificationTypeSchema = z.enum(NOTIFICATION_TYPE);
export type NotificationType = z.infer<typeof notificationTypeSchema>;

export const notificationCategorySchema = z.enum(NOTIFICATION_CATEGORY);

const notificationContextSchema = z.object({
  todoId: z.number().optional(),
  friendId: z.string().optional(),
  nudgeId: z.number().optional(),
  cheerId: z.number().optional(),
});
export type NotificationContext = z.infer<typeof notificationContextSchema>;

const notificationRoutingSchema = z.object({
  commentId: z.string().optional(),
  threadRootId: z.string().optional(),
  activityKind: z.enum(NOTIFICATION_ACTIVITY_KIND).optional(),
  senderId: z.string().optional(),
  senderName: z.string().optional(),
  todoOwnerId: z.string().optional(),
  todoDate: z.string().optional(),
});
export type NotificationRouting = z.infer<typeof notificationRoutingSchema>;

const notificationActionSchema = z.object({
  type: z.enum(NOTIFICATION_ACTION_TYPE),
  url: z.string().optional(),
});
export type NotificationAction = z.infer<typeof notificationActionSchema>;

/** 서버(1.13.0+)가 할 일 알림에 싣는 할 일 주인·날짜. 예전 알림에는 없다. */
const todoTargetShape = {
  todoOwnerId: z.string().min(1).optional().catch(undefined),
  todoDate: z.iso.date().optional().catch(undefined),
};

/** 구 필드(type·context·routing)로 목적지를 고를 때 타입마다 필요한 재료. 재료가 틀리면 이동하지 않는다 */
export const notificationDestinationRoutingSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('TODO_SHARED'),
    todoId: z.int().positive(),
    commentId: entityIdSchema.optional().catch(undefined),
    ...todoTargetShape,
  }),
  z.object({ type: z.literal('FOLLOW_NEW') }),
  z.object({ type: z.literal('FOLLOW_ACCEPTED'), friendId: z.string() }),
  z.object({ type: z.literal('CHEER_RECEIVED'), friendId: z.string() }),
  z.object({ type: z.literal('FRIEND_COMPLETED'), friendId: z.string() }),
  z.object({
    type: z.literal('NUDGE_RECEIVED'),
    friendId: z.string().min(1).optional(),
    todoId: z.int().positive().optional(),
    nudgeId: z.int().positive().optional(),
    ...todoTargetShape,
  }),
  z.object({
    type: z.literal('NUDGE_REPLIED'),
    nudgeId: z.int().positive().optional(),
  }),
  z.object({
    type: z.literal('NUDGE_THANKED'),
    nudgeId: z.int().positive().optional(),
  }),
  z.object({
    type: z.literal('TODO_REMINDER'),
    todoId: z.int().positive().optional(),
    ...todoTargetShape,
  }),
  z.object({ type: z.literal('WEATHER_MORNING') }),
  z.object({ type: z.literal('WEATHER_EVENING') }),
  z.object({ type: z.literal('NUDGE_SUGGEST'), friendId: z.string() }),
  z.object({ type: z.literal('WEEKLY_ACHIEVEMENT') }),
  z.object({ type: z.literal('WEEKLY_REPORT') }),
  z.object({ type: z.literal('MONTHLY_REPORT') }),
  z.object({ type: z.literal('AI_SUGGESTION') }),
  z.object({ type: z.literal('PREMIUM_GRANT_ENDING') }),
  z.object({ type: z.literal('INVITE_JOINED') }),
  z.object({ type: z.literal('INVITE_REWARDED') }),
  z.object({ type: z.literal('INVITE_PROGRESS') }),
  z.object({ type: z.literal('FEED') }),
]);
export type NotificationDestinationRouting = z.infer<typeof notificationDestinationRoutingSchema>;

const notificationSchema = z.object({
  id: z.number(),
  userId: z.string(),
  type: notificationTypeSchema,
  title: z.string(),
  body: z.string(),
  isRead: z.boolean(),
  routing: notificationRoutingSchema.optional(),
  context: notificationContextSchema.optional(),
  action: notificationActionSchema.optional(),
  // 서버(1.15.1+)가 푸시와 같은 계산으로 고른 목적지. 옛 항목·옛 서버에는 없어 구 필드로 간다
  navigation: z.custom<NotificationNavigation>().optional(),
  createdAt: instantSchema,
  readAt: instantSchema.nullable(),
});
export type Notification = z.infer<typeof notificationSchema>;

const notificationPageSchema = cursorPageSchema(notificationSchema, z.number());
export type NotificationPage = z.infer<typeof notificationPageSchema>;

/** 읽음 응답으로 본 소유. 네트워크·5xx·예산 초과는 모르는 것이라 막지 않는다 */
export type NotificationOwnership = 'ok' | 'foreign' | 'unknown';

/** 알림을 누를 때 앱 상태. `cold`는 꺼진 앱이 그 탭으로 켜졌다는 뜻이다 */
export type PushOpenAppState = 'cold' | 'background' | 'foreground';

export interface PendingNotificationResponse {
  id: string;
  actionIdentifier: string;
  data: PushNotificationPayload;
  receivedAt: number;
  /** 시작할 때 읽은 마지막 응답이면 true. 꺼진 앱이 이 탭으로 켜졌다 */
  isLaunchResponse: boolean;
  /** 응답을 받을 때 앱 상태와, 앞에 있었다면 앞으로 온 시각 */
  appState: AppLifecycleState;
  activeSince: number | null;
}

/** 이미 처리한 응답 id. 최근 것만 남긴다 */
export type HandledResponseIds = readonly string[];

/** 인증을 기다리는 응답을 보관하는 수명 */
const PENDING_RESPONSE_LIFETIME_MS = 10 * MINUTE_MS;
/** 응답 리스너와 복귀 이벤트의 순서가 플랫폼마다 달라, 앞으로 온 직후의 탭은 뒤에 있던 앱에서 누른 것으로 본다 */
const FOREGROUND_TAP_SETTLE_MS = SECOND_MS;
/** 같은 응답이 다시 오는 경우(콜드 스타트의 마지막 응답과 리스너, 다시 그린 레이아웃)를 막기에 충분한 최근 기억 수 */
const HANDLED_RESPONSE_ID_LIMIT = 20;

function isAiFeature(notification: Notification) {
  return NOTIFICATION_TYPE_TRAITS[notification.type].isAiFeature;
}

/** 응원 ID가 없는 이전 알림은 null이다. 보낸 사람 이름은 1.13.0 서버부터 실리므로 이전 알림에는 없을 수 있다 */
function findReceivedCheer(
  notification: Notification,
): { cheerId: number; senderId: string; senderName: string | null } | null {
  const cheerId = notification.context?.cheerId;
  const senderId = notification.context?.friendId;
  if (
    notification.type !== NOTIFICATION_TYPE.CHEER_RECEIVED ||
    cheerId == null ||
    senderId == null
  ) {
    return null;
  }
  return { cheerId, senderId, senderName: notification.routing?.senderName ?? null };
}

/** 알림 ID가 0이면 서버에 알림 기록이 없는 푸시라 읽음·열림을 서버에 묻지 않는다. 서비스는 ID만 받아 값으로 묻는다 */
export function isServerNotificationId(notificationId: number) {
  return notificationId > 0;
}

function hasServerRecord(payload: PushNotificationPayload) {
  return isServerNotificationId(payload.notificationId);
}

/** 받을 때 그 타입의 화면을 다시 받는지. 다시 받으면 보고 있는 화면에 새 내용이 바로 보인다 */
function isRefreshedOnReceipt(payload: Pick<PushNotificationPayload, 'type'>) {
  return payload.type != null && NOTIFICATION_TYPE_TRAITS[payload.type].invalidation != null;
}

/**
 * 앱이 앞에 있을 때 받은 알림을 보이는 방식. 알림함과 받은 타입의 화면은 받을 때 다시 받으므로, 그 화면을 보고 있으면
 * 배너·소리로 가리지 않고 알림 센터에만 남긴다. 모르는 타입과 다시 받지 않는 화면은 새 내용이 보이지 않아 배너로 알린다
 */
function getForegroundPresentation(
  payload: PushNotificationPayload,
  {
    isViewingInbox,
    isViewingDestination,
  }: { isViewingInbox: boolean; isViewingDestination: boolean },
): ForegroundPushPresentation {
  if (payload.type == null) {
    return 'banner';
  }
  return isViewingInbox || (isViewingDestination && isRefreshedOnReceipt(payload))
    ? 'quiet'
    : 'banner';
}

type NotificationResponseAction =
  | { type: 'optOut' }
  | { type: 'open' }
  | { type: 'defer'; reason: 'auth-resolving' | 'authentication-required' }
  | { type: 'drop'; reason: 'expired' };

function isExpiredResponse(response: Pick<PendingNotificationResponse, 'receivedAt'>, now: number) {
  return now - response.receivedAt > PENDING_RESPONSE_LIFETIME_MS;
}

/** 눌린 응답을 지금 어떻게 할지. 공개 수신 거부 액션은 인증과 무관하게 처리한다. */
function getResponseAction(
  response: PendingNotificationResponse,
  { authStatus, now }: { authStatus: AuthStatus; now: number },
): NotificationResponseAction {
  if (isExpiredResponse(response, now)) {
    return { type: 'drop', reason: 'expired' };
  }
  if (response.actionIdentifier === MARKETING_OPT_OUT_ACTION) {
    return { type: 'optOut' };
  }
  return match(authStatus)
    .returnType<NotificationResponseAction>()
    .with('loading', 'locked', () => ({ type: 'defer', reason: 'auth-resolving' }))
    .with('unauthenticated', () => ({ type: 'defer', reason: 'authentication-required' }))
    .with('authenticated', () => ({ type: 'open' }))
    .exhaustive();
}

function getOpenAppState(response: PendingNotificationResponse): PushOpenAppState {
  if (response.isLaunchResponse) {
    return 'cold';
  }
  if (
    response.appState !== 'active' ||
    response.activeSince == null ||
    response.receivedAt - response.activeSince < FOREGROUND_TAP_SETTLE_MS
  ) {
    return 'background';
  }
  return 'foreground';
}

function hasHandledResponse(handledResponseIds: HandledResponseIds, responseId: string) {
  return handledResponseIds.includes(responseId);
}

function rememberHandledResponse(
  handledResponseIds: HandledResponseIds,
  responseId: string,
): HandledResponseIds {
  return takeRight(
    [...without(handledResponseIds, responseId), responseId],
    HANDLED_RESPONSE_ID_LIMIT,
  );
}

/** 받은 알림(알림함 항목) */
export const NotificationPolicy = {
  isAiFeature,
  findReceivedCheer,
} as const;

/** 기기가 받은 푸시 */
export const PushNotificationPolicy = {
  hasServerRecord,
  getForegroundPresentation,
} as const;

/** 사용자가 누른 푸시 */
export const NotificationResponsePolicy = {
  getResponseAction,
  getOpenAppState,
} as const;

/** 한 탭은 한 번만 연다 */
export const HandledResponsePolicy = {
  hasHandledResponse,
  rememberHandledResponse,
} as const;
