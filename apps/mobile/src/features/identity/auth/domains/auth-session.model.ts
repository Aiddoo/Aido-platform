import type { ResolvedAuthStatus } from '@src/core/session/auth-status';
import { match, P } from 'ts-pattern';

/** 미인증인 이유. 초안을 지울지는 이 값으로 갈린다. 사용자가 나간 경우만 지운다 */
type SignedOutReason = 'none' | 'signed-out' | 'expired' | 'boot-failed';

export type AuthSessionState =
  | { status: 'loading' }
  | { status: 'locked' }
  | { status: 'authenticated' }
  | { status: 'unauthenticated'; reason: SignedOutReason };

export type AuthSessionEvent =
  | { type: 'bootResolved'; status: ResolvedAuthStatus }
  | { type: 'bootFailed' }
  | { type: 'signedIn' }
  | { type: 'signedOut' }
  | { type: 'sessionExpired' };

function isAuthBootPending({ status }: AuthSessionState) {
  return status === 'loading' || status === 'locked';
}

function resolveBootState(status: ResolvedAuthStatus): AuthSessionState {
  return match(status)
    .returnType<AuthSessionState>()
    .with('unauthenticated', () => ({ status: 'unauthenticated', reason: 'none' }))
    .with('authenticated', () => ({ status: 'authenticated' }))
    .with('locked', () => ({ status: 'locked' }))
    .exhaustive();
}

/** 늦게 끝난 부팅 판정이 로그아웃을 되돌리거나 로그인 화면의 401이 만료로 잡히지 않게 해당 상태에서만 반영한다 */
function transitionAuthSession(state: AuthSessionState, event: AuthSessionEvent): AuthSessionState {
  const pending = { status: P.union('loading', 'locked') };

  return match<[AuthSessionState, AuthSessionEvent], AuthSessionState>([state, event])
    .with([pending, { type: 'bootResolved', status: P.select() }], resolveBootState)
    .with([pending, { type: 'bootFailed' }], () => ({
      status: 'unauthenticated',
      reason: 'boot-failed',
    }))
    .with([P.any, { type: 'signedIn' }], () => ({ status: 'authenticated' }))
    .with([P.any, { type: 'signedOut' }], () => ({
      status: 'unauthenticated',
      reason: 'signed-out',
    }))
    .with([{ status: 'authenticated' }, { type: 'sessionExpired' }], () => ({
      status: 'unauthenticated',
      reason: 'expired',
    }))
    .otherwise(() => state);
}

export const AuthSessionPolicy = {
  isAuthBootPending,
  transitionAuthSession,
} as const;
