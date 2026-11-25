import type { AuthStatus } from '@src/core/session/auth-status';
import { MINUTE_MS, SECOND_MS } from '@src/shared/constants/time-units';
import type { DateKey } from '@src/shared/date/date-key';
import { diffMs, type Instant, instantSchema } from '@src/shared/date/instant';
import { match } from 'ts-pattern';
import { z } from 'zod';

import { PushNotificationPolicy, pushNotificationSchema } from './push-notification.model';

/** 마케팅 푸시의 수신 거부 버튼. 앱이 서버 categoryId(MARKETING)에 등록하고, 누르면 이 id로 돌아온다 */
export const marketingOptOutActionSchema = z.literal('MARKETING_OPT_OUT');

/** 리마인드 알림의 완료·다시 알림 버튼. 앱이 서버 categoryId(TODO_REMINDER)에 등록하고, 누르면 이 id로 돌아온다 */
export const todoReminderActionSchema = z.enum(['complete', 'snooze']);
export type TodoReminderAction = z.infer<typeof todoReminderActionSchema>;

/** 사용자가 누른 푸시 하나. 처리가 끝날 때까지 진입 슬롯에 남는다 */
export const pushNotificationResponseSchema = z.object({
  /** 누른 알림과 동작으로 만든 응답 id. 같은 응답이 다시 오면 같은 id다 */
  id: z.string(),
  /** 누른 알림의 OS identifier. 처리한 버튼 응답의 알림을 지울 때 쓴다 */
  notificationIdentifier: z.string(),
  actionIdentifier: z.string(),
  notification: pushNotificationSchema,
  receivedAt: instantSchema,
  /** 시작할 때 읽은 마지막 응답이면 true. 꺼진 앱이 이 탭으로 켜졌다 */
  isLaunchResponse: z.boolean(),
  /** 응답을 받을 때 앱 상태와, 앞에 있었다면 앞으로 온 시각 */
  // 모델은 포트를 import하지 못해 포트의 AppLifecycleState 값을 다시 적는다. 어긋나면 mapper의 대입이 타입 오류로 알린다
  appState: z.enum(['active', 'inactive', 'background', 'unknown']),
  activeSince: instantSchema.nullable(),
});
export type PushNotificationResponse = z.infer<typeof pushNotificationResponseSchema>;

/** 리마인드 알림 버튼으로 할 일. 기본 탭과 같은 할 일 화면을 연 뒤에 한다 */
export type TodoReminderActionRequest =
  | { type: 'complete'; todoId: number; dateKey: DateKey | null }
  | { type: 'snooze'; todoId: number; notificationId: number };

/** 리마인드 알림 버튼을 누른 결과 */
export type TodoReminderActionOutcome = 'succeeded' | 'already_completed' | 'not_found' | 'failed';

/** 알림을 누를 때 앱 상태. `cold`는 꺼진 앱이 그 탭으로 켜졌다는 뜻이다 */
export type PushOpenAppState = 'cold' | 'background' | 'foreground';

/** 인증을 기다리는 응답을 보관하는 수명 */
const PENDING_RESPONSE_LIFETIME_MS = 10 * MINUTE_MS;
/** 응답 리스너와 복귀 이벤트의 순서가 플랫폼마다 달라, 앞으로 온 직후의 탭은 뒤에 있던 앱에서 누른 것으로 본다 */
const FOREGROUND_TAP_SETTLE_MS = SECOND_MS;

type PushNotificationResponseAction =
  | { type: 'optOut' }
  | { type: 'open' }
  | { type: 'defer'; reason: 'auth-resolving' | 'authentication-required' }
  | { type: 'drop'; reason: 'expired' };

function isExpired(response: PushNotificationResponse, now: Instant) {
  return diffMs(now, response.receivedAt) > PENDING_RESPONSE_LIFETIME_MS;
}

/** 사용자가 누른 푸시 */
export const PushNotificationResponsePolicy = {
  /** 공개 수신 거부 버튼을 누른 응답. 인증과 상관없이 따로 처리하고 다음 탭에 밀리지 않게 둔다 */
  isMarketingOptOut(response: PushNotificationResponse): boolean {
    return marketingOptOutActionSchema.safeParse(response.actionIdentifier).success;
  },

  /**
   * 리마인드 알림 버튼을 누른 응답이면 할 일. 할 일을 여는 리마인드 알림의 버튼만 받고,
   * 다시 알림은 누른 알림 id로 한 번만 예약하므로 서버 기록이 있는 알림만 받는다
   */
  findTodoReminderAction(response: PushNotificationResponse): TodoReminderActionRequest | null {
    const action = todoReminderActionSchema.safeParse(response.actionIdentifier);
    const { notification } = response;
    const { target } = notification;
    if (!action.success || notification.type !== 'TODO_REMINDER' || target.kind !== 'TODO') {
      return null;
    }
    return match(action.data)
      .returnType<TodoReminderActionRequest | null>()
      .with('complete', () => ({
        type: 'complete',
        todoId: target.todoId,
        dateKey: target.dateKey,
      }))
      .with('snooze', () =>
        PushNotificationPolicy.hasServerRecord(notification)
          ? { type: 'snooze', todoId: target.todoId, notificationId: notification.notificationId }
          : null,
      )
      .exhaustive();
  },

  /**
   * 처리가 끝나면 OS 알림 센터에서 그 알림을 지울 응답. 앱이 등록한 버튼(수신 거부·완료·다시 알림)만 지운다.
   * Android 알림 버튼은 알림을 닫지 않아, 남기면 다른 버튼을 다시 눌러 이미 끝낸 할 일 안내만 받는다.
   * 본문 탭과 모르는 동작은 OS가 하는 대로 둔다
   */
  shouldDismissNotification(response: PushNotificationResponse): boolean {
    return (
      this.isMarketingOptOut(response) ||
      todoReminderActionSchema.safeParse(response.actionIdentifier).success
    );
  },

  /** 눌린 응답을 지금 어떻게 할지. 공개 수신 거부 액션은 인증과 무관하게 처리한다. */
  getResponseAction(
    response: PushNotificationResponse,
    { authStatus, now }: { authStatus: AuthStatus; now: Instant },
  ): PushNotificationResponseAction {
    if (isExpired(response, now)) {
      return { type: 'drop', reason: 'expired' };
    }
    if (this.isMarketingOptOut(response)) {
      return { type: 'optOut' };
    }
    return match(authStatus)
      .returnType<PushNotificationResponseAction>()
      .with('loading', 'locked', () => ({ type: 'defer', reason: 'auth-resolving' }))
      .with('unauthenticated', () => ({ type: 'defer', reason: 'authentication-required' }))
      .with('authenticated', () => ({ type: 'open' }))
      .exhaustive();
  },

  getOpenAppState(response: PushNotificationResponse): PushOpenAppState {
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
  },
};
