import '@src/shared/i18n/init';
import { ErrorCode } from '@aido/api/errors';
import { fail, ok } from '@src/core/errors/result';
import { createEntitlementSnapshotDto } from '@src/features/billing/subscription/__tests__/entitlement.fixtures';
import { countGetRequests } from '@src/features/planning/todo/__tests__/todo.test-utils';
import {
  createAnalyticsStub,
  createApiError,
  createHttpClientStub,
  createPendingResponse,
  createTestDi,
  respondByPath,
  getTrackedEvents,
} from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { setupFakeTimersPerTest } from '@src/testing/timers';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import SearchFriendScreen from '../../../../../app/(app)/(tabs)/(me,memos,todos)/friends/search';
import {
  createSearchUsersDto,
  createSendFriendRequestDto,
  createSentRequestsDto,
} from './friend.fixtures';

const SEARCH_DEBOUNCE_MS = 300;
const SEARCH_PATH = 'v1/follows/search';
const [ADDABLE, PENDING] = createSearchUsersDto().items;

function createSearchServer({ isInviteAvailable = false }: { isInviteAvailable?: boolean } = {}) {
  const httpClient = createHttpClientStub();
  httpClient.get.mockImplementation(
    respondByPath({
      'v1/invites/availability': ok({ enabled: isInviteAvailable }),
      'v1/entitlements': ok(createEntitlementSnapshotDto()),
      [SEARCH_PATH]: ok(createSearchUsersDto()),
      'v1/follows/requests/sent': ok(createSentRequestsDto()),
    }),
  );

  return httpClient;
}

async function renderSearch(httpClient = createSearchServer()) {
  const analytics = createAnalyticsStub();
  await renderScreen(<SearchFriendScreen />, {
    di: createTestDi({ ports: { httpClient, analytics } }),
    withLocalDate: true,
    withOverlay: true,
  });

  return { httpClient, analytics };
}

async function typeQuery(query: string) {
  await fireEvent.changeText(screen.getByRole('search'), query);
}

async function waitForDebounce() {
  await act(() => jest.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS));
}

describe('SearchFriendScreen', () => {
  setupFakeTimersPerTest();

  it('입력이 멈추고 300ms가 지나면 마지막 검색어로 한 번만 찾고 검색을 한 번 남긴다', async () => {
    // Given
    const { httpClient, analytics } = await renderSearch();
    await typeQuery('홍');
    await typeQuery('홍길');
    await act(() => jest.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS - 1));
    expect(countGetRequests(httpClient)[SEARCH_PATH]).toBeUndefined();

    // When
    await typeQuery(' 홍길동 ');
    await waitForDebounce();

    // Then
    expect(await screen.findByText('#ABCD1234')).toBeOnTheScreen();
    expect(countGetRequests(httpClient)[SEARCH_PATH]).toBe(1);
    expect(httpClient.get).toHaveBeenCalledWith(
      SEARCH_PATH,
      expect.objectContaining({ params: { q: '홍길동', cursor: undefined, limit: undefined } }),
    );
    expect(getTrackedEvents(analytics, 'friend_search_submitted')).toHaveLength(1);
  });

  it.each(['홍', '  홍  ', ''])(
    '두 글자가 안 되는 검색어(%j)는 찾지 않고 태그로 추가하는 길을 안내한다',
    async (query) => {
      // Given
      const { httpClient, analytics } = await renderSearch();

      // When
      await typeQuery(query);
      await waitForDebounce();

      // Then
      expect(screen.getByText('이름이나 해시태그로 친구를 찾아보세요')).toBeOnTheScreen();
      expect(countGetRequests(httpClient)[SEARCH_PATH]).toBeUndefined();
      expect(getTrackedEvents(analytics, 'friend_search_submitted')).toHaveLength(0);
    },
  );

  it('처음 열면 초대 가능 여부만 받는다', async () => {
    // Given
    const httpClient = createSearchServer();

    // When
    await renderSearch(httpClient);

    // Then
    await waitFor(() =>
      expect(countGetRequests(httpClient)).toEqual({ 'v1/invites/availability': 1 }),
    );
  });

  it('결과에서 추가를 누르면 그 사람의 태그로 요청을 한 번 보내고 요청 취소로 바꾼다', async () => {
    // Given
    const httpClient = createSearchServer();
    httpClient.post.mockResolvedValue(ok(createSendFriendRequestDto()));
    const { analytics } = await renderSearch(httpClient);
    await typeQuery('홍길동');
    await waitForDebounce();
    const [addButton] = await screen.findAllByRole('button', { name: '추가' });
    if (addButton == null) {
      throw new Error('추가 버튼이 없습니다');
    }
    const cancelCountBefore = screen.getAllByRole('button', { name: '요청 취소' }).length;

    // When
    await fireEvent.press(addButton);

    // Then
    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: '요청 취소' })).toHaveLength(
        cancelCountBefore + 1,
      ),
    );
    expect(httpClient.post).toHaveBeenCalledTimes(1);
    expect(httpClient.post).toHaveBeenCalledWith(`v1/follows/${ADDABLE?.userTag}`);
    expect(getTrackedEvents(analytics, 'friend_request_sent')).toHaveLength(1);
  });

  it('요청 대기 중인 사람의 요청 취소를 누르면 그 사람에게 보낸 요청을 거둔다', async () => {
    // Given
    const httpClient = createSearchServer();
    httpClient.delete.mockResolvedValue(ok({ message: '친구 요청을 철회했습니다.' }));
    const { analytics } = await renderSearch(httpClient);
    await typeQuery('홍길동');
    await waitForDebounce();

    // When
    await fireEvent.press(await screen.findByRole('button', { name: '요청 취소' }));

    // Then
    await waitFor(() => expect(screen.queryByRole('button', { name: '요청 취소' })).toBeNull());
    expect(httpClient.delete).toHaveBeenCalledTimes(1);
    expect(httpClient.delete).toHaveBeenCalledWith(`v1/follows/${PENDING?.id}`);
    expect(getTrackedEvents(analytics, 'friend_request_cancelled')).toHaveLength(1);
  });

  it('친구 한도에 걸리면 초대로 자리를 늘리는 길을 안내하고 누르면 내 초대 화면을 연다', async () => {
    // Given
    const httpClient = createSearchServer({ isInviteAvailable: true });
    httpClient.post.mockResolvedValue(
      fail(
        createApiError(ErrorCode.FOLLOW_0909, {
          message: '친구 한도',
          details: { current: 7, limit: 7 },
        }),
      ),
    );
    const { analytics } = await renderSearch(httpClient);
    await typeQuery('홍길동');
    await waitForDebounce();
    const [addButton] = await screen.findAllByRole('button', { name: '추가' });
    if (addButton == null) {
      throw new Error('추가 버튼이 없습니다');
    }
    await fireEvent.press(addButton);

    // When
    await fireEvent.press(await screen.findByText('친구 초대하고 1명 더 추가하기'));

    // Then
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/friends/invite'));
    expect(getTrackedEvents(analytics, 'friend_request_sent')).toHaveLength(0);
    expect(getTrackedEvents(analytics, 'invite_entry_tapped')).toEqual([
      { entry: 'friend_limit_dialog' },
    ]);
  });

  it('요청을 보낸 뒤 그 행이 사라져도 친구 한도에 걸리면 한도를 안내한다', async () => {
    // Given
    const httpClient = createSearchServer({ isInviteAvailable: true });
    const pending = createPendingResponse(
      fail(
        createApiError(ErrorCode.FOLLOW_0909, {
          message: '친구 한도',
          details: { current: 7, limit: 7 },
        }),
      ),
    );
    httpClient.post.mockReturnValue(pending.response);
    await renderSearch(httpClient);
    await typeQuery('홍길동');
    await waitForDebounce();
    const [addButton] = await screen.findAllByRole('button', { name: '추가' });
    if (addButton == null) {
      throw new Error('추가 버튼이 없습니다');
    }
    await fireEvent.press(addButton);
    // 검색어를 지워 결과 행이 내려간다
    await typeQuery('');
    expect(screen.queryByRole('button', { name: '추가' })).toBeNull();

    // When
    await act(async () => {
      pending.settle();
    });

    // Then
    expect(await screen.findByText('친구 초대하고 1명 더 추가하기')).toBeOnTheScreen();
    expect(httpClient.post).toHaveBeenCalledTimes(1);
  });
});
