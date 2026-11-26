import '@src/shared/i18n/init';
import {
  INVITE_QUALIFICATION,
  INVITEE_REWARDS,
  INVITER_REWARD_MILESTONES,
  REWARD_TYPE,
} from '@aido/api/vocabulary';
import type { ApiError } from '@src/core/errors/api-error';
import { fail, ok, type Result } from '@src/core/errors/result';
import { createCurrentUserDto } from '@src/features/identity/user/__tests__/user.fixtures';
import { countGetRequests } from '@src/features/planning/todo/__tests__/todo.test-utils';
import { ServerError } from '@src/shared/errors/infra-error';
import {
  createAnalyticsStub,
  createApiError,
  createClipboardGatewayStub,
  createHttpClientStub,
  createSocialShareGatewayStub,
  createSystemShareGatewayStub,
  createTestDi,
  respondByPath,
} from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { sumBy } from 'es-toolkit';

import MyInviteScreen from '../../../../../app/(app)/(tabs)/(me,memos,todos)/friends/invite/index';
import { createInviteDto, createInvitedFriendDto } from './invite.fixtures';

const MY_INVITE = createInviteDto({ qualifiedCount: 2, waitingCount: 1 });
const ME = createCurrentUserDto({ name: '민지' });

function sumPremiumDays(rewards: ReadonlyArray<{ rewardType: string; quantity: number }>) {
  return sumBy(
    rewards.filter(({ rewardType }) => rewardType === REWARD_TYPE.PREMIUM_DAYS),
    ({ quantity }) => quantity,
  );
}

/** 친구가 가입하면 받는 프리미엄 일수(공유 문구·보상 줄의 숫자) */
const INVITEE_PREMIUM_DAYS = sumPremiumDays(INVITEE_REWARDS);

type InviteResponse = Result<unknown, ApiError> | (() => Promise<Result<unknown, ApiError>>);

function createMyInviteServer({ invite = ok(MY_INVITE) }: { invite?: InviteResponse } = {}) {
  const httpClient = createHttpClientStub();
  httpClient.get.mockImplementation(
    respondByPath({
      'v1/invites/me': invite,
      'v1/auth/me': ok(ME),
      'v1/invites/availability': ok({ enabled: true }),
      'v1/invites/me/invitees': ok({
        items: [
          createInvitedFriendDto({ status: 'QUALIFIED', qualifiedAt: '2026-11-04T10:00:00.000Z' }),
        ],
        totalCount: 1,
        hasMore: false,
      }),
    }),
  );
  return httpClient;
}

async function renderMyInvite(httpClient = createMyInviteServer()) {
  const analytics = createAnalyticsStub();
  const socialShare = createSocialShareGatewayStub();
  const systemShare = createSystemShareGatewayStub();
  const clipboard = createClipboardGatewayStub();
  await renderScreen(<MyInviteScreen />, {
    di: createTestDi({ ports: { httpClient, analytics, socialShare, systemShare, clipboard } }),
    withLocalDate: true,
    withOverlay: true,
  });
  await screen.findByTestId('my-invite-code');

  return { httpClient, analytics, socialShare, systemShare, clipboard };
}

function countEvents(analytics: ReturnType<typeof createAnalyticsStub>, eventName: string) {
  return analytics.trackEvent.mock.calls.filter(([name]) => name === eventName);
}

describe('MyInviteScreen', () => {
  it('처음 열면 초대·내 정보·초대한 친구를 한 번씩만 받는다', async () => {
    // When
    const { httpClient } = await renderMyInvite();
    await screen.findByText('준호');

    // Then
    expect(countGetRequests(httpClient)).toEqual({
      'v1/invites/me': 1,
      'v1/auth/me': 1,
      'v1/invites/me/invitees': 1,
    });
  });

  it('카카오톡으로 초대하면 내 링크와 이름이 든 공유 문구를 넘기고 공유를 한 번 남긴다', async () => {
    // Given
    const { socialShare, analytics } = await renderMyInvite();

    // When
    await fireEvent.press(await screen.findByTestId('invite-share-kakao'));

    // Then
    await waitFor(() => expect(socialShare.shareFeed).toHaveBeenCalledTimes(1));
    expect(socialShare.shareFeed).toHaveBeenCalledWith(
      expect.objectContaining({
        title: '민지님이 아이두에 초대했어요',
        description: `가입하면 바로 친구가 되고 프리미엄 ${INVITEE_PREMIUM_DAYS}일을 받아요`,
        webUrl: MY_INVITE.link,
        appLinkParams: { inviteCode: MY_INVITE.code },
      }),
    );
    await waitFor(() =>
      expect(countEvents(analytics, 'invite_link_shared')).toEqual([
        ['invite_link_shared', { channel: 'kakao' }],
      ]),
    );
  });

  it('다른 앱으로 공유하면 OS 공유 시트에 링크와 문구를 넘기고 공유를 한 번 남긴다', async () => {
    // Given
    const { systemShare, analytics } = await renderMyInvite();

    // When
    await fireEvent.press(await screen.findByTestId('invite-share-system'));

    // Then
    await waitFor(() => expect(systemShare.share).toHaveBeenCalledTimes(1));
    expect(systemShare.share).toHaveBeenCalledWith({
      message: `아이두에서 같이 할 일을 해요! 가입하면 프리미엄 ${INVITEE_PREMIUM_DAYS}일을 받아요.`,
      url: MY_INVITE.link,
      dialogTitle: '초대 링크 보내기',
    });
    await waitFor(() =>
      expect(countEvents(analytics, 'invite_link_shared')).toEqual([
        ['invite_link_shared', { channel: 'system' }],
      ]),
    );
  });

  it('OS 공유 시트를 닫기만 하면 공유를 남기지 않는다', async () => {
    // Given
    const setup = await renderMyInvite();
    setup.systemShare.share.mockResolvedValue(false);

    // When
    await fireEvent.press(await screen.findByTestId('invite-share-system'));

    // Then
    await waitFor(() => expect(setup.systemShare.share).toHaveBeenCalledTimes(1));
    expect(countEvents(setup.analytics, 'invite_link_shared')).toEqual([]);
  });

  it('링크를 복사하면 내 링크를 클립보드에 넣고 복사했다고 알리며 공유를 한 번 남긴다', async () => {
    // Given
    const { clipboard, analytics } = await renderMyInvite();

    // When
    await fireEvent.press(await screen.findByTestId('invite-share-copy-link'));

    // Then
    await waitFor(() => expect(clipboard.copy).toHaveBeenCalledWith(MY_INVITE.link));
    expect(await screen.findByText('링크를 복사했어요')).toBeOnTheScreen();
    expect(countEvents(analytics, 'invite_link_shared')).toEqual([
      ['invite_link_shared', { channel: 'copy_link' }],
    ]);
  });

  it('코드 옆 복사 버튼도 같은 링크를 복사한다', async () => {
    // Given
    const { clipboard } = await renderMyInvite();

    // When
    await fireEvent.press(screen.getByRole('button', { name: '초대 링크 복사' }));

    // Then
    await waitFor(() => expect(clipboard.copy).toHaveBeenCalledWith(MY_INVITE.link));
  });

  it('툴바 공유 버튼은 OS 공유 시트로 같은 내용을 넘긴다', async () => {
    // Given
    const { systemShare } = await renderMyInvite();

    // When
    await fireEvent.press(await screen.findByRole('button', { name: '초대 링크 공유' }));

    // Then
    await waitFor(() =>
      expect(systemShare.share).toHaveBeenCalledWith(
        expect.objectContaining({ url: MY_INVITE.link }),
      ),
    );
  });

  it('보상 줄과 발자국 판은 정해 둔 보상과 서버가 센 발자국 수를 보인다', async () => {
    // When
    await renderMyInvite();

    // Then
    expect(screen.getByText(`가입하면 바로 프리미엄 ${INVITEE_PREMIUM_DAYS}일`)).toBeOnTheScreen();
    expect(
      screen.getByText(
        `친구가 ${INVITE_QUALIFICATION.MIN_ACTIVE_DAYS}일 동안 할 일을 끝내면 프리미엄 ${sumPremiumDays(INVITER_REWARD_MILESTONES[0].rewards)}일 + 친구 1⁠명 더`,
      ),
    ).toBeOnTheScreen();
    expect(
      await screen.findByText(`1번째 판 · 지금까지 발자국 ${MY_INVITE.qualifiedCount}개`),
    ).toBeOnTheScreen();
    expect(
      screen.getByText(
        `친구가 ${INVITE_QUALIFICATION.MIN_ACTIVE_DAYS}일 동안 할 일을 끝내면 발자국이 찍혀요. 발자국마다 나는 프리미엄 ${sumPremiumDays(MY_INVITE.nextMilestone?.rewards ?? [])}일을 받고, 친구를 1명 더 추가할 수 있어요`,
      ),
    ).toBeOnTheScreen();
  });

  it('초대가 꺼져 있으면 코드·공유·발자국 자리마다 쓸 수 없음을 알리고 공유를 막는다', async () => {
    // Given
    const httpClient = createMyInviteServer({
      invite: fail(createApiError('INVITE_2105', { status: 403 })),
    });

    // When
    await renderScreen(<MyInviteScreen />, {
      di: createTestDi({ ports: { httpClient } }),
      withLocalDate: true,
      withOverlay: true,
    });

    // Then
    expect(await screen.findByText('지금은 친구 초대를 쓸 수 없어요')).toBeOnTheScreen();
    expect(screen.getByText('초대가 다시 열리면 발자국을 이어서 모을 수 있어요')).toBeOnTheScreen();
    expect(screen.getByTestId('invite-share-kakao')).toBeDisabled();
    expect(screen.queryByText('초대 정보를 불러오지 못했어요')).toBeNull();
  });

  it('초대를 불러오지 못하면 한 곳에서 다시 시도하게 하고 누르면 다시 받는다', async () => {
    // Given
    const httpClient = createMyInviteServer({
      invite: () => Promise.reject(new ServerError(500)),
    });
    await renderScreen(<MyInviteScreen />, {
      di: createTestDi({ ports: { httpClient } }),
      withLocalDate: true,
      withOverlay: true,
    });
    expect(await screen.findAllByText('초대 정보를 불러오지 못했어요')).toHaveLength(1);
    httpClient.get.mockImplementation(
      respondByPath({
        'v1/invites/me': ok(MY_INVITE),
        'v1/auth/me': ok(ME),
        'v1/invites/me/invitees': ok({ items: [], totalCount: 0, hasMore: false }),
      }),
    );

    // When
    await fireEvent.press(screen.getByRole('button', { name: '다시 시도' }));

    // Then
    expect(await screen.findByTestId('my-invite-code')).toHaveTextContent(MY_INVITE.code);
  });
});
