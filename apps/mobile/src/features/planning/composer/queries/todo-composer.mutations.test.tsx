import '@src/shared/i18n/init';
import { ApiError } from '@src/core/errors/api-error';
import {
  createAnalyticsStub,
  createHapticsGatewayStub,
  createHttpClientStub,
} from '@src/shared/__tests__';
import { renderUi } from '@src/shared/__tests__/render-ui';
import { NetworkError, ParseError } from '@src/shared/errors';
import { useMutation } from '@tanstack/react-query';
import { act, screen } from '@testing-library/react-native';

import {
  useCreateTodoMutationOptions,
  useUpdateTodoMutationOptions,
} from './todo-composer.mutations';

/** 이후 회차까지 고치는 PATCH가 거절되는 상황. 함께 보낸 칸도 저장되지 않으므로 목록을 건드리지 않는다 */
async function updateFollowing(error: ApiError) {
  const httpClient = createHttpClientStub();
  httpClient.patch.mockResolvedValue({ ok: false, error });
  const current: { value: ReturnType<typeof useUpdate> | null } = { value: null };

  function useUpdate() {
    return useMutation(useUpdateTodoMutationOptions());
  }

  function Probe() {
    current.value = useUpdate();
    return null;
  }

  const { queryClient } = await renderUi(<Probe />, {
    di: {
      httpClient,
      analytics: createAnalyticsStub(),
      haptics: createHapticsGatewayStub(),
    },
    withOverlay: true,
  });
  const invalidateQueries = jest.spyOn(queryClient, 'invalidateQueries');
  const update = current.value;
  if (update == null) {
    throw new Error('Probe가 렌더되지 않았다');
  }
  await act(async () => {
    await update
      .mutateAsync({
        todoId: 1,
        input: { title: '고친 제목', categoryId: 2 },
        options: { scope: 'THIS_AND_FOLLOWING' },
      })
      .catch(jest.fn());
  });
  return { invalidateQueries };
}

describe('이후 회차까지 고치다 거절됐을 때', () => {
  test.each([
    [
      new ApiError('TODO_0811', '서버 문구', 403),
      '이 카테고리에 할 일을 더 추가할 수 없어요',
      '할 일을 완료하거나 다른 카테고리를 골라주세요. 고친 내용은 저장되지 않았어요.',
    ],
    [
      new ApiError('TODO_0845', '서버 문구', 400, { field: 'startDate' }),
      '시작일이 너무 오래전이에요',
      '지난 날짜가 너무 많아요. 시작일을 더 가까운 날로 골라주세요.',
    ],
    [
      new ApiError('TODO_0842', '서버 문구', 403, { limit: 100, activeCount: 100 }),
      /반복 할 일은 최대/,
      '쓰지 않는 반복을 끝내거나 삭제한 뒤 다시 추가해주세요.',
    ],
  ])('%s은 맞는 안내를 하고 목록을 다시 읽지 않는다', async (error, title, description) => {
    // Given
    const rejected = error;

    // When
    const { invalidateQueries } = await updateFollowing(rejected);

    // Then
    expect((await screen.findAllByText(title)).length).toBeGreaterThan(0);
    expect(screen.getAllByText(description).length).toBeGreaterThan(0);
    expect(invalidateQueries).not.toHaveBeenCalled();
  });
});

async function createFailing(failure: Error) {
  const httpClient = createHttpClientStub();
  httpClient.post.mockRejectedValue(failure);
  const haptics = createHapticsGatewayStub();
  const current: { value: ReturnType<typeof useCreate> | null } = { value: null };

  function useCreate() {
    return useMutation(useCreateTodoMutationOptions());
  }

  function Probe() {
    current.value = useCreate();
    return null;
  }

  await renderUi(<Probe />, {
    di: {
      httpClient,
      analytics: createAnalyticsStub(),
      haptics,
    },
    withOverlay: true,
  });
  const create = current.value;
  if (create == null) {
    throw new Error('Probe가 렌더되지 않았다');
  }
  await act(async () => {
    await create
      .mutateAsync({
        input: {
          title: '새 할 일',
          categoryId: 1,
          startDate: '2026-11-07',
          isAllDay: true,
          visibility: 'PUBLIC',
        },
        source: 'manual',
      })
      .catch(jest.fn());
  });
  return { haptics };
}

describe('할 일 추가 실패 안내', () => {
  it('오프라인이면 연결을 확인하라는 문구를 알리고 햅틱은 한 번만 울린다', async () => {
    // Given
    const offline = new NetworkError();

    // When
    const { haptics } = await createFailing(offline);

    // Then
    expect((await screen.findAllByText('인터넷 연결을 확인해주세요')).length).toBeGreaterThan(0);
    expect(haptics.notify).toHaveBeenCalledTimes(1);
  });

  it('응답을 읽지 못하면 다시 추가하라는 폴백 문구를 알린다', async () => {
    // Given
    const unreadable = new ParseError('개발자용 검증 메시지');

    // When
    await createFailing(unreadable);

    // Then
    expect((await screen.findAllByText('잠시 후 다시 추가해보세요')).length).toBeGreaterThan(0);
    expect(screen.queryByText('개발자용 검증 메시지')).toBeNull();
  });
});
