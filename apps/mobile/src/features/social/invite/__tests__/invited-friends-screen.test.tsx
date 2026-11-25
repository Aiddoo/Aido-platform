import '@src/shared/i18n/init';
import { INVITE_QUALIFICATION } from '@aido/api/vocabulary';
import { ok } from '@src/core/errors/result';
import type { RequestConfig } from '@src/core/ports/http-client';
import { countGetRequests } from '@src/features/planning/todo/__tests__/todo.test-utils';
import { createFriendsListDto } from '@src/features/social/friend/__tests__/friend.fixtures';
import { createNudgeCooldownInfoDto } from '@src/features/social/nudge/__tests__/todo-nudge.fixtures';
import {
  createHttpClientStub,
  createRouteParamsFake,
  createTestDi,
  respondByPath,
} from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import InvitedFriendsScreen from '../../../../../app/(app)/(tabs)/(me,memos,todos)/friends/invite/invitees';
import { createInviteDto, createInvitedFriendDto } from './invite.fixtures';

/** 내 친구 목록(`createFriendsListDto`의 첫 친구)에 있는 사람. 발자국을 기다리면 콕 찌를 수 있다 */
const FRIEND_ID = 'clz7x5p8k0005qz0z8z8z8z8z';
const NOT_FRIEND_ID = 'clz7x5p8k0020qz0z8z8z8z8z';

const STARTED_FRIEND = createInvitedFriendDto({
  userId: FRIEND_ID,
  name: '준호',
  userTag: 'B7TZ2NPD',
  status: 'JOINED',
  activeDayCount: 1,
});
const NOT_STARTED = createInvitedFriendDto({
  userId: NOT_FRIEND_ID,
  name: '서연',
  userTag: 'C8UA3PQE',
  status: 'JOINED',
  activeDayCount: 0,
});
const STAMPED = createInvitedFriendDto({
  userId: 'clz7x5p8k0021qz0z8z8z8z8z',
  name: '하준',
  userTag: 'D9VB4RSF',
  status: 'QUALIFIED',
  activeDayCount: 2,
  qualifiedAt: '2026-11-04T10:00:00.000Z',
});
const EXPIRED = createInvitedFriendDto({
  userId: 'clz7x5p8k0022qz0z8z8z8z8z',
  name: '지우',
  userTag: 'E2WC5TUG',
  status: 'REJECTED',
  activeDayCount: 0,
  rejectionReason: 'EXPIRED',
});
const MONTHLY_CAPPED = createInvitedFriendDto({
  userId: 'clz7x5p8k0023qz0z8z8z8z8z',
  name: '도윤',
  userTag: 'F3XD6VWH',
  status: 'REJECTED',
  activeDayCount: 2,
  rejectionReason: 'INVITER_MONTHLY_CAP',
});

const ALL_INVITEES = [STARTED_FRIEND, NOT_STARTED, STAMPED, EXPIRED, MONTHLY_CAPPED];
const COOLDOWN_PATH = `v1/nudges/remind/cooldown/${FRIEND_ID}`;

interface ServerOptions {
  /** 발자국 대기(JOINED) 목록 */
  waiting?: typeof ALL_INVITEES;
}

function createInviteesServer({ waiting = [STARTED_FRIEND, NOT_STARTED] }: ServerOptions = {}) {
  const httpClient = createHttpClientStub();
  httpClient.get.mockImplementation(async (path: string, config?: RequestConfig) => {
    if (path === 'v1/invites/me/invitees') {
      const items = config?.params?.status === 'JOINED' ? waiting : ALL_INVITEES;
      return ok({ items, totalCount: items.length, hasMore: false });
    }
    return respondByPath({
      'v1/invites/me': ok(createInviteDto({ waitingCount: waiting.length })),
      'v1/follows/friends': ok(createFriendsListDto()),
      [COOLDOWN_PATH]: ok(createNudgeCooldownInfoDto({ canNudge: true })),
    })(path);
  });
  return httpClient;
}

async function renderInvitees({
  params = {},
  httpClient = createInviteesServer(),
}: {
  params?: Record<string, string>;
  httpClient?: ReturnType<typeof createInviteesServer>;
} = {}) {
  createRouteParamsFake(params);
  await renderScreen(<InvitedFriendsScreen />, {
    di: createTestDi({ ports: { httpClient } }),
    withLocalDate: true,
  });

  return { httpClient };
}

describe('초대한 친구 화면', () => {
  it('처음 열면 초대 요약과 전체 목록을 한 번씩 받고, 친구 목록은 한 번, 쿨다운은 내 친구인 대기 친구만 묻는다', async () => {
    // When
    const { httpClient } = await renderInvitees();
    await screen.findByLabelText(/준호에게 콕 찌르러 가기/u);

    // Then
    expect(countGetRequests(httpClient)).toEqual({
      'v1/invites/me': 1,
      'v1/invites/me/invitees': 1,
      'v1/follows/friends': 1,
      [COOLDOWN_PATH]: 1,
    });
    // 쿨다운은 친구인지 안 뒤에만 묻는다
    const requestedPaths = httpClient.get.mock.calls.map(([path]) => path);
    expect(requestedPaths.indexOf('v1/follows/friends')).toBeLessThan(
      requestedPaths.indexOf(COOLDOWN_PATH),
    );
  });

  it('행마다 발자국 상태를 알린다', async () => {
    // When
    await renderInvitees();

    // Then
    expect(
      await screen.findByText(
        `할 일을 시작했어요. ${INVITE_QUALIFICATION.MIN_ACTIVE_DAYS - 1}일만 더 끝내면 발자국이 찍혀요`,
      ),
    ).toBeOnTheScreen();
    expect(
      screen.getByText(
        `${INVITE_QUALIFICATION.MIN_ACTIVE_DAYS}일 동안 할 일을 끝내면 발자국이 찍혀요`,
      ),
    ).toBeOnTheScreen();
    expect(
      screen.getByLabelText(`${INVITE_QUALIFICATION.MIN_ACTIVE_DAYS}일만 더 하면 발자국이 찍혀요`),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText('발자국이 찍혔어요')).toBeOnTheScreen();
    expect(
      screen.getByText(
        `가입하고 ${INVITE_QUALIFICATION.EXPIRE_AFTER_DAYS}일이 지나서 이번에는 발자국이 찍히지 않았어요`,
      ),
    ).toBeOnTheScreen();
    expect(
      screen.getByText('보상 한도를 다 채워서 이번에는 발자국이 찍히지 않았어요'),
    ).toBeOnTheScreen();
  });

  it('콕 찌를 수 있는 친구의 버튼을 누르면 그 친구에게 보내는 콕 시트를 연다', async () => {
    // Given
    await renderInvitees();

    // When
    await fireEvent.press(await screen.findByLabelText(/준호에게 콕 찌르러 가기/u));

    // Then
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/users/[userId]/nudge',
      params: { userId: FRIEND_ID, name: '준호' },
    });
  });

  it('쿨다운 중인 친구는 콕 버튼 대신 남은 일수를 보인다', async () => {
    // Given
    const httpClient = createInviteesServer();
    const fallback = httpClient.get.getMockImplementation();
    httpClient.get.mockImplementation(async (path: string, config?: RequestConfig) =>
      path === COOLDOWN_PATH
        ? ok(createNudgeCooldownInfoDto({ canNudge: false, remainingSeconds: 600 }))
        : (fallback?.(path, config) ?? ok(null)),
    );

    // When
    await renderInvitees({ httpClient });

    // Then
    await waitFor(() => expect(countGetRequests(httpClient)[COOLDOWN_PATH]).toBe(1));
    expect(
      await screen.findByLabelText(
        `${INVITE_QUALIFICATION.MIN_ACTIVE_DAYS - 1}일만 더 하면 발자국이 찍혀요`,
      ),
    ).toBeOnTheScreen();
    expect(screen.queryByLabelText(/준호에게 콕 찌르러 가기/u)).toBeNull();
  });

  it('발자국 대기 탭으로 바꾸면 대기 친구만 다시 받는다', async () => {
    // Given
    const { httpClient } = await renderInvitees();
    await screen.findByText('하준');

    // When
    await fireEvent.press(screen.getByTestId('invitees-tab-waiting'));

    // Then
    await waitFor(() => expect(screen.queryByText('하준')).toBeNull());
    expect(screen.getByText('준호')).toBeOnTheScreen();
    expect(screen.getByText('서연')).toBeOnTheScreen();
    expect(
      httpClient.get.mock.calls.filter(
        ([path, config]) =>
          path === 'v1/invites/me/invitees' && config?.params?.status === 'JOINED',
      ),
    ).toHaveLength(1);
  });

  it('기다리는 친구가 없으면 대기 탭에 빈 안내를 보인다', async () => {
    // When
    await renderInvitees({
      params: { view: 'waiting' },
      httpClient: createInviteesServer({ waiting: [] }),
    });

    // Then
    expect(await screen.findByText('발자국을 기다리는 친구가 없어요')).toBeOnTheScreen();
  });
});
