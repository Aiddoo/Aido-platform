import type { AppLifecycleState } from '@src/core/ports/app-lifecycle-gateway';
import type { AuthStatus } from '@src/core/session/auth-status';
import { MINUTE_MS, SECOND_MS } from '@src/shared/constants/time-units';
import type { DateKey } from '@src/shared/date/date-key';
import { diffMs, type Instant } from '@src/shared/date/instant';
import { takeRight, without } from 'es-toolkit';
import { match } from 'ts-pattern';
import { z } from 'zod';

import { type PushNotification, PushNotificationPolicy } from './push-notification.model';

/** 마케팅 푸시의 수신 거부 버튼. 앱이 서버 categoryId(MARKETING)에 등록하고, 누르면 이 id로 돌아온다 */
export const marketingOptOutActionSchema = z.literal('MARKETING_OPT_OUT');

/** 리마인드 알림의 완료·다시 알림 버튼. 앱이 서버 categoryId(TODO_REMINDER)에 등록하고, 누르면 이 id로 돌아온다 */
export const todoReminderActionSchema = z.enum(['complete', 'snooze']);
export type TodoReminderAction = z.infer<typeof todoReminderActionSchema>;

/** 리마인드 알림 버튼으로 할 일. 기본 탭과 같은 할 일 화면을 연 뒤에 한다 */
export type TodoReminderActionRequest =
  | { type: 'complete'; todoId: number; dateKey: DateKey | null }
  | { type: 'snooze'; todoId: number; notificationId: number };

/** 리마인드 알림 버튼을 누른 결과 */
export type TodoReminderActionOutcome = 'succeeded' | 'already_completed' | 'not_found' | 'failed';

/** 알림을 누를 때 앱 상태. `cold`는 꺼진 앱이 그 탭으로 켜졌다는 뜻이다 */
export type PushOpenAppState = 'cold' | 'background' | 'foreground';

/** 사용자가 누른 푸시 하나. 처리가 끝날 때까지 진입 슬롯에 남는다 */
export interface PushNotificationResponse {
  /** 누른 알림과 동작으로 만든 응답 id(`toPushNotificationResponseId`) */
  id: string;
  actionIdentifier: string;
  notification: PushNotification;
  receivedAt: Instant;
  /** 시작할 때 읽은 마지막 응답이면 true. 꺼진 앱이 이 탭으로 켜졌다 */
  isLaunchResponse: boolean;
  /** 응답을 받을 때 앱 상태와, 앞에 있었다면 앞으로 온 시각 */
  appState: AppLifecycleState;
  activeSince: Instant | null;
}

/** 이미 처리한 응답 id. 최근 것만 남긴다 */
export type HandledResponseIds = readonly string[];

/** 인증을 기다리는 응답을 보관하는 수명 */
const PENDING_RESPONSE_LIFETIME_MS = 10 * MINUTE_MS;
/** 응답 리스너와 복귀 이벤트의 순서가 플랫폼마다 달라, 앞으로 온 직후의 탭은 뒤에 있던 앱에서 누른 것으로 본다 */
const FOREGROUND_TAP_SETTLE_MS = SECOND_MS;
/** 같은 응답이 다시 오는 경우(콜드 스타트의 마지막 응답과 리스너, 다시 그린 레이아웃)를 막기에 충분한 최근 기억 수 */
const HANDLED_RESPONSE_ID_LIMIT = 20;

type PushNotificationResponseAction =
  | { type: 'optOut' }
  | { type: 'open' }
  | { type: 'defer'; reason: 'auth-resolving' | 'authentication-required' }
  | { type: 'drop'; reason: 'expired' };

/** 공개 수신 거부 버튼을 누른 응답. 인증과 상관없이 따로 처리하고 다음 탭에 밀리지 않게 둔다 */
function isMarketingOptOut(response: PushNotificationResponse) {
  return marketingOptOutActionSchema.safeParse(response.actionIdentifier).success;
}

/**
 * 리마인드 알림 버튼을 누른 응답이면 할 일. 할 일을 여는 리마인드 알림의 버튼만 받고,
 * 다시 알림은 누른 알림 id로 한 번만 예약하므로 서버 기록이 있는 알림만 받는다
 */
function getTodoReminderAction(
  response: PushNotificationResponse,
): TodoReminderActionRequest | null {
  const action = todoReminderActionSchema.safeParse(response.actionIdentifier);
  const { notification } = response;
  const { target } = notification;
  if (!action.success || notification.type !== 'TODO_REMINDER' || target.kind !== 'TODO') {
    return null;
  }
  return match(action.data)
    .returnType<TodoReminderActionRequest | null>()
    .with('complete', () => ({ type: 'complete', todoId: target.todoId, dateKey: target.dateKey }))
    .with('snooze', () =>
      PushNotificationPolicy.hasServerRecord(notification)
        ? { type: 'snooze', todoId: target.todoId, notificationId: notification.notificationId }
        : null,
    )
    .exhaustive();
}

function isExpired(response: PushNotificationResponse, now: Instant) {
  return diffMs(now, response.receivedAt) > PENDING_RESPONSE_LIFETIME_MS;
}

/** 눌린 응답을 지금 어떻게 할지. 공개 수신 거부 액션은 인증과 무관하게 처리한다. */
function getResponseAction(
  response: PushNotificationResponse,
  { authStatus, now }: { authStatus: AuthStatus; now: Instant },
): PushNotificationResponseAction {
  if (isExpired(response, now)) {
    return { type: 'drop', reason: 'expired' };
  }
  if (isMarketingOptOut(response)) {
    return { type: 'optOut' };
  }
  return match(authStatus)
    .returnType<PushNotificationResponseAction>()
    .with('loading', 'locked', () => ({ type: 'defer', reason: 'auth-resolving' }))
    .with('unauthenticated', () => ({ type: 'defer', reason: 'authentication-required' }))
    .with('authenticated', () => ({ type: 'open' }))
    .exhaustive();
}

function getOpenAppState(response: PushNotificationResponse): PushOpenAppState {
  if (response.isLaunchResponse) {
    return 'cold';
  }
  if (
    response.appState !== 'active' ||
    response.activeSince == null ||
    diffMs(response.receivedAt, response.activeSince) < FOREGROUND_TAP_SETTLE_MS
  ) {
    return 'background';
  }
  return 'foreground';
}

/**
 * 응답 하나의 id. Android 알림 버튼은 알림을 닫지 않아 버튼을 누른 뒤 본문을 또 누를 수 있으므로 알림 identifier에
 * 누른 동작(본문 탭도 expo-notifications 기본 동작 id가 있다)을 더한다. 같은 응답이 다시 오면(콜드 스타트의 마지막
 * 응답과 리스너) 같은 id라 한 번만 연다
 */
export function toPushNotificationResponseId(
  notificationIdentifier: string,
  actionIdentifier: string,
): string {
  return JSON.stringify([notificationIdentifier, actionIdentifier]);
}

/** 한 탭은 한 번만 연다 */
export function hasHandledResponse(handledResponseIds: HandledResponseIds, responseId: string) {
  return handledResponseIds.includes(responseId);
}

export function rememberHandledResponse(
  handledResponseIds: HandledResponseIds,
  responseId: string,
): HandledResponseIds {
  return takeRight(
    [...without(handledResponseIds, responseId), responseId],
    HANDLED_RESPONSE_ID_LIMIT,
  );
}

/** 사용자가 누른 푸시 */
export const PushNotificationResponsePolicy = {
  isMarketingOptOut,
  getResponseAction,
  getTodoReminderAction,
  getOpenAppState,
} as const;
