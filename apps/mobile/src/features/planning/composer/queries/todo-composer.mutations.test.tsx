import '@src/shared/i18n/init';
import { ApiError } from '@src/core/errors/api-error';
import { TODO_QUERY_KEYS } from '@src/features/planning/todo/queries/todo-query-keys';
import {
  createAnalyticsStub,
  createHapticsGatewayStub,
  createHttpClientStub,
  createTestDi,
} from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { useMutation } from '@tanstack/react-query';
import { act, screen } from '@testing-library/react-native';

import { useUpdateTodoMutationOptions } from './todo-composer.mutations';

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

  const { queryClient } = await renderScreen(<Probe />, {
    di: createTestDi({
      ports: { httpClient, analytics: createAnalyticsStub(), haptics: createHapticsGatewayStub() },
    }),
    withOverlay: true,
  });
  // 보고 있던 목록. 관찰자가 없어 무효화되면 다시 받지 않고 무효 표시만 남는다
  queryClient
    .getQueryCache()
    .build(queryClient, { queryKey: TODO_QUERY_KEYS.listByDate({ date: '2026-10-27' }) });
  const update = current.value;
  if (update == null) {
    throw new Error('Probe가 렌더되지 않았다');
  }
  await act(async () => {
    await update
      .mutateAsync({
        todoId: 1,
        fields: { title: '고친 제목', categoryId: 2 },
        options: { scope: 'THIS_AND_FOLLOWING' },
      })
      .catch(jest.fn());
  });
  return {
    invalidatedQueries: () =>
      queryClient
        .getQueryCache()
        .findAll()
        .filter((query) => query.state.isInvalidated),
  };
}

describe('useUpdateTodoMutationOptions', () => {
  describe('이후 회차까지 고치다 거절됐을 때', () => {
    it.each([
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
    ])('%s은 맞는 안내 하나만 하고 목록을 다시 읽지 않는다', async (error, title, description) => {
      // Given
      const rejected = error;

      // When
      const { invalidatedQueries } = await updateFollowing(rejected);

      // Then
      expect((await screen.findAllByText(title)).length).toBeGreaterThan(0);
      expect(screen.getAllByText(description).length).toBeGreaterThan(0);
      expect(screen.queryByText('서버 문구')).toBeNull();
      expect(invalidatedQueries()).toEqual([]);
    });
  });
});
