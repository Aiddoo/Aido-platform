import type { AppLifecycleState } from '@src/core/ports/app-lifecycle-gateway';
import type { AuthStatus } from '@src/core/session/auth-status';
import { MINUTE_MS, SECOND_MS } from '@src/shared/constants/time-units';
import { takeRight, without } from 'es-toolkit';
import { match } from 'ts-pattern';
import { z } from 'zod';

import type { PushNotificationPayload } from '../schemas/push-notification-payload.schema';

/** 마케팅 푸시의 수신 거부 버튼. 앱이 서버 categoryId(MARKETING)에 등록하고, 누르면 이 id로 돌아온다 */
export const marketingOptOutActionSchema = z.literal('MARKETING_OPT_OUT');

/** 알림을 누를 때 앱 상태. `cold`는 꺼진 앱이 그 탭으로 켜졌다는 뜻이다 */
export type PushOpenAppState = 'cold' | 'background' | 'foreground';

/** 사용자가 누른 푸시 하나. 처리가 끝날 때까지 진입 슬롯에 남는다 */
export interface PushNotificationResponse {
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

type PushNotificationResponseAction =
  | { type: 'optOut' }
  | { type: 'open' }
  | { type: 'defer'; reason: 'auth-resolving' | 'authentication-required' }
  | { type: 'drop'; reason: 'expired' };

/** 공개 수신 거부 버튼을 누른 응답. 인증과 상관없이 따로 처리하고 다음 탭에 밀리지 않게 둔다 */
function isMarketingOptOut(response: PushNotificationResponse) {
  return marketingOptOutActionSchema.safeParse(response.actionIdentifier).success;
}

function isExpired(response: PushNotificationResponse, now: number) {
  return now - response.receivedAt > PENDING_RESPONSE_LIFETIME_MS;
}

/** 눌린 응답을 지금 어떻게 할지. 공개 수신 거부 액션은 인증과 무관하게 처리한다. */
function getResponseAction(
  response: PushNotificationResponse,
  { authStatus, now }: { authStatus: AuthStatus; now: number },
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
    response.receivedAt - response.activeSince < FOREGROUND_TAP_SETTLE_MS
  ) {
    return 'background';
  }
  return 'foreground';
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
  getOpenAppState,
} as const;
