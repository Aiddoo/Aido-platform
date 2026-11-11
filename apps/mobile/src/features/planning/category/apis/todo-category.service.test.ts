import { unwrap } from '@src/core/errors/result';
import { createHttpClientStub } from '@src/shared/__tests__';

import {
  createTodoCategoryApiError,
  createTodoCategoryDeletionPreviewDto,
  createTodoCategoryDto,
  createTodoCategoryListDto,
  INVALID_DTO,
} from '../__tests__/todo-category.fixtures';
import { TodoCategoryService } from './todo-category.service';

const EMPTY_DELETION = { todoHandling: null, moveToCategoryId: null };

function createSut() {
  const httpClient = createHttpClientStub();

  return { httpClient, service: new TodoCategoryService(httpClient) };
}

describe('TodoCategoryService', () => {
  describe('getCategories', () => {
    it('응답을 받으면 TodoCategoriesResult를 반환한다', async () => {
      // Given
      const { httpClient, service } = createSut();
      const dto = createTodoCategoryListDto();
      httpClient.get.mockResolvedValue({ ok: true, value: dto });

      // When
      const result = await service.getCategories();

      // Then
      expect(httpClient.get).toHaveBeenCalledWith('v1/todo-categories', { signal: undefined });
      expect(result.ok).toBe(true);
      const list = unwrap(result);
      expect(list.categories).toHaveLength(2);
      expect(list.categories[0]?.todoCount).toBe(5);
    });

    it('Zod 검증 실패 → ParseError throw', async () => {
      // Given
      const { httpClient, service } = createSut();
      httpClient.get.mockResolvedValue({ ok: true, value: INVALID_DTO });

      // When
      const result = service.getCategories();

      // Then
      await expect(result).rejects.toThrow('Invalid getCategories response');
    });
  });

  describe('createCategory', () => {
    it('응답을 받으면 TodoCategory를 반환한다', async () => {
      // Given
      const { httpClient, service } = createSut();
      const category = createTodoCategoryDto();
      httpClient.post.mockResolvedValue({
        ok: true,
        value: { message: '카테고리가 생성되었습니다.', category },
      });

      // When
      const result = await service.createCategory({ name: '새 카테고리', color: '#FF0000' });

      // Then
      expect(httpClient.post).toHaveBeenCalledWith('v1/todo-categories', {
        name: '새 카테고리',
        color: '#FF0000',
      });
      expect(result.ok).toBe(true);
    });

    it('개수 초과 → TODO_CATEGORY_0857 에러', async () => {
      // Given
      const { httpClient, service } = createSut();
      const apiError = createTodoCategoryApiError({
        code: 'TODO_CATEGORY_0857',
        message: '카테고리 개수 한도에 도달했어요',
      });
      httpClient.post.mockResolvedValue({ ok: false, error: apiError });

      // When
      const result = await service.createCategory({ name: '새 카테고리', color: '#FF0000' });

      // Then
      expect(result).toEqual({ ok: false, error: apiError });
    });

    it('Zod 검증 실패 → ParseError throw', async () => {
      // Given
      const { httpClient, service } = createSut();
      httpClient.post.mockResolvedValue({ ok: true, value: INVALID_DTO });

      // When
      const result = service.createCategory({ name: '새 카테고리', color: '#FF0000' });

      // Then
      await expect(result).rejects.toThrow('Invalid createCategory response');
    });
  });

  describe('updateCategory', () => {
    it('응답을 받으면 TodoCategory를 반환한다', async () => {
      // Given
      const { httpClient, service } = createSut();
      const category = createTodoCategoryDto({ name: '수정된' });
      httpClient.patch.mockResolvedValue({
        ok: true,
        value: { message: '카테고리가 수정되었습니다.', category },
      });

      // When
      const result = await service.updateCategory(1, { name: '수정된' });

      // Then
      expect(httpClient.patch).toHaveBeenCalledWith('v1/todo-categories/1', { name: '수정된' });
      expect(result.ok).toBe(true);
    });

    it('HTTP 에러 → Result.err 반환', async () => {
      // Given
      const { httpClient, service } = createSut();
      const apiError = createTodoCategoryApiError();
      httpClient.patch.mockResolvedValue({ ok: false, error: apiError });

      // When
      const result = await service.updateCategory(1, { name: '수정' });

      // Then
      expect(result).toEqual({ ok: false, error: apiError });
    });

    it('Zod 검증 실패 → ParseError throw', async () => {
      // Given
      const { httpClient, service } = createSut();
      httpClient.patch.mockResolvedValue({ ok: true, value: INVALID_DTO });

      // When
      const result = service.updateCategory(1, { name: '수정' });

      // Then
      await expect(result).rejects.toThrow('Invalid updateCategory response');
    });
  });

  describe('getDeletionPreview', () => {
    it('미리보기 경로로 묻고 앱 미리보기로 바꾼다', async () => {
      // Given
      const { httpClient, service } = createSut();
      httpClient.get.mockResolvedValue({ ok: true, value: createTodoCategoryDeletionPreviewDto() });

      // When
      const result = await service.getDeletionPreview(3);

      // Then
      expect(httpClient.get).toHaveBeenCalledWith('v1/todo-categories/3/deletion-preview', {
        signal: undefined,
      });
      expect(unwrap(result)).toEqual({
        todoCount: 12,
        completedTodoCount: 3,
        activeSeriesCount: 2,
        isLastCategory: false,
      });
    });
  });

  describe('deleteCategory', () => {
    it.each([
      {
        title: '옮기면 처리 방식과 옮길 곳을 보낸다',
        deletion: { todoHandling: 'move', moveToCategoryId: 1 },
        params: { todoHandling: 'move', moveToCategoryId: 1 },
      },
      {
        title: '함께 지우면 처리 방식만 보낸다',
        deletion: { todoHandling: 'delete', moveToCategoryId: null },
        params: { todoHandling: 'delete' },
      },
      {
        title: '옮기거나 지울 할 일이 없으면 아무 query도 보내지 않는다',
        deletion: { todoHandling: null, moveToCategoryId: null },
        params: {},
      },
    ] as const)('$title', async ({ deletion, params }) => {
      // Given
      const { httpClient, service } = createSut();
      httpClient.delete.mockResolvedValue({
        ok: true,
        value: {
          message: '카테고리가 삭제되었습니다.',
          result: { todoHandling: 'none', todoCount: 0, seriesCount: 0, moveToCategoryId: null },
        },
      });

      // When
      await service.deleteCategory(3, deletion);

      // Then
      expect(httpClient.delete).toHaveBeenCalledWith('v1/todo-categories/3', { params });
    });

    it('서버가 준 결과를 돌려준다', async () => {
      // Given
      const { httpClient, service } = createSut();
      const deletion = { todoHandling: 'move', moveToCategoryId: 1 } as const;
      httpClient.delete.mockResolvedValue({
        ok: true,
        value: {
          message: '카테고리가 삭제되었습니다.',
          result: { todoHandling: 'move', todoCount: 12, seriesCount: 2, moveToCategoryId: 1 },
        },
      });

      // When
      const result = await service.deleteCategory(3, deletion);

      // Then
      expect(unwrap(result)).toEqual({
        todoHandling: 'move',
        todoCount: 12,
        seriesCount: 2,
        moveToCategoryId: 1,
      });
    });

    it('마지막 카테고리 → TODO_CATEGORY_0854 에러', async () => {
      // Given
      const { httpClient, service } = createSut();
      const apiError = createTodoCategoryApiError({
        code: 'TODO_CATEGORY_0854',
        message: '카테고리는 1개 이상 있어야 해요',
      });
      httpClient.delete.mockResolvedValue({ ok: false, error: apiError });

      // When
      const result = await service.deleteCategory(3, EMPTY_DELETION);

      // Then
      expect(result).toEqual({ ok: false, error: apiError });
    });

    it('Zod 검증 실패 → ParseError throw', async () => {
      // Given
      const { httpClient, service } = createSut();
      httpClient.delete.mockResolvedValue({ ok: true, value: INVALID_DTO });

      // When
      const result = service.deleteCategory(3, EMPTY_DELETION);

      // Then
      await expect(result).rejects.toThrow('Invalid deleteCategory response');
    });
  });

  describe('reorderCategory', () => {
    it('응답을 받으면 TodoCategory를 반환한다', async () => {
      // Given
      const { httpClient, service } = createSut();
      const category = createTodoCategoryDto({ sortOrder: 2 });
      httpClient.patch.mockResolvedValue({
        ok: true,
        value: { message: '카테고리 순서가 변경되었습니다.', category },
      });

      // When
      const result = await service.reorderCategory(1, { position: 'after', targetCategoryId: 2 });

      // Then
      expect(httpClient.patch).toHaveBeenCalledWith('v1/todo-categories/1/reorder', {
        position: 'after',
        targetCategoryId: 2,
      });
      expect(result.ok).toBe(true);
    });

    it('HTTP 에러 → Result.err 반환', async () => {
      // Given
      const { httpClient, service } = createSut();
      const apiError = createTodoCategoryApiError();
      httpClient.patch.mockResolvedValue({ ok: false, error: apiError });

      // When
      const result = await service.reorderCategory(1, { position: 'after', targetCategoryId: 2 });

      // Then
      expect(result).toEqual({ ok: false, error: apiError });
    });
  });
});
