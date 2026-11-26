import '@src/shared/i18n/init';
import type { ErrorCodeType } from '@aido/api/errors';
import { INVITEE_REWARDS } from '@aido/api/vocabulary';
import type { ApiError } from '@src/core/errors/api-error';
import { fail, ok, type Result } from '@src/core/errors/result';
import type { AuthStatus } from '@src/core/session/auth-status';
import { createAuthSessionStoreStub } from '@src/features/identity/auth/__tests__/create-auth-session-store-stub';
import { createCurrentUserDto } from '@src/features/identity/user/__tests__/user.fixtures';
import { readStoredValue } from '@src/shared/storage/define-stored-value';
import {
  createAnalyticsStub,
  createApiError,
  createHttpClientStub,
  createMemoryObservableSyncStorage,
  createPendingResponse,
  createRouteParamsFake,
  createTestDi,
  getTrackedEvents,
  respondByPath,
} from '@src/testing/core';
import { pressTwiceInSameFrame } from '@src/testing/press';
import { renderScreen } from '@src/testing/render';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import InviteCardScreen from '../../../../../app/invite/[inviteCode]';
import { INVITE_QUERY_KEYS } from '../queries/invite-query-keys';
import { pendingRedemptionStoredValue } from '../schemas/pending-redemption-storage.schema';
import {
  createInviteApiError,
  createInvitePreviewDto,
  createRedeemResponseDto,
} from './invite.fixtures';

const INVITE_CODE = 'K7M2QX';
const PREVIEW_PATH = `v1/invites/${INVITE_CODE}`;
const REDEEM_PATH = `v1/invites/${INVITE_CODE}/redeem`;
const INVITER_ID = createRedeemResponseDto().inviter.userId;
const INVITEE_PREMIUM_DAYS = INVITEE_REWARDS[0].quantity;

type Response = Result<unknown, ApiError>;

interface RenderCardOptions {
  status?: AuthStatus;
  params?: Record<string, string>;
  preview?: Response;
  redeem?: Response | (() => Promise<Response>);
  /** 가입한 지 얼마 안 된 계정이면 보상을 기대한다 */
  isNewAccount?: boolean;
  analytics?: ReturnType<typeof createAnalyticsStub>;
}

async function renderCard({
  status = 'authenticated',
  params = { inviteCode: INVITE_CODE, source: 'universal_link' },
  preview = ok(createInvitePreviewDto()),
  redeem = ok(createRedeemResponseDto()),
  isNewAccount = false,
  analytics = createAnalyticsStub(),
}: RenderCardOptions = {}) {
  createRouteParamsFake(params);
  const httpClient = createHttpClientStub();
  httpClient.get.mockImplementation(
    respondByPath({
      [PREVIEW_PATH]: preview,
      'v1/auth/me': ok(
        createCurrentUserDto(isNewAccount ? { createdAt: new Date().toISOString() } : {}),
      ),
      'v1/follows/friends': ok({ friends: [], totalCount: 0, hasMore: false }),
    }),
  );
  httpClient.post.mockImplementation(respondByPath({ [REDEEM_PATH]: redeem }));
  const syncStorage = createMemoryObservableSyncStorage();
  const di = createTestDi({
    ports: { httpClient, analytics, syncStorage },
    seeds: { authSessionStore: createAuthSessionStoreStub(status) },
  });
  const rendered = await renderScreen(<InviteCardScreen />, { di, withLocalDate: true });

  return { httpClient, analytics, syncStorage, di, rendered };
}

describe('InviteCardScreen', () => {
  it('로그인 전이면 가입하기를 누를 때 초대를 기기에 남기고 가입으로 보낸다', async () => {
    // Given
    const { syncStorage } = await renderCard({ status: 'unauthenticated' });
    expect(await screen.findByText('민지님이\n아이두에 초대했어요')).toBeOnTheScreen();

    // When
    await fireEvent.press(screen.getByTestId('invite-card-signup'));

    // Then
    expect(router.push).toHaveBeenCalledWith('/sign-up');
    expect(readStoredValue(syncStorage, pendingRedemptionStoredValue)).toEqual(
      expect.objectContaining({ inviteCode: INVITE_CODE, source: 'universal_link' }),
    );
  });

  it('로그인 전이면 로그인을 누를 때도 초대를 남기고 로그인으로 보낸다', async () => {
    // Given
    const { syncStorage } = await renderCard({ status: 'unauthenticated' });

    // When
    await fireEvent.press(await screen.findByTestId('invite-card-login'));

    // Then
    expect(router.push).toHaveBeenCalledWith('/login');
    expect(readStoredValue(syncStorage, pendingRedemptionStoredValue)?.inviteCode).toBe(
      INVITE_CODE,
    );
  });

  it.each([
    {
      isNewAccount: true,
      label: `친구 되고 프리미엄 ${INVITEE_PREMIUM_DAYS}일 받기`,
      hasNote: false,
    },
    { isNewAccount: false, label: '민지님과 친구 맺기', hasNote: true },
  ])(
    '가입한 지 얼마 안 됐는지($isNewAccount)에 따라 수락 버튼이 보상이나 친구 맺기를 말한다',
    async ({ isNewAccount, label, hasNote }) => {
      // When
      await renderCard({ isNewAccount });

      // Then
      expect(await screen.findByTestId('invite-card-redeem')).toHaveTextContent(label);
      expect(
        screen.queryByText(
          '이미 아이두를 쓰고 있어서 바로 친구가 돼요. 프리미엄 보상은 새로 가입한 친구에게 드려요',
        ) != null,
      ).toBe(hasNote);
    },
  );

  it('수락하면 결과를 남기고 카드를 닫은 뒤 환영 시트를 연다', async () => {
    // Given
    const { httpClient, analytics, di } = await renderCard();

    // When
    await fireEvent.press(await screen.findByTestId('invite-card-redeem'));

    // Then
    await waitFor(() =>
      expect(router.dismissTo).toHaveBeenCalledWith(
        { pathname: '/invite-welcome/[friendId]', params: { friendId: INVITER_ID } },
        { withAnchor: true },
      ),
    );
    expect(httpClient.post).toHaveBeenCalledTimes(1);
    expect(httpClient.post).toHaveBeenCalledWith(REDEEM_PATH, expect.anything());
    expect(
      di.queryClient.getQueryData(INVITE_QUERY_KEYS.redemption({ inviterId: INVITER_ID })),
    ).toEqual(expect.objectContaining({ outcome: 'REDEEMED' }));
    expect(getTrackedEvents(analytics, 'invite_redeemed')).toEqual([
      { outcome: 'REDEEMED', friendship: 'FRIENDS' },
    ]);
  });

  it('이미 받은 초대를 다시 수락하면 환영 시트 없이 알리고 친구 할 일로 간다', async () => {
    // Given
    await renderCard({ redeem: ok(createRedeemResponseDto({ isReplay: true })) });

    // When
    await fireEvent.press(await screen.findByTestId('invite-card-redeem'));

    // Then
    expect(await screen.findByText('이미 받은 초대예요')).toBeOnTheScreen();
    expect(router.dismissTo).toHaveBeenCalledWith(
      { pathname: '/feed', params: { friendId: INVITER_ID } },
      { withAnchor: true },
    );
  });

  it('이미 친구면 환영 시트 없이 친구 할 일로 간다', async () => {
    // Given
    await renderCard({ redeem: ok(createRedeemResponseDto({ outcome: 'ALREADY_FRIENDS' })) });

    // When
    await fireEvent.press(await screen.findByTestId('invite-card-redeem'));

    // Then
    await waitFor(() =>
      expect(router.dismissTo).toHaveBeenCalledWith(
        { pathname: '/feed', params: { friendId: INVITER_ID } },
        { withAnchor: true },
      ),
    );
  });

  it('내 코드를 열었으면 수락 대신 내 초대 화면으로 보낸다', async () => {
    // Given
    const { analytics } = await renderCard({
      redeem: fail(createInviteApiError({ code: 'INVITE_2103', status: 400 })),
    });

    // When
    await fireEvent.press(await screen.findByTestId('invite-card-redeem'));

    // Then
    await waitFor(() =>
      expect(router.dismissTo).toHaveBeenCalledWith('/friends/invite', { withAnchor: true }),
    );
    expect(getTrackedEvents(analytics, 'invite_redeem_failed')).toEqual([{ reason: 'self' }]);
  });

  it.each([
    { code: 'INVITE_2104', reason: 'already_redeemed' },
    { code: 'INVITE_2106', reason: 'friend_limit' },
    { code: 'BLOCK_2204', reason: 'blocked' },
  ] satisfies ReadonlyArray<{ code: ErrorCodeType; reason: string }>)(
    '서버가 $code로 거절하면 한 번 알리고 카드에 남아 이유($reason)를 남긴다',
    async ({ code, reason }) => {
      // Given
      const error = createApiError(code, { status: 400 });
      const { analytics } = await renderCard({ redeem: fail(error) });

      // When
      await fireEvent.press(await screen.findByTestId('invite-card-redeem'));

      // Then
      expect(await screen.findAllByText(error.message)).toHaveLength(1);
      expect(router.dismissTo).not.toHaveBeenCalled();
      expect(screen.getByTestId('invite-card-redeem')).toBeEnabled();
      expect(getTrackedEvents(analytics, 'invite_redeem_failed')).toEqual([{ reason }]);
    },
  );

  it.each([
    { code: 'INVITE_2101', testID: 'invite-result-not-found' },
    { code: 'INVITE_2102', testID: 'invite-result-rotated' },
    { code: 'INVITE_2105', testID: 'invite-result-disabled' },
  ] satisfies ReadonlyArray<{ code: ErrorCodeType; testID: string }>)(
    '미리보기가 $code로 거절되면 그 이유의 안내만 보이고 수락 버튼을 두지 않는다',
    async ({ code, testID }) => {
      // When
      await renderCard({ preview: fail(createInviteApiError({ code, status: 404 })) });

      // Then
      expect(await screen.findByTestId(testID)).toBeOnTheScreen();
      expect(screen.queryByTestId('invite-card-redeem')).toBeNull();
    },
  );

  it('형식이 틀린 코드는 조회하지 않고 찾을 수 없다고 알린다', async () => {
    // When
    const { httpClient } = await renderCard({
      params: { inviteCode: 'K7M2Q0', source: 'universal_link' },
    });

    // Then
    expect(await screen.findByTestId('invite-result-not-found')).toBeOnTheScreen();
    expect(httpClient.get).not.toHaveBeenCalledWith(
      expect.stringMatching(/^v1\/invites\//u),
      expect.anything(),
    );
  });

  it('수락을 기다리는 동안 버튼을 다시 눌러도 수락 요청은 한 번이다', async () => {
    // Given
    const pending = createPendingResponse(ok(createRedeemResponseDto()));
    const { httpClient } = await renderCard({ redeem: () => pending.response });
    await fireEvent.press(await screen.findByTestId('invite-card-redeem'));
    await waitFor(() => expect(screen.getByTestId('invite-card-redeem')).toBeDisabled());

    // When
    await fireEvent.press(screen.getByTestId('invite-card-redeem'));
    pending.settle();

    // Then
    await waitFor(() => expect(router.dismissTo).toHaveBeenCalledTimes(1));
    expect(httpClient.post).toHaveBeenCalledTimes(1);
  });

  it('같은 프레임에 수락을 두 번 누르면 수락 요청이 한 번 나간다', async () => {
    // Given
    const pending = createPendingResponse(ok(createRedeemResponseDto()));
    const { httpClient } = await renderCard({ redeem: () => pending.response });
    const button = await screen.findByTestId('invite-card-redeem');

    // When
    await pressTwiceInSameFrame(button);
    await act(async () => {
      pending.settle();
    });

    // Then
    await waitFor(() => expect(router.dismissTo).toHaveBeenCalled());
    expect(httpClient.post).toHaveBeenCalledTimes(1);
  });

  it('시스템이 연 링크는 카드가 다시 그려져도 초대 링크 열림을 한 번만 남긴다', async () => {
    // Given
    const params = { inviteCode: INVITE_CODE, source: 'kakao', openedAt: '1000' };
    const { analytics, rendered } = await renderCard({ params });
    await screen.findByTestId('invite-card-redeem');

    // When
    await rendered.unmount();
    await renderScreen(<InviteCardScreen />, { di: rendered.di, withLocalDate: true });
    await screen.findByTestId('invite-card-redeem');

    // Then
    expect(getTrackedEvents(analytics, 'invite_link_opened')).toEqual([{ source: 'kakao' }]);
  });

  it('앱 안 코드 입력에서 넘어온 카드는 초대 링크 열림을 다시 남기지 않는다', async () => {
    // When
    const { analytics } = await renderCard({
      params: { inviteCode: INVITE_CODE, source: 'code_entry' },
    });
    await screen.findByTestId('invite-card-redeem');

    // Then
    expect(getTrackedEvents(analytics, 'invite_link_opened')).toEqual([]);
  });
});
