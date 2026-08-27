import { type NotificationAction, type NotificationType } from '@aido/validators';
import type { Href } from 'expo-router';
import { P, match } from 'ts-pattern';

import type { NotificationRouting } from './notification-routing.model';

/**
 * 알림을 눌렀을 때 갈 곳.
 * 문자열 경로가 아니라 타입이 보장하는 목적지라, 라우터로 넘길 때 캐스트가 필요 없다.
 */
export type NotificationDestination =
  | { kind: 'none' }
  /** 앱 안의 화면. expo-router가 경로와 params를 컴파일 타임에 검증한다. */
  | { kind: 'route'; href: Href }
  /** 시스템 브라우저 — 앱을 벗어난다 */
  | { kind: 'browser'; url: string }
  /** 인앱 브라우저 */
  | { kind: 'webview'; url: string };

const NONE: NotificationDestination = { kind: 'none' };

/** 서버가 넣어 준 외부 URL은 웹 주소일 때만 연다. */
const toExternal = (kind: 'browser' | 'webview', url?: string): NotificationDestination =>
  url !== undefined && /^https?:\/\//.test(url) ? { kind, url } : NONE;

export interface NotificationDestinationInput {
  type: NotificationType;
  routing: NotificationRouting | null;
  action?: NotificationAction;
}

/**
 * 목록과 푸시가 공유하는 유일한 해석기.
 *
 * 앱 안으로 가는 길은 타입과 재료로만 정한다 — 서버가 만든 문자열을 그대로 라우터에 넘기지 않는다.
 * 밖으로 나가는 길(어드민이 넣는 외부 URL)만 action이 정한다.
 */
export function resolveNotificationDestination(
  input: NotificationDestinationInput,
): NotificationDestination {
  return match(input)
    .with({ action: { type: 'NONE' } }, () => NONE)
    .with({ action: { type: 'BROWSER' } }, ({ action }) => toExternal('browser', action.url))
    .with({ action: { type: 'WEBVIEW' } }, ({ action }) => toExternal('webview', action.url))
    .otherwise(({ routing }) => (routing === null ? NONE : toRoute(routing)));
}

/** 타입별로 필요한 재료가 모두 있을 때만 길이 열린다. */
function toRoute(routing: NotificationRouting): NotificationDestination {
  return match(routing)
    .with({ type: 'TODO_SHARED', commentId: P.string }, ({ todoId, commentId }) => ({
      kind: 'route' as const,
      href: {
        pathname: '/todo/[todoId]' as const,
        params: { todoId, comment: commentId },
      },
    }))
    .with({ type: 'TODO_SHARED' }, ({ todoId }) => ({
      kind: 'route' as const,
      href: { pathname: '/todo/[todoId]' as const, params: { todoId } },
    }))
    .with(
      {
        type: P.union(
          'FOLLOW_ACCEPTED',
          'CHEER_RECEIVED',
          'FRIEND_COMPLETED',
          'NUDGE_RECEIVED',
          'NUDGE_SUGGEST',
        ),
      },
      ({ friendId }) => ({
        kind: 'route' as const,
        href: { pathname: '/feed/friend/[friendId]' as const, params: { friendId } },
      }),
    )
    .with({ type: 'FOLLOW_NEW' }, () => ({
      kind: 'route' as const,
      href: { pathname: '/friends' as const, params: { view: 'receiver' } },
    }))
    .with({ type: 'WEEKLY_ACHIEVEMENT' }, () => ({
      kind: 'route' as const,
      href: '/achievements' as const,
    }))
    .with({ type: P.union('WEEKLY_REPORT', 'MONTHLY_REPORT') }, () => ({
      kind: 'route' as const,
      href: '/reports' as const,
    }))
    .with({ type: 'AI_SUGGESTION' }, () => ({
      kind: 'route' as const,
      href: '/suggestions' as const,
    }))
    .with({ type: 'FEED' }, () => ({ kind: 'route' as const, href: '/feed' as const }))
    .exhaustive();
}
