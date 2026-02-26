import { createMockHttpClient } from '@src/shared/__tests__';
import { ApiError } from '@src/shared/errors/api-error';
import { TodoCategoryRepositoryImpl } from './todo-category.repository.impl';

describe('TodoCategoryRepositoryImpl', () => {
  let httpClient: ReturnType<typeof createMockHttpClient>;
  let repository: TodoCategoryRepositoryImpl;

  beforeEach(() => {
    httpClient = createMockHttpClient();
    repository = new TodoCategoryRepositoryImpl(httpClient);
  });

  describe('deleteCategory', () => {
    test('moveToCategoryId를 query params로 전달한다', async () => {
      // Given
      httpClient.delete.mockResolvedValue({
        ok: true,
        value: { message: '카테고리가 삭제되었습니다.' },
      });

      // When
      const result = await repository.deleteCategory(3, { moveToCategoryId: 1 });

      // Then
      expect(httpClient.delete).toHaveBeenCalledWith('v1/todo-categories/3', {
        params: { moveToCategoryId: 1 },
      });
      expect(result).toEqual({ ok: true, value: undefined });
    });

    test('HTTP 에러를 그대로 반환한다', async () => {
      // Given
      const apiError = new ApiError(
        'TODO_CATEGORY_0855',
        '카테고리에 할 일이 있어요. 이동할 카테고리를 선택해주세요.',
        400,
      );
      httpClient.delete.mockResolvedValue({ ok: false, error: apiError });

      // When
      const result = await repository.deleteCategory(3, { moveToCategoryId: 1 });

      // Then
      expect(result).toEqual({ ok: false, error: apiError });
    });
  });
});
