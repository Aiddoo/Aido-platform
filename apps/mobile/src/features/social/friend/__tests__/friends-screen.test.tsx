import '@src/shared/i18n/init';
import type { FriendsListResponse } from '@aido/api/contracts/follow/v1';
import type { ApiError } from '@src/core/errors/api-error';
import { ok, type Result } from '@src/core/errors/result';
import type { RequestConfig } from '@src/core/ports/http-client';
import { createEntitlementSnapshotDto } from '@src/features/billing/subscription/__tests__/entitlement.fixtures';
import {
  countGetRequests,
  findHostsWithProp,
} from '@src/features/planning/todo/__tests__/todo.test-utils';
import { NetworkError } from '@src/shared/errors/infra-error';
import {
  createAnalyticsStub,
  createHttpClientStub,
  createRouteParamsFake,
  createTestDi,
  respondByPath,
} from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { noop } from 'es-toolkit';

import FriendsScreen from '../../../../../app/(app)/(tabs)/(me,memos,todos)/friends/index';
import {
  createAcceptFriendRequestDto,
  createFriendsListDto,
  createReceivedRequestsDto,
  createSentRequestsDto,
} from './friend.fixtures';

const [HONG, NAMELESS] = createFriendsListDto().friends;
const RECEIVED = createReceivedRequestsDto();
const SENT = createSentRequestsDto();
const [RECEIVED_REQUEST] = RECEIVED.requests;
const [SENT_REQUEST] = SENT.requests;

const SECOND_PAGE_FRIEND = {
  id: 'clz7x5p8k0015qz0z8z8z8z8z',
  userTag: 'QRST7890',
  name: '다음쪽친구',
  profileImage: null,
  followId: 'clz7x5p8k0016qz0z8z8z8z8z',
  friendsSince: '2026-04-01T00:00:00.000Z',
};

type ServerResponse = Result<unknown, ApiError>;

interface FriendServer {
  friends?: FriendsListResponse;
  /** 첫 쪽 뒤에 이어 받는 쪽. 있으면 첫 쪽이 더 있다고 알린다 */
  nextFriendsPage?: FriendsListResponse;
}

/** 친구 화면이 읽는 서버. 끊은 친구와 처리한 요청은 다시 받을 때 빠진다 */
function createFriendServer({
  friends = createFriendsListDto(),
  nextFriendsPage,
}: FriendServer = {}) {
  const httpClient = createHttpClientStub();
  const pending = { received: true, sent: true };
  const removedFriendIds = new Set<string>();
  const listFriends = (): FriendsListResponse => {
    const remaining = friends.friends.filter((friend) => !removedFriendIds.has(friend.id));
    return {
      friends: remaining,
      totalCount: remaining.length,
      hasMore: nextFriendsPage != null,
    };
  };
  httpClient.get.mockImplementation((path: string, config?: RequestConfig) => {
    const isNextPage = config?.params?.cursor != null;
    return respondByPath({
      'v1/invites/availability': ok({ enabled: false }),
      'v1/entitlements': ok(createEntitlementSnapshotDto()),
      'v1/follows/friends': () =>
        Promise.resolve(
          ok(isNextPage && nextFriendsPage != null ? nextFriendsPage : listFriends()),
        ),
      'v1/follows/requests/received': () =>
        Promise.resolve(
          ok(pending.received ? RECEIVED : { ...RECEIVED, requests: [], totalCount: 0 }),
        ),
      'v1/follows/requests/sent': () =>
        Promise.resolve(ok(pending.sent ? SENT : { ...SENT, requests: [], totalCount: 0 })),
    })(path);
  });
  httpClient.patch.mockImplementation(async (path: string): Promise<ServerResponse> => {
    pending.received = false;
    return path.endsWith('/accept')
      ? ok(createAcceptFriendRequestDto())
      : ok({ message: '친구 요청을 거절했습니다.' });
  });
  httpClient.delete.mockImplementation(async (path: string): Promise<ServerResponse> => {
    const userId = path.replace('v1/follows/', '');
    if (userId === SENT_REQUEST?.id) {
      pending.sent = false;
    }
    removedFriendIds.add(userId);
    return ok({ message: '삭제했습니다.' });
  });

  return httpClient;
}

async function renderFriends({
  httpClient = createFriendServer(),
  params = {},
}: { httpClient?: ReturnType<typeof createFriendServer>; params?: Record<string, string> } = {}) {
  createRouteParamsFake(params);
  const analytics = createAnalyticsStub();
  await renderScreen(<FriendsScreen />, {
    di: createTestDi({ ports: { httpClient, analytics } }),
    withOverlay: true,
  });

  return { httpClient, analytics };
}

function countEvents(analytics: ReturnType<typeof createAnalyticsStub>, eventName: string) {
  return analytics.trackEvent.mock.calls.filter(([name]) => name === eventName).length;
}

/** 가상 목록은 잰 높이와 스크롤 위치로 끝을 판단한다. 목록 높이만큼 내용이 있고 끝까지 내렸다고 알린다 */
async function scrollToListEnd() {
  const [scroll] = findHostsWithProp('refreshControl');
  if (scroll == null) {
    throw new Error('친구 목록 스크롤이 없습니다');
  }
  const size = { width: 390, height: 600 };
  await fireEvent(scroll, 'layout', { nativeEvent: { layout: { x: 0, y: 0, ...size } } });
  await fireEvent(scroll, 'contentSizeChange', size.width, size.height);
  await fireEvent.scroll(scroll, {
    nativeEvent: {
      contentOffset: { x: 0, y: 0 },
      contentSize: size,
      layoutMeasurement: size,
    },
  });
}

async function startEditing() {
  await fireEvent.press(await screen.findByRole('button', { name: '편집' }));
}

async function openRemoveDialog(deleteButton: ReturnType<typeof screen.getByTestId>) {
  await act(async () => {
    // 누른 동작은 다이얼로그의 답을 기다리는 동안 끝나지 않아 기다리지 않는다
    fireEvent.press(deleteButton).catch(() => undefined);
  });
  await screen.findByText('홍길동님을 친구에서 삭제할까요?');
}

describe('FriendsScreen', () => {
  it('처음 열면 친구 목록과 초대 가능 여부를 한 번씩만 받는다', async () => {
    // Given
    const httpClient = createFriendServer();

    // When
    await renderFriends({ httpClient });

    // Then
    expect(await screen.findByText('홍길동')).toBeOnTheScreen();
    expect(countGetRequests(httpClient)).toEqual({
      'v1/follows/friends': 1,
      'v1/invites/availability': 1,
    });
  });

  it('편집을 누르면 행마다 삭제가 나오고 완료를 누르면 사라진다', async () => {
    // Given
    await renderFriends();
    await screen.findByText('홍길동');

    // When
    await startEditing();

    // Then
    expect(await screen.findAllByTestId('friend-delete')).toHaveLength(2);
    expect(screen.queryByRole('button', { name: '편집' })).toBeNull();

    // When
    await fireEvent.press(screen.getByRole('button', { name: '완료' }));

    // Then
    await waitFor(() => expect(screen.queryAllByTestId('friend-delete')).toHaveLength(0));
    expect(screen.getByRole('button', { name: '편집' })).toBeOnTheScreen();
  });

  it('친구를 삭제하면 그 친구를 끊는 요청을 한 번 보내고 목록에서 뺀다', async () => {
    // Given
    const { httpClient, analytics } = await renderFriends();
    await screen.findByText('홍길동');
    await startEditing();
    const [hongDelete] = await screen.findAllByTestId('friend-delete');
    if (hongDelete == null) {
      throw new Error('삭제 버튼이 없습니다');
    }
    await openRemoveDialog(hongDelete);

    // When
    await fireEvent.press(screen.getByTestId('friend-delete-confirm'));

    // Then
    await waitFor(() => expect(screen.queryByText('홍길동')).toBeNull());
    expect(httpClient.delete).toHaveBeenCalledTimes(1);
    expect(httpClient.delete).toHaveBeenCalledWith(`v1/follows/${HONG?.id}`);
    expect(screen.getByText('총 1명')).toBeOnTheScreen();
    expect(countEvents(analytics, 'friend_removed')).toBe(1);
  });

  it('삭제 요청이 실패하면 그 친구를 원래 자리에 되돌린다', async () => {
    // Given
    const httpClient = createFriendServer();
    httpClient.delete.mockRejectedValue(new NetworkError());
    const { analytics } = await renderFriends({ httpClient });
    await screen.findByText('홍길동');
    await startEditing();
    const [hongDelete] = await screen.findAllByTestId('friend-delete');
    if (hongDelete == null) {
      throw new Error('삭제 버튼이 없습니다');
    }
    await openRemoveDialog(hongDelete);
    // 실패 뒤 다시 받기는 끝나지 않게 둬 화면의 친구가 되돌린 캐시에서 온 것인지 본다
    httpClient.get.mockReturnValue(new Promise(noop));

    // When
    await fireEvent.press(screen.getByTestId('friend-delete-confirm'));

    // Then
    expect(await screen.findAllByText(new NetworkError().message)).not.toHaveLength(0);
    expect(screen.getByText('홍길동')).toBeOnTheScreen();
    expect(screen.getByText('총 2명')).toBeOnTheScreen();
    expect(countEvents(analytics, 'friend_removed')).toBe(0);
    await fireEvent.press(screen.getByRole('button', { name: '취소' }));
  });

  it('목록 끝에 닿으면 마지막 친구 뒤부터 다음 쪽을 받아 이어 붙인다', async () => {
    // Given
    const httpClient = createFriendServer({
      nextFriendsPage: createFriendsListDto({
        friends: [SECOND_PAGE_FRIEND],
        totalCount: 3,
        hasMore: false,
      }),
    });
    await renderFriends({ httpClient });
    await screen.findByText('홍길동');

    // When
    await scrollToListEnd();

    // Then
    expect(await screen.findByText('다음쪽친구')).toBeOnTheScreen();
    expect(httpClient.get).toHaveBeenCalledWith(
      'v1/follows/friends',
      expect.objectContaining({ params: { cursor: NAMELESS?.followId, limit: undefined } }),
    );
    expect(countGetRequests(httpClient)['v1/follows/friends']).toBe(2);
  });

  it('받은 요청을 수락하면 수락 요청을 보내고 알린 뒤 목록에서 뺀다', async () => {
    // Given
    const { httpClient, analytics } = await renderFriends();
    await screen.findByText('홍길동');
    await fireEvent.press(screen.getByText('받은 요청'));
    await screen.findByText('김철수');

    // When
    await fireEvent.press(screen.getByRole('button', { name: '수락' }));

    // Then
    await waitFor(() => expect(screen.queryByText('김철수')).toBeNull());
    expect(httpClient.patch).toHaveBeenCalledTimes(1);
    expect(httpClient.patch).toHaveBeenCalledWith(`v1/follows/${RECEIVED_REQUEST?.id}/accept`);
    expect(await screen.findAllByText('친구 요청을 수락했어요')).not.toHaveLength(0);
    expect(screen.getByText('아직 받은 요청이 없어요')).toBeOnTheScreen();
    expect(countEvents(analytics, 'friend_request_accepted')).toBe(1);
  });

  it('받은 요청을 거절하면 거절 요청을 보내고 알린 뒤 목록에서 뺀다', async () => {
    // Given
    const { httpClient, analytics } = await renderFriends({ params: { view: 'receiver' } });
    await screen.findByText('김철수');

    // When
    await fireEvent.press(screen.getByRole('button', { name: '거절' }));

    // Then
    await waitFor(() => expect(screen.queryByText('김철수')).toBeNull());
    expect(httpClient.patch).toHaveBeenCalledTimes(1);
    expect(httpClient.patch).toHaveBeenCalledWith(`v1/follows/${RECEIVED_REQUEST?.id}/reject`);
    expect(await screen.findAllByText('친구 요청을 거절했어요')).not.toHaveLength(0);
    expect(countEvents(analytics, 'friend_request_rejected')).toBe(1);
  });

  it('보낸 요청을 취소하면 취소 요청을 보내고 목록에서 뺀다', async () => {
    // Given
    const { httpClient, analytics } = await renderFriends({ params: { view: 'sender' } });
    await screen.findByText('이영희');

    // When
    await fireEvent.press(screen.getByRole('button', { name: '취소' }));

    // Then
    await waitFor(() => expect(screen.queryByText('이영희')).toBeNull());
    expect(httpClient.delete).toHaveBeenCalledTimes(1);
    expect(httpClient.delete).toHaveBeenCalledWith(`v1/follows/${SENT_REQUEST?.id}`);
    expect(screen.getByText('아직 보낸 요청이 없어요')).toBeOnTheScreen();
    expect(countEvents(analytics, 'friend_request_cancelled')).toBe(1);
  });

  it('친구 탭을 떠나면 편집을 함께 끈다', async () => {
    // Given
    await renderFriends({ params: { isEditing: 'true' } });
    expect(await screen.findAllByTestId('friend-delete')).toHaveLength(2);

    // When
    await fireEvent.press(screen.getByText('보낸 요청'));
    await screen.findByText('이영희');
    await fireEvent.press(screen.getByText('친구 목록'));

    // Then
    expect(await screen.findByText('홍길동')).toBeOnTheScreen();
    expect(screen.queryAllByTestId('friend-delete')).toHaveLength(0);
  });
});
