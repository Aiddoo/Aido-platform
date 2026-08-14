import { createMockHttpClient } from '@src/shared/__tests__';

import {
  createTodoCategoryApiError,
  createTodoCategoryDto,
  createTodoCategoryListDto,
  INVALID_DTO,
} from '../__tests__/todo-category.factories';
import { createTodoDto, INVALID_DTO as INVALID_TODO_DTO } from '../__tests__/todo.factories';
import { TodoCategoryService } from './todo-category.service';

describe('TodoCategoryService', () => {
  let httpClient: ReturnType<typeof createMockHttpClient>;
  let service: TodoCategoryService;

  beforeEach(() => {
    httpClient = createMockHttpClient();
    service = new TodoCategoryService(httpClient);
  });

  // ── getCategories ────────────────────────────

  describe('getCategories', () => {
    test('정상 응답 → TodoCategoriesResult 반환', async () => {
      // Given
      const dto = createTodoCategoryListDto();
      httpClient.get.mockResolvedValue({ ok: true, value: dto });

      // When
      const result = await service.getCategories();

      // Then
      expect(httpClient.get).toHaveBeenCalledWith('v1/todo-categories');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.categories).toHaveLength(2);
        expect(result.value.categories[0]?.todoCount).toBe(5);
      }
    });

    test('Zod 검증 실패 → ParseError throw', async () => {
      // Given
      httpClient.get.mockResolvedValue({ ok: true, value: INVALID_DTO });

      // When & Then
      await expect(service.getCategories()).rejects.toThrow('Invalid getCategories response');
    });
  });

  // ── createCategory ───────────────────────────

  describe('createCategory', () => {
    test('정상 응답 → TodoCategory 반환', async () => {
      // Given
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

    test('개수 초과 → TODO_CATEGORY_0857 에러', async () => {
      // Given
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

    test('Zod 검증 실패 → ParseError throw', async () => {
      // Given
      httpClient.post.mockResolvedValue({ ok: true, value: INVALID_DTO });

      // When & Then
      await expect(
        service.createCategory({ name: '새 카테고리', color: '#FF0000' }),
      ).rejects.toThrow('Invalid createCategory response');
    });
  });

  // ── updateCategory ───────────────────────────

  describe('updateCategory', () => {
    test('정상 응답 → TodoCategory 반환', async () => {
      // Given
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

    test('HTTP 에러 → Result.err 반환', async () => {
      // Given
      const apiError = createTodoCategoryApiError();
      httpClient.patch.mockResolvedValue({ ok: false, error: apiError });

      // When
      const result = await service.updateCategory(1, { name: '수정' });

      // Then
      expect(result).toEqual({ ok: false, error: apiError });
    });

    test('Zod 검증 실패 → ParseError throw', async () => {
      // Given
      httpClient.patch.mockResolvedValue({ ok: true, value: INVALID_DTO });

      // When & Then
      await expect(service.updateCategory(1, { name: '수정' })).rejects.toThrow(
        'Invalid updateCategory response',
      );
    });
  });

  // ── deleteCategory ───────────────────────────

  describe('deleteCategory', () => {
    test('moveToCategoryId를 query params로 전달', async () => {
      // Given
      httpClient.delete.mockResolvedValue({
        ok: true,
        value: { message: '카테고리가 삭제되었습니다.' },
      });

      // When
      const result = await service.deleteCategory(3, { moveToCategoryId: 1 });

      // Then
      expect(httpClient.delete).toHaveBeenCalledWith('v1/todo-categories/3', {
        params: { moveToCategoryId: 1 },
      });
      expect(result).toEqual({ ok: true, value: undefined });
    });

    test('할일 존재 → TODO_CATEGORY_0855 에러', async () => {
      // Given
      const apiError = createTodoCategoryApiError({
        code: 'TODO_CATEGORY_0855',
        message: '카테고리에 할 일이 있어요',
      });
      httpClient.delete.mockResolvedValue({ ok: false, error: apiError });

      // When
      const result = await service.deleteCategory(3);

      // Then
      expect(result).toEqual({ ok: false, error: apiError });
    });

    test('Zod 검증 실패 → ParseError throw', async () => {
      // Given
      httpClient.delete.mockResolvedValue({ ok: true, value: INVALID_DTO });

      // When & Then
      await expect(service.deleteCategory(3)).rejects.toThrow('Invalid deleteCategory response');
    });
  });

  // ── changeTodoCategory ──────────────────────

  describe('changeTodoCategory', () => {
    test('정상 응답 → TodoItem 반환 (카테고리 변경됨)', async () => {
      // Given
      const todo = createTodoDto({
        category: { id: 2, name: '업무', color: '#EF4444', sortOrder: 1 },
      });
      httpClient.patch.mockResolvedValue({
        ok: true,
        value: { message: '카테고리가 변경되었습니다.', todo },
      });

      // When
      const result = await service.changeTodoCategory(1, { categoryId: 2 });

      // Then
      expect(httpClient.patch).toHaveBeenCalledWith('v1/todos/1/category', { categoryId: 2 });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.category.id).toBe(2);
      }
    });

    test('HTTP 에러 → Result.err 반환', async () => {
      // Given
      const apiError = createTodoCategoryApiError();
      httpClient.patch.mockResolvedValue({ ok: false, error: apiError });

      // When
      const result = await service.changeTodoCategory(1, { categoryId: 2 });

      // Then
      expect(result).toEqual({ ok: false, error: apiError });
    });

    test('Zod 검증 실패 → ParseError throw', async () => {
      // Given
      httpClient.patch.mockResolvedValue({
        ok: true,
        value: { message: '카테고리가 변경되었습니다.', todo: INVALID_TODO_DTO },
      });

      // When & Then
      await expect(service.changeTodoCategory(1, { categoryId: 2 })).rejects.toThrow(
        'Invalid changeTodoCategory response',
      );
    });
  });

  // ── reorderCategory ──────────────────────────

  describe('reorderCategory', () => {
    test('정상 응답 → TodoCategory 반환', async () => {
      // Given
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

    test('HTTP 에러 → Result.err 반환', async () => {
      // Given
      const apiError = createTodoCategoryApiError();
      httpClient.patch.mockResolvedValue({ ok: false, error: apiError });

      // When
      const result = await service.reorderCategory(1, { position: 'after', targetCategoryId: 2 });

      // Then
      expect(result).toEqual({ ok: false, error: apiError });
    });
  });
});
