import '@src/shared/i18n/init';
import { StaticDIProvider } from '@src/bootstrap/providers/di-context';
import { useUpdateTodoMutationOptions } from '@src/features/planning/composer/queries/use-update-todo-mutation-options';
import {
  createHapticsStub,
  createAnalyticsStub,
  createTestDiContainer,
  createHttpClientStub,
} from '@src/shared/__tests__';
import { createTestQueryClient } from '@src/shared/__tests__/query-client';
import { ApiError } from '@src/shared/errors/api-error';
import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';

import { TodoService } from '../apis/todo.service';

const mockToastError = jest.fn();

jest.mock('@src/shared/hooks/use-app-toast', () => ({
  useAppToast: () => ({ success: jest.fn(), error: mockToastError }),
}));

/** 이후 회차까지 고치는 PATCH가 거절되는 상황. 함께 보낸 칸도 저장되지 않으므로 목록을 건드리지 않는다 */
async function updateFollowing(error: ApiError) {
  const client = createTestQueryClient();
  const invalidateQueries = jest.spyOn(client, 'invalidateQueries');
  const httpClient = createHttpClientStub();
  httpClient.patch.mockResolvedValue({ ok: false, error });
  const container = createTestDiContainer({
    todoService: new TodoService(httpClient),
    analytics: createAnalyticsStub(),
    haptics: createHapticsStub(),
  });
  const { result } = await renderHook(() => useUpdateTodoMutationOptions(), {
    wrapper: ({ children }: PropsWithChildren) => (
      <StaticDIProvider container={container}>
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      </StaticDIProvider>
    ),
  });
  const mutation = client.getMutationCache().build(client, result.current);
  await act(async () => {
    await mutation
      .execute({
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
      expect.stringContaining('반복 할 일은 최대'),
      '쓰지 않는 반복을 끝내거나 삭제한 뒤 다시 추가해주세요.',
    ],
  ])('%s은 맞는 안내를 하고 목록을 다시 읽지 않는다', async (error, title, description) => {
    // Given
    const rejected = error;

    // When
    const { invalidateQueries } = await updateFollowing(rejected);

    // Then
    expect(mockToastError).toHaveBeenCalledWith(title, { description });
    expect(invalidateQueries).not.toHaveBeenCalled();
  });
});
