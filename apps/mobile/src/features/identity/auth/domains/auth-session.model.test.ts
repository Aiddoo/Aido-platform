import {
  type AuthSessionEvent,
  type AuthSessionState,
  transitionAuthSession,
} from './auth-session.model';

const LOADING: AuthSessionState = { status: 'loading' };
const LOCKED: AuthSessionState = { status: 'locked' };
const AUTHENTICATED: AuthSessionState = { status: 'authenticated' };
const NO_SESSION: AuthSessionState = { status: 'unauthenticated', reason: 'none' };
const SIGNED_OUT: AuthSessionState = { status: 'unauthenticated', reason: 'signed-out' };
const EXPIRED: AuthSessionState = { status: 'unauthenticated', reason: 'expired' };
const BOOT_FAILED: AuthSessionState = { status: 'unauthenticated', reason: 'boot-failed' };

const ANY_STATE = [LOADING, LOCKED, AUTHENTICATED, NO_SESSION, SIGNED_OUT, EXPIRED, BOOT_FAILED];

describe('transitionAuthSession', () => {
  it.each<[string, AuthSessionState, AuthSessionEvent, AuthSessionState]>([
    [
      '토큰이 있으면 인증',
      LOADING,
      { type: 'bootResolved', status: 'authenticated' },
      AUTHENTICATED,
    ],
    [
      '토큰이 없으면 미인증',
      LOADING,
      { type: 'bootResolved', status: 'unauthenticated' },
      NO_SESSION,
    ],
    ['잠겼으면 잠금', LOADING, { type: 'bootResolved', status: 'locked' }, LOCKED],
    ['읽기 실패면 미인증', LOADING, { type: 'bootFailed' }, BOOT_FAILED],
    [
      '잠금이 풀려 토큰이 있으면 인증',
      LOCKED,
      { type: 'bootResolved', status: 'authenticated' },
      AUTHENTICATED,
    ],
    [
      '잠금이 풀려 토큰이 없으면 미인증',
      LOCKED,
      { type: 'bootResolved', status: 'unauthenticated' },
      NO_SESSION,
    ],
    ['아직 잠겼으면 잠금', LOCKED, { type: 'bootResolved', status: 'locked' }, LOCKED],
    ['재판정 실패면 미인증', LOCKED, { type: 'bootFailed' }, BOOT_FAILED],
    ['인증 중 만료', AUTHENTICATED, { type: 'sessionExpired' }, EXPIRED],
  ])('판정과 만료: %s', (_name, state, event, expected) => {
    // When
    const next = transitionAuthSession(state, event);

    // Then
    expect(next).toEqual(expected);
  });

  it.each(ANY_STATE)('어느 상태에서든 로그인하면 인증이 된다: %j', (state) => {
    // When
    const next = transitionAuthSession(state, { type: 'signedIn' });

    // Then
    expect(next).toEqual(AUTHENTICATED);
  });

  it.each(ANY_STATE)('어느 상태에서든 로그아웃하면 사용자가 나간 미인증이 된다: %j', (state) => {
    // When
    const next = transitionAuthSession(state, { type: 'signedOut' });

    // Then
    expect(next).toEqual(SIGNED_OUT);
  });

  it.each(
    [AUTHENTICATED, NO_SESSION, SIGNED_OUT, EXPIRED, BOOT_FAILED].flatMap((state) =>
      [
        { type: 'bootResolved', status: 'authenticated' } as const,
        { type: 'bootResolved', status: 'unauthenticated' } as const,
        { type: 'bootFailed' } as const,
      ].map((event): [AuthSessionState, AuthSessionEvent] => [state, event]),
    ),
  )('판정이 끝난 뒤 늦게 온 판정은 무시한다: %j %j', (state, event) => {
    // When
    const next = transitionAuthSession(state, event);

    // Then
    expect(next).toBe(state);
  });

  it.each([LOADING, LOCKED, NO_SESSION, SIGNED_OUT, EXPIRED, BOOT_FAILED])(
    '인증 중이 아니면 만료는 무시한다: %j',
    (state) => {
      // When
      const next = transitionAuthSession(state, { type: 'sessionExpired' });

      // Then
      expect(next).toBe(state);
    },
  );
});
