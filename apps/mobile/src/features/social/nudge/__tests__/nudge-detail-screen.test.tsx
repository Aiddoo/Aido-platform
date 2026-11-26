import '@src/shared/i18n/init';
import type { NudgeReplyKind } from '@aido/api/vocabulary';
import type { ApiError } from '@src/core/errors/api-error';
import { fail, ok, type Result } from '@src/core/errors/result';
import { createCurrentUserDto } from '@src/features/identity/user/__tests__/user.fixtures';
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
import { pressTwiceInSameFrame } from '@src/testing/press';
import { renderScreen } from '@src/testing/render';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Redirect, router, useLocalSearchParams } from 'expo-router';

import NudgeDetailRoute from '../../../../../app/(app)/nudges/[nudgeId]';
import {
  createNudgeInteractionDto,
  createNudgeThanksPreviewDto,
  createNudgeThanksRecipientDtos,
} from './nudge-interaction.fixtures';

const ME = createCurrentUserDto();
const FRIEND = {
  id: 'clz7x5p8k0009qz0z8z8z8z8z',
  userTag: 'FRIEND01',
  name: '응원냥',
  profileImage: null,
};
const NUDGE_ID = 7;
const TODO_ID = 1;
const INTERACTION_PATH = `v1/nudges/${NUDGE_ID}/interaction`;
const ME_PATH = 'v1/auth/me';
const AVAILABILITY_PATH = 'v1/nudges/interactions/availability';
const THANKS_PATH = `v1/nudges/todos/${TODO_ID}/thanks`;
const ME_AS_RECEIVER = { id: ME.userId, userTag: ME.userTag, name: ME.name, profileImage: null };

type ServerResponse = Result<unknown, ApiError> | (() => Promise<Result<unknown, ApiError>>);

/** 내가 받은 콕. 할 일이 끝났는지는 `completed`로 정한다 */
function createReceivedNudgeDto({
  completed = false,
  replyKind = null,
}: { completed?: boolean; replyKind?: NudgeReplyKind | null } = {}) {
  return createNudgeInteractionDto({
    id: NUDGE_ID,
    todoId: TODO_ID,
    sender: FRIEND,
    receiver: ME_AS_RECEIVER,
    todo: { id: TODO_ID, title: '산책하기', completed },
    replyKind,
  });
}

function createThanksPreviewDto({
  recipientCount = 0,
  thankedRecipientCount = 0,
}: { recipientCount?: number; thankedRecipientCount?: number } = {}) {
  return createNudgeThanksPreviewDto({
    todoId: TODO_ID,
    throughNudgeId: recipientCount > 0 ? NUDGE_ID : null,
    recipients: createNudgeThanksRecipientDtos(recipientCount),
    totalRecipients: recipientCount,
    thankedRecipientCount,
    lastThankedAt: thankedRecipientCount > 0 ? '2026-11-10T00:00:00.000Z' : null,
  });
}

async function renderNudgeDetail({
  get,
  nudgeId = String(NUDGE_ID),
}: {
  get: Record<string, ServerResponse>;
  nudgeId?: string;
}) {
  const httpClient = createHttpClientStub();
  httpClient.get.mockImplementation(respondByPath({ [ME_PATH]: ok(ME), ...get }));
  const analytics = createAnalyticsStub();
  jest.mocked(useLocalSearchParams).mockReturnValue({ nudgeId });
  await renderScreen(<NudgeDetailRoute />, {
    di: createTestDi({ ports: { httpClient, analytics } }),
    withLocalDate: true,
  });

  return { httpClient, analytics };
}

describe('NudgeDetailRoute', () => {
  it('끝나지 않은 할 일에 받은 콕을 처음 열면 콕과 내 정보를 한 번씩만 받는다', async () => {
    // When
    const { httpClient } = await renderNudgeDetail({
      get: { [INTERACTION_PATH]: ok(createReceivedNudgeDto()) },
    });
    await screen.findByText('친구에게 한마디 전해볼까요?');

    // Then
    expect(countGetRequests(httpClient)).toEqual({ [INTERACTION_PATH]: 1, [ME_PATH]: 1 });
  });

  it('완료한 할 일의 콕은 콕·내 정보 → 감사 사용 여부 → 감사 현황 차례로 받는다', async () => {
    // Given
    const interaction = createPendingResponse(ok(createReceivedNudgeDto({ completed: true })));
    const availability = createPendingResponse(ok({ enabled: true }));
    const { httpClient } = await renderNudgeDetail({
      get: {
        [INTERACTION_PATH]: () => interaction.response,
        [AVAILABILITY_PATH]: () => availability.response,
        [THANKS_PATH]: ok(createThanksPreviewDto({ recipientCount: 1 })),
      },
    });
    expect(countGetRequests(httpClient)).toEqual({ [INTERACTION_PATH]: 1, [ME_PATH]: 1 });

    // When
    await act(async () => interaction.settle());

    // Then
    await waitFor(() => expect(countGetRequests(httpClient)[AVAILABILITY_PATH]).toBe(1));
    expect(countGetRequests(httpClient)[THANKS_PATH]).toBeUndefined();

    // When
    await act(async () => availability.settle());

    // Then
    expect(await screen.findByText('콕 찔러준 친구 1명')).toBeOnTheScreen();
    expect(countGetRequests(httpClient)).toEqual({
      [INTERACTION_PATH]: 1,
      [ME_PATH]: 1,
      [AVAILABILITY_PATH]: 1,
      [THANKS_PATH]: 1,
    });
    expect(httpClient.get.mock.calls.map(([path]) => path)).toEqual([
      INTERACTION_PATH,
      ME_PATH,
      AVAILABILITY_PATH,
      THANKS_PATH,
    ]);
  });

  it.each([
    { replyKind: 'STARTING', label: '시작해볼게' },
    { replyKind: 'THANKFUL', label: '응원 고마워' },
    { replyKind: 'LATER', label: '조금 뒤에 할게' },
  ] satisfies { replyKind: NudgeReplyKind; label: string }[])(
    '답장($replyKind)을 누르면 그 답장을 보내고 고른 답장으로 보인다',
    async ({ replyKind, label }) => {
      // Given
      const { httpClient, analytics } = await renderNudgeDetail({
        get: { [INTERACTION_PATH]: ok(createReceivedNudgeDto()) },
      });
      httpClient.put.mockResolvedValue(ok(createReceivedNudgeDto({ replyKind })));

      // When
      await fireEvent.press(await screen.findByRole('button', { name: label }));

      // Then
      expect(await screen.findByText('친구에게 답장을 전했어요')).toBeOnTheScreen();
      expect(httpClient.put).toHaveBeenCalledTimes(1);
      expect(httpClient.put).toHaveBeenCalledWith(`v1/nudges/${NUDGE_ID}/reply`, { replyKind });
      // 응답을 상세 캐시에 쓴 알림은 답장 완료 문구와 다른 묶음으로 올 수 있어 기다린다
      await waitFor(() => expect(screen.getByRole('button', { name: label })).toBeSelected());
      expect(getTrackedEvents(analytics, 'nudge_replied')).toHaveLength(1);
    },
  );

  it('답장을 보내는 동안 다른 답장 버튼은 눌리지 않는다', async () => {
    // Given
    const { httpClient } = await renderNudgeDetail({
      get: { [INTERACTION_PATH]: ok(createReceivedNudgeDto()) },
    });
    const pending = createPendingResponse(ok(createReceivedNudgeDto({ replyKind: 'STARTING' })));
    httpClient.put.mockReturnValue(pending.response);
    await fireEvent.press(await screen.findByRole('button', { name: '시작해볼게' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: '조금 뒤에 할게' })).toBeDisabled(),
    );

    // When
    await fireEvent.press(screen.getByRole('button', { name: '조금 뒤에 할게' }));
    await act(async () => pending.settle());

    // Then
    expect(await screen.findByText('친구에게 답장을 전했어요')).toBeOnTheScreen();
    expect(httpClient.put).toHaveBeenCalledTimes(1);
  });

  it('같은 프레임에 답장을 두 번 누르면 요청이 한 번 나간다', async () => {
    // Given
    const { httpClient } = await renderNudgeDetail({
      get: { [INTERACTION_PATH]: ok(createReceivedNudgeDto()) },
    });
    const pending = createPendingResponse(ok(createReceivedNudgeDto({ replyKind: 'STARTING' })));
    httpClient.put.mockReturnValue(pending.response);
    const starting = await screen.findByRole('button', { name: '시작해볼게' });

    // When
    await pressTwiceInSameFrame(starting);
    await act(async () => {
      pending.settle();
    });

    // Then
    expect(await screen.findByText('친구에게 답장을 전했어요')).toBeOnTheScreen();
    expect(httpClient.put).toHaveBeenCalledTimes(1);
  });

  it('완료한 할 일에 고마움을 전할 친구가 있으면 수를 알리고 누르면 감사 시트를 연다', async () => {
    // Given
    await renderNudgeDetail({
      get: {
        [INTERACTION_PATH]: ok(createReceivedNudgeDto({ completed: true })),
        [AVAILABILITY_PATH]: ok({ enabled: true }),
        [THANKS_PATH]: ok(createThanksPreviewDto({ recipientCount: 2 })),
      },
    });
    expect(await screen.findByText('콕 찔러준 친구 2명')).toBeOnTheScreen();

    // When
    await fireEvent.press(
      screen.getByRole('button', { name: '콕 찔러준 친구 2명에게 고마움 전하기' }),
    );

    // Then
    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/todo/[todoId]/thanks',
      params: { todoId: TODO_ID },
    });
  });

  it('이미 모두에게 고마움을 전했으면 전한 수만 알리고 보내기 버튼은 두지 않는다', async () => {
    // When
    await renderNudgeDetail({
      get: {
        [INTERACTION_PATH]: ok(createReceivedNudgeDto({ completed: true })),
        [AVAILABILITY_PATH]: ok({ enabled: true }),
        [THANKS_PATH]: ok(createThanksPreviewDto({ thankedRecipientCount: 2 })),
      },
    });

    // Then
    expect(await screen.findByText('친구 2명에게 고마움을 전했어요')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: /고마움 전하기/u })).toBeNull();
  });

  it('감사 기능이 꺼져 있으면 감사 현황을 받지 않는다', async () => {
    // Given
    const { httpClient } = await renderNudgeDetail({
      get: {
        [INTERACTION_PATH]: ok(createReceivedNudgeDto({ completed: true })),
        [AVAILABILITY_PATH]: ok({ enabled: false }),
      },
    });

    // When
    await waitFor(() => expect(countGetRequests(httpClient)[AVAILABILITY_PATH]).toBe(1));

    // Then
    expect(countGetRequests(httpClient)[THANKS_PATH]).toBeUndefined();
    expect(screen.queryByText(/콕 찔러준 친구/u)).toBeNull();
  });

  it('내가 보낸 콕은 답장 버튼 없이 친구의 답장을 보인다', async () => {
    // When
    await renderNudgeDetail({
      get: {
        [INTERACTION_PATH]: ok(
          createNudgeInteractionDto({
            id: NUDGE_ID,
            sender: ME_AS_RECEIVER,
            receiver: FRIEND,
            replyKind: 'THANKFUL',
          }),
        ),
      },
    });

    // Then
    expect(await screen.findByText('답장: 응원 고마워')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: '시작해볼게' })).toBeNull();
  });

  it('받은 콕의 메뉴에서 신고하면 보낸 사람과 그 콕 메시지를 대상으로 신고 시트를 연다', async () => {
    // Given
    await renderNudgeDetail({
      get: { [INTERACTION_PATH]: ok(createReceivedNudgeDto()) },
    });

    // When
    await fireEvent.press(await screen.findByRole('menuitem', { name: '신고하기' }));

    // Then
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/users/[userId]/report',
      params: {
        userId: FRIEND.id,
        name: FRIEND.name,
        targetType: 'NUDGE_MESSAGE',
        targetId: String(NUDGE_ID),
      },
    });
  });

  it('받은 콕의 메뉴에서 차단하면 보낸 사람의 차단 확인을 연다', async () => {
    // Given
    await renderNudgeDetail({
      get: { [INTERACTION_PATH]: ok(createReceivedNudgeDto()) },
    });

    // When
    await fireEvent.press(await screen.findByRole('menuitem', { name: '차단하기' }));

    // Then
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/users/[userId]/block',
      params: { userId: FRIEND.id, name: FRIEND.name },
    });
  });

  it('사라진 콕이면 답할 수 없다고 알리고 뒤로 가기로 알림함에 돌아간다', async () => {
    // Given
    await renderNudgeDetail({
      get: { [INTERACTION_PATH]: fail(createApiError('NUDGE_1105')) },
    });
    expect(await screen.findByText('지금은 이 콕에 답할 수 없어요')).toBeOnTheScreen();

    // When
    await fireEvent.press(screen.getByRole('button', { name: '뒤로 가기' }));

    // Then
    expect(router.dismissTo).toHaveBeenCalledWith('/notifications', undefined);
  });

  it('콕 번호가 아닌 주소는 알림함으로 돌려보내고 조회하지 않는다', async () => {
    // When
    const { httpClient } = await renderNudgeDetail({ get: {}, nudgeId: 'abc' });

    // Then
    expect(jest.mocked(Redirect)).toHaveBeenCalledWith(
      expect.objectContaining({ href: '/notifications' }),
      undefined,
    );
    expect(httpClient.get).not.toHaveBeenCalled();
  });
});
