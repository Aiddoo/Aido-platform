export type NotificationAuthStatus = 'loading' | 'locked' | 'authenticated' | 'unauthenticated';

export type NotificationResponseDisposition =
  | { status: 'process' }
  | { status: 'defer'; reason: 'auth-resolving' }
  | { status: 'discard'; reason: 'authentication-required' };

interface NotificationResponseDispositionInput {
  authStatus: NotificationAuthStatus;
  actionIdentifier: string;
}

const PUBLIC_NOTIFICATION_ACTIONS: ReadonlySet<string> = new Set(['MARKETING_OPT_OUT']);

/**
 * 계정 데이터로 이동하는 알림은 인증 판정이 끝날 때까지 소비하지 않는다.
 * 공개 토큰만 사용하는 마케팅 수신 거부 액션은 인증과 무관하게 처리할 수 있다.
 */
export function getNotificationResponseDisposition({
  authStatus,
  actionIdentifier,
}: NotificationResponseDispositionInput): NotificationResponseDisposition {
  if (PUBLIC_NOTIFICATION_ACTIONS.has(actionIdentifier) || authStatus === 'authenticated') {
    return { status: 'process' };
  }

  if (authStatus === 'loading' || authStatus === 'locked') {
    return { status: 'defer', reason: 'auth-resolving' };
  }

  return { status: 'discard', reason: 'authentication-required' };
}
