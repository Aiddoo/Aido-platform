import '@src/shared/i18n/init';
import { ApiError } from '@src/core/errors/api-error';
import { err, ok, type Result } from '@src/core/errors/result';
import {
  createAnalyticsStub,
  createHapticsGatewayStub,
  createHttpClientStub,
  createTestQueryClient,
  renderUi,
} from '@src/shared/__tests__';
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
import { TODO_CATEGORY_QUERY_KEYS } from '../constants/todo-category-query-keys';
import type { TodoCategoryWithCount } from '../domains/todo-category.model';
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

  await renderUi(
    <Suspense fallback={null}>
      <CategoryDeleteBottomSheet />
    </Suspense>,
    {
      queryClient,
      withOverlay: true,
      di: { httpClient, analytics: createAnalyticsStub(), haptics: createHapticsGatewayStub() },
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

  it('할 일도 함께 삭제를 고르면 옮길 곳 없이 함께 지운다', async () => {
    // Given
    const { httpClient } = await renderDeleteSheet({
      previews: [ok(createTodoCategoryDeletionPreviewDto())],
      deleteResponse: ok({
        message: '삭제',
        result: {
          todoHandling: 'delete',
          todoCount: 12,
          seriesCount: 2,
          moveToCategoryId: null,
        },
      }),
    });
    await fireEvent.press(await screen.findByTestId('category-delete-handling-delete'));

    // When
    await fireEvent.press(screen.getByText('모두 삭제'));

    // Then
    expect(httpClient.delete).toHaveBeenCalledWith('v1/todo-categories/3', {
      params: { todoHandling: 'delete' },
    });
    expect(
      await screen.findAllByText('‘운동’ 카테고리와 할 일 12개를 삭제했어요'),
    ).not.toHaveLength(0);
  });

  it('마지막 카테고리면 이유를 보이고 삭제를 눌러도 요청하지 않는다', async () => {
    // Given
    const { httpClient } = await renderDeleteSheet({
      categories: [WORKOUT],
      previews: [ok(createTodoCategoryDeletionPreviewDto({ isLastCategory: true }))],
    });
    expect(await screen.findByText('카테고리는 1개 이상 있어야 해요.')).toBeOnTheScreen();

    // When
    await fireEvent.press(screen.getByTestId('category-delete-confirm'));

    // Then
    expect(screen.getByTestId('category-delete-confirm')).toBeDisabled();
    expect(httpClient.delete).not.toHaveBeenCalled();
  });

  it('미리보기가 없는 옛 서버면 함께 삭제 없이 출시 앱처럼 옮길 곳만 보낸다', async () => {
    // Given
    const { httpClient } = await renderDeleteSheet({
      previews: [err(new ApiError('SYS_0002', 'Not Found', 404))],
    });
    await screen.findByTestId('category-delete-sheet');
    expect(screen.queryByTestId('category-delete-handling-delete')).toBeNull();

    // When
    await fireEvent.press(screen.getByText('옮기고 삭제'));

    // Then
    expect(httpClient.delete).toHaveBeenCalledWith('v1/todo-categories/3', {
      params: { moveToCategoryId: PERSONAL.id },
    });
    expect(await screen.findAllByText('카테고리를 삭제했어요')).not.toHaveLength(0);
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
          code: 'TODO_CATEGORY_0855',
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
