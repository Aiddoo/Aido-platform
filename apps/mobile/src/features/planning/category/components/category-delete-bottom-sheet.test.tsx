import { ErrorCode } from '@aido/api/errors';
import '@src/shared/i18n/init';
import type { ApiError } from '@src/core/errors/api-error';
import { err, ok, type Result } from '@src/core/errors/result';
import {
  createAnalyticsStub,
  createHapticsGatewayStub,
  createHttpClientStub,
  createTestQueryClient,
  createTestDi,
} from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { fireEvent, screen } from '@testing-library/react-native';
import { useLocalSearchParams } from 'expo-router';
import { Suspense } from 'react';

import {
  createTodoCategoryApiError,
  createTodoCategoryDeletionPreviewDto,
  createTodoCategoryListDto,
  createTodoCategoryWithCount,
  createTodoCategoryWithCountDto,
} from '../__tests__/todo-category.fixtures';
import type { TodoCategoryWithCount } from '../domains/todo-category.model';
import { TODO_CATEGORY_QUERY_KEYS } from '../queries/todo-category-query-keys';
import { CategoryDeleteBottomSheet } from './category-delete-bottom-sheet';

const DELETING_CATEGORY_ID = 3;
const PERSONAL = createTodoCategoryWithCount({ id: 1, name: '개인', sortOrder: 0 });
const WORKOUT = createTodoCategoryWithCount({
  id: DELETING_CATEGORY_ID,
  name: '운동',
  sortOrder: 1,
  todoCount: 12,
});
const STUDY = createTodoCategoryWithCount({ id: 2, name: '공부', sortOrder: 2 });
const EMPTY_PREVIEW_DTO = createTodoCategoryDeletionPreviewDto({
  todoCount: 0,
  completedTodoCount: 0,
  activeSeriesCount: 0,
});

interface RenderDeleteSheetOptions {
  categories?: TodoCategoryWithCount[];
  /** 미리보기를 물을 때마다 차례로 답한다. 마지막 답은 그 뒤에도 그대로다 */
  previews: Result<unknown, ApiError>[];
  deleteResponse?: Result<unknown, ApiError>;
}

async function renderDeleteSheet({
  categories = [PERSONAL, WORKOUT, STUDY],
  previews,
  deleteResponse = ok({ message: '카테고리가 삭제되었습니다.' }),
}: RenderDeleteSheetOptions) {
  const httpClient = createHttpClientStub();
  let previewRequestCount = 0;
  httpClient.get.mockImplementation(async (url) => {
    if (url.endsWith('/deletion-preview')) {
      const preview = previews[Math.min(previewRequestCount, previews.length - 1)];
      previewRequestCount += 1;
      if (preview == null) {
        throw new Error('renderDeleteSheet: 미리보기 답을 정하지 않았습니다');
      }

      return preview;
    }

    return ok(
      createTodoCategoryListDto({
        items: categories.map((category) => createTodoCategoryWithCountDto(category)),
      }),
    );
  });
  httpClient.delete.mockResolvedValue(deleteResponse);
  const queryClient = createTestQueryClient({
    defaultOptions: { queries: { staleTime: Infinity } },
  });
  queryClient.setQueryData(TODO_CATEGORY_QUERY_KEYS.list(), { categories });
  jest.mocked(useLocalSearchParams).mockReturnValue({ categoryId: String(DELETING_CATEGORY_ID) });

  await renderScreen(
    <Suspense fallback={null}>
      <CategoryDeleteBottomSheet />
    </Suspense>,
    {
      di: createTestDi({
        ports: {
          httpClient,
          analytics: createAnalyticsStub(),
          haptics: createHapticsGatewayStub(),
          queryClient,
        },
      }),
      withOverlay: true,
    },
  );

  return { httpClient };
}

describe('CategoryDeleteBottomSheet', () => {
  it('처음에는 정렬 순서가 가장 앞인 카테고리로 옮기고 지운다', async () => {
    // Given
    const { httpClient } = await renderDeleteSheet({
      previews: [ok(createTodoCategoryDeletionPreviewDto())],
      deleteResponse: ok({
        message: '삭제',
        result: { todoHandling: 'move', todoCount: 12, seriesCount: 2, moveToCategoryId: 1 },
      }),
    });

    // When
    await fireEvent.press(await screen.findByText('옮기고 삭제'));

    // Then
    expect(httpClient.delete).toHaveBeenCalledWith('v1/todo-categories/3', {
      params: { todoHandling: 'move', moveToCategoryId: PERSONAL.id },
    });
    expect(await screen.findAllByText('할 일 12개를 ‘개인’ 카테고리로 옮겼어요')).not.toHaveLength(
      0,
    );
  });

  it('할 일과 반복이 없으면 확인만 받고 처리 방식 없이 지운다', async () => {
    // Given
    const { httpClient } = await renderDeleteSheet({
      previews: [ok(EMPTY_PREVIEW_DTO)],
      deleteResponse: ok({
        message: '삭제',
        result: { todoHandling: 'none', todoCount: 0, seriesCount: 0, moveToCategoryId: null },
      }),
    });

    // When
    await fireEvent.press(await screen.findByTestId('category-delete-confirm'));

    // Then
    expect(httpClient.delete).toHaveBeenCalledWith('v1/todo-categories/3', { params: {} });
    expect(await screen.findAllByText('카테고리를 삭제했어요')).not.toHaveLength(0);
  });

  it('미리보기 뒤 다른 기기에서 할 일이 생겨 거절되면 다시 받아 옮길지 함께 지울지 고르게 한다', async () => {
    // Given
    await renderDeleteSheet({
      previews: [ok(EMPTY_PREVIEW_DTO), ok(createTodoCategoryDeletionPreviewDto())],
      deleteResponse: err(
        createTodoCategoryApiError({
          code: ErrorCode.TODO_CATEGORY_0855,
          message: '카테고리에 할 일이 있어요. 이동할 카테고리를 선택해주세요.',
        }),
      ),
    });

    // When
    await fireEvent.press(await screen.findByTestId('category-delete-confirm'));

    // Then
    expect(await screen.findByTestId('category-delete-sheet')).toBeOnTheScreen();
    expect(
      await screen.findAllByText('카테고리에 할 일이 있어요. 이동할 카테고리를 선택해주세요.'),
    ).not.toHaveLength(0);
  });
});
