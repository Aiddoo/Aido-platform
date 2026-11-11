import { ErrorCode } from '@aido/api/errors';
import { resolveInitialAuthStatus } from '@src/bootstrap/auth/resolve-initial-auth-status';
import { useClaimDeviceDataForUser } from '@src/bootstrap/hooks/use-claim-device-data-for-user';
import { useSyncUserIdentity } from '@src/bootstrap/hooks/use-sync-user-identity';
import { ApiError } from '@src/core/errors/api-error';
import { err, ok } from '@src/core/errors/result';
import { emitSessionExpired } from '@src/core/events/session-expired';
import { subscribeTodoCreated } from '@src/core/events/todo-created';
import { createSessionEpoch, withSessionEpoch } from '@src/core/session/session-epoch';
import { createSessionManager } from '@src/core/session/session-manager';
import { createCoachmarkRepository } from '@src/features/device/coachmark/apis/coachmark.repository';
import { createCurrentUserDto } from '@src/features/identity/user/__tests__/user.fixtures';
import { UserService } from '@src/features/identity/user/apis/user.service';
import { USER_QUERY_KEYS } from '@src/features/identity/user/queries/user-query-keys';
import { useUpdateProfileMutationOptions } from '@src/features/identity/user/queries/user.mutations';
import { useGetMeQueryOptions } from '@src/features/identity/user/queries/user.queries';
import { useCreateTodoMutationOptions } from '@src/features/planning/composer/queries/todo-composer.mutations';
import { createTodoDto } from '@src/features/planning/todo/__tests__/todo.fixtures';
import { TodoService } from '@src/features/planning/todo/apis/todo.service';
import { pendingRedemptionStoredValue } from '@src/features/social/invite/schemas/pending-redemption-storage.schema';
import { getNowInstant } from '@src/shared/date/clock';
import { toInstant } from '@src/shared/date/instant';
import { createDraftKey } from '@src/shared/draft/draft.model';
import { NetworkError, ServerError, TimeoutError } from '@src/shared/errors';
import { createAuthClient } from '@src/shared/infra/http/auth-client';
import { KyHttpClient } from '@src/shared/infra/http/ky-client';
import { RETRY_MARKER_HEADER } from '@src/shared/infra/http/token-refresh-hook';
import { createTokenRefresher } from '@src/shared/infra/http/token-refresher';
import { readStoredValue, writeStoredValue } from '@src/shared/storage/define-stored-value';
import {
  createErrorReporterStub,
  createLoggerStub,
  createMemoryTokenStore,
  createHttpClientStub,
  createAnalyticsStub,
  createPendingResponse,
  createSocialAuthGatewayStub,
} from '@src/testing/core';
import { onlineManager, useMutation, useQuery } from '@tanstack/react-query';
import { act, waitFor } from '@testing-library/react-native';
import { z } from 'zod';

import { ACCOUNT_A_TOKENS, createAuthSession } from '../__tests__/auth-session.test-utils';
import {
  createAppleSignInSuccess,
  createAuthTokensDto,
  createDeleteAccountDto,
} from '../__tests__/auth.fixtures';
import { AuthService } from '../apis/auth.service';
import { LOGOUT_REQUEST_TIMEOUT_MS, LogOutDeviceService } from '../apis/log-out-device.service';
import { useAuthSession } from '../hooks/use-auth-session';
import { useAuthStatus } from '../hooks/use-auth-status';
import {
  useDeleteAccountMutationOptions,
  useEmailLoginMutationOptions,
  useExchangeCodeMutationOptions,
  useLogoutMutationOptions,
  useOpenAppleLoginMutationOptions,
  useVerifyEmailMutationOptions,
} from './auth.mutations';

const memoDraftKey = createDraftKey({
  ownerId: 'user-1',
  scope: 'memo',
  target: ['create'],
  schema: z.object({ content: z.string() }),
});
const OTHER_ACCOUNT_ID = 'clz7x5p8k0001qz0z8z8z8z8b';

// 로그아웃이 마운트된 위젯 조회의 캐시를 비우면 떨어져 나간 쿼리에 24시간 gc 타이머가 남아 Jest 종료를 붙잡는다
beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

describe('부팅', () => {
  it.each([
    ['토큰이 있으면', ACCOUNT_A_TOKENS, 'authenticated'],
    ['토큰이 없으면', undefined, 'unauthenticated'],
  ] as const)('%s 네트워크 없이 판정하고 토큰을 그대로 둔다', async (_name, tokens, expected) => {
    // Given
    const session = createAuthSession({ tokens });

    // When
    await session.renderSession(() => useAuthStatus(), expected);

    // Then
    expect(session.publicHttp.post).not.toHaveBeenCalled();
    expect(session.authHttp.post).not.toHaveBeenCalled();
    expect(session.authHttp.delete).not.toHaveBeenCalled();
    expect(session.requestRefresh).not.toHaveBeenCalled();
    await expect(session.tokenStore.getRefreshToken()).resolves.toBe(tokens?.refreshToken ?? null);
    await expect(session.tokenStore.getAccessToken()).resolves.toBe(tokens?.accessToken ?? null);
  });
});

describe('로그아웃', () => {
  afterEach(() => {
    onlineManager.setOnline(true);
  });

  const useLogoutProbe = () => ({
    status: useAuthStatus(),
    logout: useMutation(useLogoutMutationOptions()),
  });

  it.each([
    ['서버 성공', async () => ok({ message: '로그아웃되었습니다.' })],
    ['서버 거부', async () => err(new ApiError(ErrorCode.SESSION_0701, '세션 없음', 401))],
    ['서버 장애', () => Promise.reject(new ServerError(503))],
    ['시간 초과', () => Promise.reject(new TimeoutError())],
    ['연결 실패', () => Promise.reject(new NetworkError())],
  ])('온라인에서 %s여도 토큰, 상태, 초안을 정리한다', async (_name, respond) => {
    // Given
    const session = createAuthSession({ tokens: ACCOUNT_A_TOKENS });
    session.authHttp.delete.mockResolvedValue(ok({}));
    session.authHttp.post.mockImplementation(respond);
    const { result } = await session.renderSession(useLogoutProbe, 'authenticated');
    session.draftService.save(memoDraftKey, { content: '작성 중' });

    // When
    await act(async () => {
      await result.current.logout.mutateAsync();
    });

    // Then
    await waitFor(() => expect(result.current.status).toBe('unauthenticated'));
    await expect(session.tokenStore.getRefreshToken()).resolves.toBeNull();
    await expect(resolveInitialAuthStatus(session.tokenStore)).resolves.toBe('unauthenticated');
    expect(session.draftService.restore(memoDraftKey)).toEqual({ status: 'empty' });
  });

  it('온라인이면 푸시 토큰 해제와 서버 로그아웃을 요청한다', async () => {
    // Given
    const session = createAuthSession({ tokens: ACCOUNT_A_TOKENS });
    session.authHttp.delete.mockResolvedValue(ok({}));
    session.authHttp.post.mockResolvedValue(ok({ message: '로그아웃되었습니다.' }));
    const { result } = await session.renderSession(useLogoutProbe, 'authenticated');

    // When
    await act(async () => {
      await result.current.logout.mutateAsync();
    });

    // Then
    expect(session.authHttp.delete).toHaveBeenCalledWith(
      'v1/notifications/token',
      expect.objectContaining({ params: { deviceId: 'device-1' } }),
    );
    expect(session.authHttp.post).toHaveBeenCalledWith(
      'v1/auth/logout',
      undefined,
      expect.objectContaining({ timeout: expect.any(Number) }),
    );
  });

  it('오프라인이면 멈추지 않고 토큰, 상태, 초안을 정리한다', async () => {
    // Given
    const session = createAuthSession({ tokens: ACCOUNT_A_TOKENS });
    const { result } = await session.renderSession(useLogoutProbe, 'authenticated');
    session.draftService.save(memoDraftKey, { content: '작성 중' });
    onlineManager.setOnline(false);

    // When
    await act(async () => {
      await result.current.logout.mutateAsync();
    });

    // Then
    await waitFor(() => expect(result.current.status).toBe('unauthenticated'));
    await expect(session.tokenStore.getRefreshToken()).resolves.toBeNull();
    expect(session.draftService.restore(memoDraftKey)).toEqual({ status: 'empty' });
    expect(session.authHttp.post).not.toHaveBeenCalled();
  });
});

describe('오프라인 로그아웃 뒤 복귀', () => {
  const ROTATED_A = { accessToken: 'access-a2', refreshToken: 'refresh-a2' };

  afterEach(() => {
    onlineManager.setOnline(true);
  });

  function respondWithRotatedTokens() {
    return new Response(JSON.stringify({ data: ROTATED_A }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  async function logOutOffline() {
    const session = createAuthSession({ tokens: ACCOUNT_A_TOKENS });
    session.requestRefresh.mockImplementation(async () => respondWithRotatedTokens());
    session.publicHttp.post.mockImplementation(async (url) =>
      url === 'v1/auth/logout'
        ? ok({ message: '로그아웃되었습니다.' })
        : ok(createAuthTokensDto({ accessToken: 'access-b', refreshToken: 'refresh-b' })),
    );
    const rendered = await session.renderSession(
      () => ({
        status: useAuthStatus(),
        logout: useMutation(useLogoutMutationOptions()),
        login: useMutation(useEmailLoginMutationOptions()),
      }),
      'authenticated',
    );
    await act(async () => {
      onlineManager.setOnline(false);
      await rendered.result.current.logout.mutateAsync();
    });
    await waitFor(() => expect(rendered.result.current.status).toBe('unauthenticated'));
    return { session, ...rendered };
  }

  it('로그아웃하면 토큰은 지우고 해제할 세션만 기록한다', async () => {
    // When
    const { session } = await logOutOffline();

    // Then
    await expect(session.tokenStore.getRefreshToken()).resolves.toBeNull();
    await expect(session.tokenStore.getAccessToken()).resolves.toBeNull();
    await expect(session.pendingRevocation.find()).resolves.toMatchObject({
      refreshToken: ACCOUNT_A_TOKENS.refreshToken,
    });
    expect(session.requestRefresh).not.toHaveBeenCalled();
  });

  it('연결이 돌아오면 서버 세션을 풀고 기록을 지운다', async () => {
    // Given
    const { session } = await logOutOffline();

    // When
    await act(async () => {
      onlineManager.setOnline(true);
      await jest.advanceTimersByTimeAsync(0);
    });

    // Then
    await waitFor(() =>
      expect(session.publicHttp.post).toHaveBeenCalledWith(
        'v1/auth/logout',
        undefined,
        expect.objectContaining({
          headers: { Authorization: `Bearer ${ROTATED_A.accessToken}` },
        }),
      ),
    );
    expect(session.authHttp.post).not.toHaveBeenCalled();
    await act(async () => {
      await jest.advanceTimersByTimeAsync(0);
    });
    await expect(session.pendingRevocation.find()).resolves.toBeNull();
    await expect(session.tokenStore.getRefreshToken()).resolves.toBeNull();
  });

  it('복귀해도 세션을 되살리지 않고 로그아웃 상태를 유지한다', async () => {
    // Given
    const { session, result } = await logOutOffline();

    // When
    await act(async () => {
      onlineManager.setOnline(true);
      await jest.advanceTimersByTimeAsync(0);
    });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(0);
    });
    await expect(session.pendingRevocation.find()).resolves.toBeNull();

    // Then
    expect(result.current.status).toBe('unauthenticated');
    await expect(session.tokenStore.getRefreshToken()).resolves.toBeNull();
  });

  it('다른 계정으로 로그인한 뒤 해제가 실패해도 그 계정을 로그아웃시키지 않는다', async () => {
    // Given
    const { session, result } = await logOutOffline();
    await act(async () => {
      onlineManager.setOnline(true);
      session.requestRefresh.mockImplementation(async () => new Response(null, { status: 401 }));
      await result.current.login.mutateAsync({ email: 'b@aido.app', password: 'password-1' });
    });

    // When
    await act(async () => {
      await jest.advanceTimersByTimeAsync(0);
    });
    await expect(session.pendingRevocation.find()).resolves.toBeNull();
    await act(async () => {
      await jest.advanceTimersByTimeAsync(0);
    });

    // Then
    expect(session.requestRefresh).toHaveBeenCalledWith(ACCOUNT_A_TOKENS.refreshToken);
    expect(result.current.status).toBe('authenticated');
    await expect(session.tokenStore.getRefreshToken()).resolves.toBe('refresh-b');
  });
});

describe('대기 중인 초대', () => {
  const PENDING_INVITE = {
    inviteCode: 'K7M2QX',
    source: 'universal_link',
    savedAt: toInstant('2026-11-07T00:00:00.000Z'),
  } as const;

  it('로그아웃하면 지워 다음 계정이 앞사람의 초대를 받지 않는다', async () => {
    // Given
    const session = createAuthSession({ tokens: ACCOUNT_A_TOKENS });
    session.authHttp.delete.mockResolvedValue(ok({}));
    session.authHttp.post.mockResolvedValue(ok({ message: '로그아웃되었습니다.' }));
    writeStoredValue(session.syncStorage, pendingRedemptionStoredValue, PENDING_INVITE);
    const { result } = await session.renderSession(
      () => ({ status: useAuthStatus(), logout: useMutation(useLogoutMutationOptions()) }),
      'authenticated',
    );
    expect(readStoredValue(session.syncStorage, pendingRedemptionStoredValue)).not.toBeNull();

    // When
    await act(async () => {
      await result.current.logout.mutateAsync();
    });

    // Then
    await waitFor(() => expect(result.current.status).toBe('unauthenticated'));
    expect(readStoredValue(session.syncStorage, pendingRedemptionStoredValue)).toBeNull();
  });

  it('세션이 만료되면 남겨 다시 로그인한 뒤 이어서 받는다', async () => {
    // Given
    const session = createAuthSession({ tokens: ACCOUNT_A_TOKENS });
    writeStoredValue(session.syncStorage, pendingRedemptionStoredValue, PENDING_INVITE);
    const { result } = await session.renderSession(() => useAuthStatus(), 'authenticated');

    // When
    await act(() => emitSessionExpired({ reason: 'refresh-rejected' }));

    // Then
    await waitFor(() => expect(result.current).toBe('unauthenticated'));
    expect(readStoredValue(session.syncStorage, pendingRedemptionStoredValue)).toMatchObject({
      inviteCode: 'K7M2QX',
    });
  });

  it('로그인 전 미인증으로 시작해도 지우지 않는다', async () => {
    // Given
    const session = createAuthSession();
    writeStoredValue(session.syncStorage, pendingRedemptionStoredValue, PENDING_INVITE);

    // When
    await session.renderSession(() => useAuthStatus(), 'unauthenticated');

    // Then
    expect(readStoredValue(session.syncStorage, pendingRedemptionStoredValue)).toMatchObject({
      inviteCode: 'K7M2QX',
    });
  });
});

describe('계정을 떠날 때의 Analytics 정리 순서', () => {
  function givenRecordedAnalytics() {
    const analytics = createAnalyticsStub();
    const session = createAuthSession({ tokens: ACCOUNT_A_TOKENS, di: { analytics } });
    const calls: string[] = [];
    const statusNow = () => session.container.authSessionStore.getState().status;
    analytics.trackEvent.mockImplementation((name) => calls.push(`${name}:${statusNow()}`));
    analytics.clearUser.mockImplementation(() => calls.push(`clearUser:${statusNow()}`));
    analytics.resetData.mockImplementation(() => calls.push(`resetData:${statusNow()}`));
    session.authHttp.delete.mockResolvedValue(ok(createDeleteAccountDto()));
    session.authHttp.post.mockResolvedValue(ok({ message: '로그아웃되었습니다.' }));
    return { session, calls };
  }

  const useLogoutProbe = () => useMutation(useLogoutMutationOptions());

  afterEach(() => {
    onlineManager.setOnline(true);
  });

  it('온라인 로그아웃은 이벤트, 사용자 정리, 로그아웃 전환 순서다', async () => {
    // Given
    const { session, calls } = givenRecordedAnalytics();
    const { result } = await session.renderSession(useLogoutProbe, 'authenticated');

    // When
    await act(async () => {
      await result.current.mutateAsync();
    });

    // Then
    expect(calls).toEqual(['auth_logout:authenticated', 'clearUser:authenticated']);
    expect(session.container.authSessionStore.getState().status).toBe('unauthenticated');
  });

  it('오프라인 로그아웃도 같은 순서다', async () => {
    // Given
    const { session, calls } = givenRecordedAnalytics();
    const { result } = await session.renderSession(useLogoutProbe, 'authenticated');
    onlineManager.setOnline(false);

    // When
    await act(async () => {
      await result.current.mutateAsync();
    });

    // Then
    expect(calls).toEqual(['auth_logout:authenticated', 'clearUser:authenticated']);
    expect(session.container.authSessionStore.getState().status).toBe('unauthenticated');
  });

  it('탈퇴는 이벤트, 데이터 초기화, 로그아웃 전환 순서이고 사용자 정리를 따로 부르지 않는다', async () => {
    // Given
    const { session, calls } = givenRecordedAnalytics();
    const { result } = await session.renderSession(
      () => useMutation(useDeleteAccountMutationOptions()),
      'authenticated',
    );

    // When
    await act(async () => {
      await result.current.mutateAsync({ password: 'password-1' });
    });

    // Then
    expect(calls).toEqual(['auth_account_deleted:authenticated', 'resetData:authenticated']);
    expect(session.container.authSessionStore.getState().status).toBe('unauthenticated');
  });

  it('탈퇴가 실패하면 Analytics를 건드리지 않는다', async () => {
    // Given
    const { session, calls } = givenRecordedAnalytics();
    session.authHttp.delete.mockResolvedValue(
      err(new ApiError(ErrorCode.USER_0602, '비밀번호 불일치', 400)),
    );
    const { result } = await session.renderSession(
      () => useMutation(useDeleteAccountMutationOptions()),
      'authenticated',
    );

    // When
    await act(async () => {
      await result.current.mutateAsync({ password: 'wrong' }).catch(() => undefined);
    });

    // Then
    expect(calls).toEqual([]);
    expect(session.container.authSessionStore.getState().status).toBe('authenticated');
  });
});

describe('탈퇴', () => {
  const useDeleteProbe = () => ({
    status: useAuthStatus(),
    deleteAccount: useMutation(useDeleteAccountMutationOptions()),
  });

  it('성공하면 토큰, 상태, 초안을 정리한다', async () => {
    // Given
    const session = createAuthSession({ tokens: ACCOUNT_A_TOKENS });
    session.authHttp.delete.mockImplementation(async (url) =>
      url === 'v1/auth/account' ? ok(createDeleteAccountDto()) : ok({}),
    );
    const { result } = await session.renderSession(useDeleteProbe, 'authenticated');
    session.draftService.save(memoDraftKey, { content: '작성 중' });

    // When
    await act(async () => {
      await result.current.deleteAccount.mutateAsync({ password: 'password-1' });
    });

    // Then
    await waitFor(() => expect(result.current.status).toBe('unauthenticated'));
    await expect(session.tokenStore.getRefreshToken()).resolves.toBeNull();
    expect(session.draftService.restore(memoDraftKey)).toEqual({ status: 'empty' });
  });

  it('성공하면 조회 캐시를 비우고 그 계정의 안내 기록만 지운다', async () => {
    // Given
    const account = createCurrentUserDto({ userId: 'clz7x5p8k0001qz0z8z8z8z8a' });
    const session = createAuthSession({ tokens: ACCOUNT_A_TOKENS });
    const coachmarks = createCoachmarkRepository(session.syncStorage, getNowInstant);
    coachmarks.markSeen({ accountId: account.userId, kind: 'todo-reorder' });
    coachmarks.markSeen({ accountId: OTHER_ACCOUNT_ID, kind: 'todo-reorder' });
    session.userHttp.get.mockResolvedValue(ok(account));
    session.authHttp.delete.mockImplementation(async (url) =>
      url === 'v1/auth/account' ? ok(createDeleteAccountDto()) : ok({}),
    );
    const { result } = await session.renderSession(
      () => ({
        status: useAuthStatus(),
        meOptions: useGetMeQueryOptions(),
        deleteAccount: useMutation(useDeleteAccountMutationOptions()),
      }),
      'authenticated',
    );
    await act(async () => {
      await session.queryClient.fetchQuery(result.current.meOptions);
    });

    // When
    await act(async () => {
      await result.current.deleteAccount.mutateAsync({ password: 'password-1' });
    });

    // Then
    await waitFor(() => expect(result.current.status).toBe('unauthenticated'));
    expect(coachmarks.hasSeen({ accountId: account.userId, kind: 'todo-reorder' })).toBe(false);
    expect(coachmarks.hasSeen({ accountId: OTHER_ACCOUNT_ID, kind: 'todo-reorder' })).toBe(true);
    expect(session.queryClient.getQueryData(USER_QUERY_KEYS.me())).toBeUndefined();
  });

  it('탈퇴 응답을 기다리는 사이 세션이 만료돼도 초안과 안내 기록을 지운다', async () => {
    // Given
    const account = createCurrentUserDto({ userId: 'clz7x5p8k0001qz0z8z8z8z8a' });
    const session = createAuthSession({ tokens: ACCOUNT_A_TOKENS });
    const coachmarks = createCoachmarkRepository(session.syncStorage, getNowInstant);
    coachmarks.markSeen({ accountId: account.userId, kind: 'todo-reorder' });
    const deleteRequest = createPendingResponse(ok(createDeleteAccountDto()));
    session.userHttp.get.mockResolvedValue(ok(account));
    session.authHttp.delete.mockImplementation((url) =>
      url === 'v1/auth/account' ? deleteRequest.response : Promise.resolve(ok({})),
    );
    const { result } = await session.renderSession(
      () => ({
        status: useAuthStatus(),
        meOptions: useGetMeQueryOptions(),
        deleteAccount: useMutation(useDeleteAccountMutationOptions()),
      }),
      'authenticated',
    );
    await act(async () => {
      await session.queryClient.fetchQuery(result.current.meOptions);
    });
    session.draftService.save(memoDraftKey, { content: '작성 중' });
    await act(async () => {
      result.current.deleteAccount.mutate({ password: 'password-1' });
      await jest.advanceTimersByTimeAsync(0);
    });
    await act(async () => {
      emitSessionExpired({ reason: 'refresh-rejected' });
      await jest.advanceTimersByTimeAsync(0);
    });
    await waitFor(() => expect(result.current.status).toBe('unauthenticated'));

    // When
    await act(async () => {
      deleteRequest.settle();
      await jest.advanceTimersByTimeAsync(0);
    });

    // Then
    await waitFor(() =>
      expect(session.draftService.restore(memoDraftKey)).toEqual({ status: 'empty' }),
    );
    expect(coachmarks.hasSeen({ accountId: account.userId, kind: 'todo-reorder' })).toBe(false);
  });

  it('비밀번호가 틀려 실패하면 토큰과 상태를 유지한다', async () => {
    // Given
    const session = createAuthSession({ tokens: ACCOUNT_A_TOKENS });
    session.authHttp.delete.mockImplementation(async (url) =>
      url === 'v1/auth/account'
        ? err(new ApiError(ErrorCode.USER_0602, '비밀번호 불일치', 400))
        : ok({}),
    );
    const { result } = await session.renderSession(useDeleteProbe, 'authenticated');
    session.draftService.save(memoDraftKey, { content: '작성 중' });

    // When
    await act(async () => {
      await result.current.deleteAccount.mutateAsync({ password: 'wrong' }).catch(() => undefined);
    });

    // Then
    expect(result.current.status).toBe('authenticated');
    await expect(session.tokenStore.getRefreshToken()).resolves.toBe(ACCOUNT_A_TOKENS.refreshToken);
    expect(session.draftService.restore(memoDraftKey)).toEqual({
      status: 'restored',
      value: { content: '작성 중' },
    });
  });
});

describe('탈퇴 실패와 푸시', () => {
  it('실패하면 이 기기의 푸시를 풀지 않아 알림이 계속 온다', async () => {
    // Given
    const session = createAuthSession({ tokens: ACCOUNT_A_TOKENS });
    session.authHttp.delete.mockImplementation(async (url) =>
      url === 'v1/auth/account'
        ? err(new ApiError(ErrorCode.USER_0602, '비밀번호 불일치', 400))
        : ok({}),
    );
    const { result } = await session.renderSession(
      () => useMutation(useDeleteAccountMutationOptions()),
      'authenticated',
    );

    // When
    await act(async () => {
      await result.current.mutateAsync({ password: 'wrong' }).catch(() => undefined);
    });

    // Then
    expect(session.authHttp.delete).not.toHaveBeenCalledWith(
      'v1/notifications/token',
      expect.anything(),
    );
  });
});

describe('로그인', () => {
  const dto = createAuthTokensDto({ accessToken: 'access-new', refreshToken: 'refresh-new' });

  async function expectSignedIn(
    session: ReturnType<typeof createAuthSession>,
    status: () => string,
  ) {
    await waitFor(() => expect(status()).toBe('authenticated'));
    await expect(session.tokenStore.getAccessToken()).resolves.toBe('access-new');
    await expect(session.tokenStore.getRefreshToken()).resolves.toBe('refresh-new');
  }

  it('이메일 로그인은 토큰을 저장하고 인증 상태가 된다', async () => {
    // Given
    const session = createAuthSession();
    session.publicHttp.post.mockResolvedValue(ok(dto));
    const { result } = await session.renderSession(
      () => ({ status: useAuthStatus(), login: useMutation(useEmailLoginMutationOptions()) }),
      'unauthenticated',
    );

    // When
    await act(async () => {
      await result.current.login.mutateAsync({ email: 'a@aido.app', password: 'password-1' });
    });

    // Then
    await expectSignedIn(session, () => result.current.status);
  });

  it('Apple 로그인은 토큰을 저장하고 인증 상태가 된다', async () => {
    // Given
    const session = createAuthSession();
    session.socialAuthGateway.signInWithApple.mockResolvedValue(createAppleSignInSuccess());
    session.publicHttp.post.mockResolvedValue(ok(dto));
    const { result } = await session.renderSession(
      () => ({ status: useAuthStatus(), login: useMutation(useOpenAppleLoginMutationOptions()) }),
      'unauthenticated',
    );

    // When
    await act(async () => {
      await result.current.login.mutateAsync();
    });

    // Then
    await expectSignedIn(session, () => result.current.status);
  });

  it('구글·카카오·네이버 교환 코드는 토큰을 저장하고 인증 상태가 된다', async () => {
    // Given
    const session = createAuthSession();
    session.publicHttp.post.mockResolvedValue(ok(dto));
    const { result } = await session.renderSession(
      () => ({ status: useAuthStatus(), login: useMutation(useExchangeCodeMutationOptions()) }),
      'unauthenticated',
    );

    // When
    await act(async () => {
      await result.current.login.mutateAsync({ code: 'exchange-code', provider: 'kakao' });
    });

    // Then
    await expectSignedIn(session, () => result.current.status);
  });

  it('이메일 인증을 마치면 토큰을 저장하고 인증 상태가 된다', async () => {
    // Given
    const session = createAuthSession();
    session.publicHttp.post.mockResolvedValue(ok(dto));
    const { result } = await session.renderSession(
      () => ({ status: useAuthStatus(), verify: useMutation(useVerifyEmailMutationOptions()) }),
      'unauthenticated',
    );

    // When
    await act(async () => {
      await result.current.verify.mutateAsync({
        email: 'a@aido.app',
        code: '123456',
      });
    });

    // Then
    await expectSignedIn(session, () => result.current.status);
  });
});

describe('로그아웃과 늦은 갱신', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('갱신 중에 로그아웃이 시간 초과로 끝나고 갱신 응답이 늦게 와도 토큰이 되살아나지 않는다', async () => {
    // Given
    const sessionEpoch = createSessionEpoch();
    const tokenStore = withSessionEpoch(createMemoryTokenStore(ACCOUNT_A_TOKENS), sessionEpoch);
    const lateRefresh = createPendingResponse(
      new Response(
        JSON.stringify({ data: { accessToken: 'access-late', refreshToken: 'refresh-late' } }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    const sessionManager = createSessionManager(tokenStore);
    global.fetch = jest.fn((input) =>
      input instanceof Request && input.url.endsWith('v1/todos')
        ? Promise.resolve(new Response(null, { status: 401 }))
        : new Promise<Response>(() => undefined),
    );
    const http = new KyHttpClient(
      createAuthClient({
        tokenStore,
        refresh: createTokenRefresher({
          tokenStore,
          requestRefresh: () => lateRefresh.response,
          sessionEpoch,
          logger: createLoggerStub(),
        }),
        endSession: (details) => sessionManager.end(details),
        sessionEpoch,
        logger: createLoggerStub(),
        errorReporter: createErrorReporterStub(),
      }),
    );
    const authService = new AuthService({
      publicHttpClient: createHttpClientStub(),
      authHttpClient: http,
      tokenStore,
      socialAuthGateway: createSocialAuthGatewayStub(),
      deviceType: 'IOS',
      logger: createLoggerStub(),
    });
    const todosRequest = http.get('v1/todos').catch(() => undefined);
    await act(async () => {
      await jest.advanceTimersByTimeAsync(0);
    });
    const logout = new LogOutDeviceService({
      authService,
      pushDeviceService: { unregister: async () => ok(undefined), requestRelease: () => {} },
      tokenStore,
      sessionRevocationService: { record: async () => undefined },
      sessionEpoch,
      logger: createLoggerStub(),
    }).logOut({ isOnline: true });

    // When
    await act(async () => {
      await jest.advanceTimersByTimeAsync(LOGOUT_REQUEST_TIMEOUT_MS);
    });
    await logout;
    await expect(tokenStore.getRefreshToken()).resolves.toBeNull();
    lateRefresh.settle();
    await act(async () => {
      await jest.advanceTimersByTimeAsync(1000);
    });

    // Then
    await expect(tokenStore.getRefreshToken()).resolves.toBeNull();
    await expect(tokenStore.getAccessToken()).resolves.toBeNull();
    await todosRequest;
  });
});

describe('로그아웃 뒤 늦게 끝난 변경', () => {
  const ME_KEY = USER_QUERY_KEYS.me();
  const ACCOUNT_A = createCurrentUserDto({ userId: 'clz7x5p8k0001qz0z8z8z8z8a' });
  const ACCOUNT_B = createCurrentUserDto({ userId: 'clz7x5p8k0001qz0z8z8z8z8b' });
  const REJECTED = err(new ApiError(ErrorCode.SYS_0001, '실패', 400));

  function givenSignedInAccountA() {
    const session = createAuthSession({ tokens: ACCOUNT_A_TOKENS });
    session.authHttp.delete.mockResolvedValue(ok({}));
    session.authHttp.post.mockResolvedValue(ok({ message: '로그아웃되었습니다.' }));
    session.userHttp.get.mockResolvedValue(ok(ACCOUNT_A));
    // 앱의 기본값. 신선한 값이면 다음 계정이 그대로 읽는다
    session.queryClient.setDefaultOptions({
      queries: { retry: false, gcTime: Infinity, staleTime: 5 * 60 * 1000 },
      mutations: { retry: false, gcTime: Infinity },
    });
    return session;
  }

  it('화면이 사라진 뒤 프로필 저장이 실패해도 롤백이 지운 캐시를 채우지 않는다', async () => {
    // Given
    const session = givenSignedInAccountA();
    const profile = createPendingResponse(REJECTED);
    session.userHttp.patch.mockReturnValue(profile.response);
    const { result } = await session.renderSession(
      () => ({
        status: useAuthStatus(),
        logout: useMutation(useLogoutMutationOptions()),
        profileOptions: useUpdateProfileMutationOptions(),
      }),
      'authenticated',
    );
    await waitFor(() => expect(session.queryClient.getQueryData(ME_KEY)).toBeDefined());
    const saving = session.queryClient
      .getMutationCache()
      .build(session.queryClient, result.current.profileOptions)
      .execute({ name: '새 이름' })
      .catch(() => undefined);
    await waitFor(() => expect(session.userHttp.patch).toHaveBeenCalled());

    // When
    await act(async () => {
      await result.current.logout.mutateAsync();
    });
    await waitFor(() => expect(result.current.status).toBe('unauthenticated'));
    profile.settle();
    await act(async () => {
      await saving;
    });

    // Then
    expect(session.queryClient.getQueryData(ME_KEY)).toBeUndefined();
  });

  it('A의 늦은 생성 성공이 B에게 이벤트와 활성화 기록을 남기지 않는다', async () => {
    // Given
    const todoHttp = createHttpClientStub();
    const created = createPendingResponse(ok({ message: '생성됨', todo: createTodoDto() }));
    todoHttp.post.mockReturnValue(created.response);
    todoHttp.get.mockRejectedValue(new Error('이 테스트는 조회를 보지 않는다'));
    const analytics = createAnalyticsStub();
    let createdEventCount = 0;
    const unsubscribeCreated = subscribeTodoCreated(() => {
      createdEventCount += 1;
    });
    const session = createAuthSession({
      tokens: ACCOUNT_A_TOKENS,
      di: { todoService: new TodoService(todoHttp), analytics },
    });
    session.authHttp.delete.mockResolvedValue(ok({}));
    session.authHttp.post.mockResolvedValue(ok({ message: '로그아웃되었습니다.' }));
    const { result } = await session.renderSession(
      () => ({
        status: useAuthStatus(),
        logout: useMutation(useLogoutMutationOptions()),
        createOptions: useCreateTodoMutationOptions(),
      }),
      'authenticated',
    );
    const creating = session.queryClient
      .getMutationCache()
      .build(session.queryClient, result.current.createOptions)
      .execute({
        input: {
          title: 'A의 할 일',
          categoryId: 1,
          startDate: '2026-11-07',
          isAllDay: true,
          visibility: 'PUBLIC',
        },
      })
      .catch(() => undefined);
    await waitFor(() => expect(todoHttp.post).toHaveBeenCalled());
    await act(async () => {
      await result.current.logout.mutateAsync();
    });
    await waitFor(() => expect(result.current.status).toBe('unauthenticated'));
    const eventsBefore = analytics.trackEvent.mock.calls.length;

    // When
    created.settle();
    await act(async () => {
      await creating;
    });

    // Then
    await expect(creating).resolves.toBeDefined();
    expect(analytics.trackEvent.mock.calls.slice(eventsBefore)).toEqual([]);
    expect(createdEventCount).toBe(0);
    unsubscribeCreated();
  });

  it('프로필 롤백이 캐시를 다시 채워도 다음 계정은 지난 계정 값을 읽지 않는다', async () => {
    // Given
    const session = givenSignedInAccountA();
    const profile = createPendingResponse(REJECTED);
    session.userHttp.patch.mockReturnValue(profile.response);
    session.publicHttp.post.mockResolvedValue(ok(createAuthTokensDto()));
    const draftKeyOfB = createDraftKey({
      ownerId: ACCOUNT_B.userId,
      scope: 'memo',
      target: ['create'],
      schema: z.object({ content: z.string() }),
    });
    const { result } = await session.renderSession(() => {
      useSyncUserIdentity();
      useClaimDeviceDataForUser();
      return {
        status: useAuthStatus(),
        logout: useMutation(useLogoutMutationOptions()),
        login: useMutation(useEmailLoginMutationOptions()),
        update: useMutation(useUpdateProfileMutationOptions()),
      };
    }, 'authenticated');
    await waitFor(() => expect(session.queryClient.getQueryData(ME_KEY)).toBeDefined());
    const staleMe = session.queryClient.getQueryData(ME_KEY);
    await act(async () => {
      result.current.update.mutate({ name: '새 이름' });
      await jest.advanceTimersByTimeAsync(0);
    });
    await act(async () => {
      await result.current.logout.mutateAsync();
    });
    await waitFor(() => expect(result.current.status).toBe('unauthenticated'));
    // 관찰자가 마운트된 채 다시 그려지면 정리에서 비운 콜백이 복구되어 이 쓰기가 일어날 수 있다
    session.queryClient.setQueryData(ME_KEY, staleMe);
    session.userHttp.get.mockResolvedValue(ok(ACCOUNT_B));
    session.draftService.save(draftKeyOfB, { content: 'B의 초안' });

    // When
    await act(async () => {
      await result.current.login.mutateAsync({ email: 'b@aido.app', password: 'password-1' });
    });
    await waitFor(() => expect(result.current.status).toBe('authenticated'));
    await act(async () => {
      await jest.advanceTimersByTimeAsync(0);
    });
    profile.settle();

    // Then
    expect(session.draftService.restore(draftKeyOfB)).toEqual({
      status: 'restored',
      value: { content: 'B의 초안' },
    });
    expect(session.userHttp.get).toHaveBeenCalledTimes(2);
  });
});

describe('로그인 직전 정리', () => {
  it('로그인 화면의 공개 조회는 오류 없이 다시 불러온다', async () => {
    // Given
    const session = createAuthSession();
    session.publicHttp.post.mockResolvedValue(ok(createAuthTokensDto()));
    const fetchPublicConfig = jest.fn(async () => '공개 설정');
    const { result } = await session.renderSession(
      () => ({
        status: useAuthStatus(),
        login: useMutation(useEmailLoginMutationOptions()),
        config: useQuery({ queryKey: ['public-config'], queryFn: fetchPublicConfig }),
      }),
      'unauthenticated',
    );
    await waitFor(() => expect(result.current.config.data).toBe('공개 설정'));

    // When
    await act(async () => {
      await result.current.login.mutateAsync({ email: 'a@aido.app', password: 'password-1' });
    });
    await waitFor(() => expect(result.current.status).toBe('authenticated'));

    // Then
    await waitFor(() => expect(result.current.config.data).toBe('공개 설정'));
    expect(result.current.config.isError).toBe(false);
  });
});

describe('토큰 만료', () => {
  const ROTATED_TOKENS = { accessToken: 'access-a2', refreshToken: 'refresh-a2' };
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  function createSessionWithRealPipeline(requestRefresh: () => Promise<Response>) {
    const sessionEpoch = createSessionEpoch();
    const tokenStore = withSessionEpoch(createMemoryTokenStore(ACCOUNT_A_TOKENS), sessionEpoch);
    const sessionManager = createSessionManager(tokenStore);
    const client = createAuthClient({
      tokenStore,
      refresh: createTokenRefresher({
        tokenStore,
        requestRefresh,
        sessionEpoch,
        logger: createLoggerStub(),
      }),
      endSession: (details) => sessionManager.end(details),
      sessionEpoch,
      logger: createLoggerStub(),
      errorReporter: createErrorReporterStub(),
    });
    global.fetch = jest.fn(async () => new Response(null, { status: 401 }));
    const session = createAuthSession({
      tokenStore,
      di: { userService: new UserService(new KyHttpClient(client)) },
    });
    return { ...session, client };
  }

  const useStatusProbe = () => useAuthStatus();

  it.each([
    ['네트워크 실패', () => Promise.reject(new TypeError('Network request failed'))],
    ['서버 장애', async () => new Response(null, { status: 503 })],
  ])('갱신이 %s면 로그아웃하지 않고 토큰을 유지한다', async (_name, requestRefresh) => {
    // Given
    const session = createSessionWithRealPipeline(requestRefresh);

    // When
    const { result } = await session.renderSession(useStatusProbe, 'authenticated');
    await act(async () => {
      await jest.runOnlyPendingTimersAsync();
    });

    // Then
    expect(result.current).toBe('authenticated');
    await expect(session.tokenStore.getRefreshToken()).resolves.toBe(ACCOUNT_A_TOKENS.refreshToken);
  });

  it('동시에 만료된 요청은 갱신 한 번으로 모두 재시도하고 로그인을 유지한다', async () => {
    // Given
    const requestRefresh = jest.fn(
      async () =>
        new Response(JSON.stringify({ data: ROTATED_TOKENS }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    );
    const session = createSessionWithRealPipeline(requestRefresh);
    global.fetch = jest.fn(async (input) =>
      input instanceof Request && input.headers.get(RETRY_MARKER_HEADER) === '1'
        ? new Response(JSON.stringify({ success: true, data: {}, timestamp: 0 }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        : new Response(null, { status: 401 }),
    );
    const http = new KyHttpClient(session.client);
    const { result } = await session.renderSession(useStatusProbe, 'authenticated');
    await act(async () => {
      await jest.advanceTimersByTimeAsync(5_000);
    });
    requestRefresh.mockClear();

    // When
    const requests = Promise.all([
      http.get('v1/todos'),
      http.get('v1/friends'),
      http.get('v1/memos'),
    ]);
    await act(async () => {
      await jest.advanceTimersByTimeAsync(5_000);
    });
    const results = await requests;

    // Then
    expect(results.map(({ ok: isOk }) => isOk)).toEqual([true, true, true]);
    expect(requestRefresh).toHaveBeenCalledTimes(1);
    expect(result.current).toBe('authenticated');
    await expect(session.tokenStore.getRefreshToken()).resolves.toBe(ROTATED_TOKENS.refreshToken);
  });

  it('갱신이 401이면 세션을 끝내고 원인을 한 번만 알린다', async () => {
    // Given
    const session = createSessionWithRealPipeline(
      async () =>
        new Response(JSON.stringify({ error: { code: 'SESSION_0704' } }), { status: 401 }),
    );

    // When
    await session.renderSession(useStatusProbe, 'unauthenticated');

    // Then
    expect(session.errorReporter.captureMessage).toHaveBeenCalledTimes(1);
    expect(session.errorReporter.captureMessage).toHaveBeenCalledWith(
      'session_expired',
      expect.objectContaining({ errorCode: 'refresh-rejected' }),
    );
  });

  it('로그아웃 요청이 세션 거부를 받아도 토큰을 지우고 미인증이 된다', async () => {
    // Given
    const sessionEpoch = createSessionEpoch();
    const tokenStore = withSessionEpoch(createMemoryTokenStore(ACCOUNT_A_TOKENS), sessionEpoch);
    const sessionManager = createSessionManager(tokenStore);
    const http = new KyHttpClient(
      createAuthClient({
        tokenStore,
        refresh: createTokenRefresher({
          tokenStore,
          requestRefresh: async () => new Response(null, { status: 401 }),
          sessionEpoch,
          logger: createLoggerStub(),
        }),
        endSession: (details) => sessionManager.end(details),
        sessionEpoch,
        logger: createLoggerStub(),
        errorReporter: createErrorReporterStub(),
      }),
    );
    global.fetch = jest.fn(async () => new Response(null, { status: 401 }));
    const session = createAuthSession({
      tokenStore,
      di: {
        authService: new AuthService({
          publicHttpClient: createHttpClientStub(),
          authHttpClient: http,
          tokenStore,
          socialAuthGateway: createSocialAuthGatewayStub(),
          deviceType: 'IOS',
          logger: createLoggerStub(),
        }),
      },
    });
    const { result } = await session.renderSession(
      () => ({ status: useAuthStatus(), logout: useMutation(useLogoutMutationOptions()) }),
      'authenticated',
    );
    session.draftService.save(memoDraftKey, { content: '작성 중' });

    // When
    await act(async () => {
      result.current.logout.mutate();
      await jest.advanceTimersByTimeAsync(5_000);
    });

    // Then
    await waitFor(() => expect(result.current.status).toBe('unauthenticated'));
    await expect(tokenStore.getRefreshToken()).resolves.toBeNull();
  });

  it('로그아웃 진행 중 세션 만료가 먼저 반영돼도 초안을 지우고 로그아웃 이벤트를 남긴다', async () => {
    // Given
    const session = createAuthSession({ tokens: ACCOUNT_A_TOKENS });
    const analytics = session.container.analytics;
    const logoutRequest = createPendingResponse(ok({ message: '로그아웃되었습니다.' }));
    session.authHttp.delete.mockResolvedValue(ok({}));
    session.authHttp.post.mockReturnValue(logoutRequest.response);
    const { result } = await session.renderSession(
      () => ({ status: useAuthStatus(), logout: useMutation(useLogoutMutationOptions()) }),
      'authenticated',
    );
    session.draftService.save(memoDraftKey, { content: '작성 중' });
    await act(async () => {
      result.current.logout.mutate();
      await jest.advanceTimersByTimeAsync(0);
    });

    // When
    await act(async () => {
      emitSessionExpired({ reason: 'refresh-rejected' });
      await jest.advanceTimersByTimeAsync(0);
    });
    await waitFor(() => expect(result.current.status).toBe('unauthenticated'));
    await act(async () => {
      logoutRequest.settle();
      await jest.advanceTimersByTimeAsync(0);
    });

    // Then
    await waitFor(() =>
      expect(session.draftService.restore(memoDraftKey)).toEqual({ status: 'empty' }),
    );
    expect(analytics.trackEvent).toHaveBeenCalledWith('auth_logout', undefined);
    expect(result.current.status).toBe('unauthenticated');
    await expect(session.tokenStore.getRefreshToken()).resolves.toBeNull();
  });

  describe('로그아웃 응답을 기다리는 사이 세션이 만료될 때', () => {
    const ACCOUNT_B_TOKENS = { accessToken: 'access-b', refreshToken: 'refresh-b' };

    function givenSessionWithEpoch() {
      const sessionEpoch = createSessionEpoch();
      const tokenStore = withSessionEpoch(createMemoryTokenStore(ACCOUNT_A_TOKENS), sessionEpoch);
      const session = createAuthSession({ tokenStore, di: { sessionEpoch } });
      session.authHttp.delete.mockResolvedValue(ok({}));
      const useSessionProbe = () => ({
        status: useAuthStatus(),
        logout: useMutation(useLogoutMutationOptions()),
        signIn: useAuthSession().signIn,
      });
      return {
        session,
        tokenStore,
        useSessionProbe,
        sessionManager: createSessionManager(tokenStore),
      };
    }

    const REFRESH_REJECTED = { reason: 'refresh-rejected' } as const;

    it('다시 로그인했으면 늦은 응답이 새 세션의 토큰과 상태와 초안을 건드리지 않는다', async () => {
      // Given
      const { session, tokenStore, useSessionProbe, sessionManager } = givenSessionWithEpoch();
      const analytics = session.container.analytics;
      const logoutRequest = createPendingResponse(ok({ message: '로그아웃되었습니다.' }));
      session.authHttp.post.mockReturnValue(logoutRequest.response);
      const { result } = await session.renderSession(useSessionProbe, 'authenticated');
      await act(async () => {
        result.current.logout.mutate();
        await jest.advanceTimersByTimeAsync(0);
      });
      await act(async () => {
        await sessionManager.end(REFRESH_REJECTED);
      });
      await waitFor(() => expect(result.current.status).toBe('unauthenticated'));
      await act(async () => {
        await tokenStore.save(ACCOUNT_B_TOKENS);
        result.current.signIn();
      });
      await waitFor(() => expect(result.current.status).toBe('authenticated'));
      session.draftService.save(memoDraftKey, { content: '새 세션에서 작성 중' });
      jest.mocked(analytics.clearUser).mockClear();

      // When
      await act(async () => {
        logoutRequest.settle();
        await jest.advanceTimersByTimeAsync(0);
      });

      // Then
      await expect(tokenStore.getRefreshToken()).resolves.toBe(ACCOUNT_B_TOKENS.refreshToken);
      expect(result.current.status).toBe('authenticated');
      expect(session.draftService.restore(memoDraftKey)).toEqual({
        status: 'restored',
        value: { content: '새 세션에서 작성 중' },
      });
      expect(analytics.trackEvent).not.toHaveBeenCalledWith('auth_logout', undefined);
      expect(analytics.clearUser).not.toHaveBeenCalled();
    });

    it('푸시 해제 중 다시 로그인했으면 새 토큰으로 서버 로그아웃을 보내지 않는다', async () => {
      // Given
      const { session, tokenStore, useSessionProbe, sessionManager } = givenSessionWithEpoch();
      const unregisterRequest = createPendingResponse(ok({}));
      session.authHttp.delete.mockReturnValue(unregisterRequest.response);
      session.authHttp.post.mockResolvedValue(ok({ message: '로그아웃되었습니다.' }));
      const { result } = await session.renderSession(useSessionProbe, 'authenticated');
      await act(async () => {
        result.current.logout.mutate();
        await jest.advanceTimersByTimeAsync(0);
      });
      await act(async () => {
        await sessionManager.end(REFRESH_REJECTED);
      });
      await waitFor(() => expect(result.current.status).toBe('unauthenticated'));
      await act(async () => {
        await tokenStore.save(ACCOUNT_B_TOKENS);
        result.current.signIn();
      });
      await waitFor(() => expect(result.current.status).toBe('authenticated'));

      // When
      await act(async () => {
        unregisterRequest.settle();
        await jest.advanceTimersByTimeAsync(0);
      });

      // Then
      expect(session.authHttp.post).not.toHaveBeenCalledWith(
        'v1/auth/logout',
        undefined,
        expect.anything(),
      );
      await expect(tokenStore.getRefreshToken()).resolves.toBe(ACCOUNT_B_TOKENS.refreshToken);
      expect(result.current.status).toBe('authenticated');
    });

    it('다시 로그인하지 않았으면 사용자가 나간 것으로 끝낸다', async () => {
      // Given
      const { session, tokenStore, useSessionProbe, sessionManager } = givenSessionWithEpoch();
      const analytics = session.container.analytics;
      const logoutRequest = createPendingResponse(ok({ message: '로그아웃되었습니다.' }));
      session.authHttp.post.mockReturnValue(logoutRequest.response);
      const { result } = await session.renderSession(useSessionProbe, 'authenticated');
      session.draftService.save(memoDraftKey, { content: '작성 중' });
      await act(async () => {
        result.current.logout.mutate();
        await jest.advanceTimersByTimeAsync(0);
      });
      await act(async () => {
        await sessionManager.end(REFRESH_REJECTED);
      });
      await waitFor(() => expect(result.current.status).toBe('unauthenticated'));

      // When
      await act(async () => {
        logoutRequest.settle();
        await jest.advanceTimersByTimeAsync(0);
      });

      // Then
      await waitFor(() =>
        expect(session.draftService.restore(memoDraftKey)).toEqual({ status: 'empty' }),
      );
      expect(analytics.trackEvent).toHaveBeenCalledWith('auth_logout', undefined);
      expect(analytics.clearUser).toHaveBeenCalledTimes(1);
      await expect(tokenStore.getRefreshToken()).resolves.toBeNull();
    });
  });

  it('갱신이 401이면 세션을 끝내고 초안은 남긴다', async () => {
    // Given
    const session = createSessionWithRealPipeline(async () => new Response(null, { status: 401 }));
    session.draftService.save(memoDraftKey, { content: '작성 중' });

    // When
    await session.renderSession(useStatusProbe, 'unauthenticated');

    // Then
    await expect(session.tokenStore.getRefreshToken()).resolves.toBeNull();
    expect(session.draftService.restore(memoDraftKey)).toEqual({
      status: 'restored',
      value: { content: '작성 중' },
    });
  });
});

describe('만료 후 다시 로그인', () => {
  const ACCOUNT_A = createCurrentUserDto({ userId: 'clz7x5p8k0001qz0z8z8z8z8a' });
  const ACCOUNT_B = createCurrentUserDto({ userId: 'clz7x5p8k0001qz0z8z8z8z8b' });
  const draftKeyOfA = createDraftKey({
    ownerId: ACCOUNT_A.userId,
    scope: 'memo',
    target: ['create'],
    schema: z.object({ content: z.string() }),
  });

  const useReloginProbe = () => {
    useSyncUserIdentity();
    useClaimDeviceDataForUser();
    return { status: useAuthStatus(), login: useMutation(useEmailLoginMutationOptions()) };
  };

  async function expireThenLogin(nextAccount: typeof ACCOUNT_A) {
    const session = createAuthSession({ tokens: ACCOUNT_A_TOKENS });
    session.userHttp.get.mockResolvedValue(ok(ACCOUNT_A));
    session.publicHttp.post.mockResolvedValue(ok(createAuthTokensDto()));
    const { result } = await session.renderSession(useReloginProbe, 'authenticated');
    session.draftService.save(draftKeyOfA, { content: '작성 중' });

    await act(() => emitSessionExpired({ reason: 'refresh-rejected' }));
    await waitFor(() => expect(result.current.status).toBe('unauthenticated'));

    session.userHttp.get.mockResolvedValue(ok(nextAccount));
    await act(async () => {
      await result.current.login.mutateAsync({ email: 'a@aido.app', password: 'password-1' });
    });
    await waitFor(() => expect(result.current.status).toBe('authenticated'));
    return session;
  }

  it('같은 계정으로 돌아오면 초안을 이어 쓴다', async () => {
    // When
    const session = await expireThenLogin(ACCOUNT_A);

    // Then
    await waitFor(() => expect(session.userHttp.get).toHaveBeenCalledTimes(2));
    await act(async () => {
      await jest.runOnlyPendingTimersAsync();
    });
    expect(session.draftService.restore(draftKeyOfA)).toEqual({
      status: 'restored',
      value: { content: '작성 중' },
    });
  });

  it('다른 계정이 로그인하면 이전 계정의 초안을 지운다', async () => {
    // When
    const session = await expireThenLogin(ACCOUNT_B);

    // Then
    await waitFor(() =>
      expect(session.draftService.restore(draftKeyOfA)).toEqual({ status: 'empty' }),
    );
  });
});
