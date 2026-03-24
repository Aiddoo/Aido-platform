import { createMockHttpClient } from '@src/shared/__tests__';
import { createTodoApiError, createTodoDto, INVALID_DTO } from '../__tests__/todo.factories';
import { SubTodoService } from './sub-todo.service';

describe('SubTodoService', () => {
  let httpClient: ReturnType<typeof createMockHttpClient>;
  let service: SubTodoService;

  beforeEach(() => {
    httpClient = createMockHttpClient();
    service = new SubTodoService(httpClient);
  });

  describe('addSubTodo', () => {
    test('정상 응답 → TodoItem 반환', async () => {
      // Given
      const todo = createTodoDto();
      httpClient.post.mockResolvedValue({ ok: true, value: { message: '추가됨', todo } });

      // When
      const result = await service.addSubTodo(1, { title: '새 항목' });

      // Then
      expect(httpClient.post).toHaveBeenCalledWith('v1/todos/1/items', { title: '새 항목' });
      expect(result.ok).toBe(true);
    });

    test('HTTP 에러 → Result.err 반환', async () => {
      // Given
      const apiError = createTodoApiError({ code: 'TODO_0821' });
      httpClient.post.mockResolvedValue({ ok: false, error: apiError });

      // When
      const result = await service.addSubTodo(1, { title: '새 항목' });

      // Then
      expect(result).toEqual({ ok: false, error: apiError });
    });

    test('Zod 검증 실패 → ParseError throw', async () => {
      // Given
      httpClient.post.mockResolvedValue({ ok: true, value: { message: '', todo: INVALID_DTO } });

      // When & Then
      await expect(service.addSubTodo(1, { title: '새 항목' })).rejects.toThrow(
        'Invalid addSubTodo response',
      );
    });
  });

  describe('updateSubTodo', () => {
    test('정상 응답 → TodoItem 반환', async () => {
      // Given
      const todo = createTodoDto();
      httpClient.patch.mockResolvedValue({ ok: true, value: { message: '수정됨', todo } });

      // When
      const result = await service.updateSubTodo(1, 10, { title: '수정된 항목' });

      // Then
      expect(httpClient.patch).toHaveBeenCalledWith('v1/todos/1/items/10', {
        title: '수정된 항목',
      });
      expect(result.ok).toBe(true);
    });

    test('HTTP 에러 → Result.err 반환', async () => {
      // Given
      const apiError = createTodoApiError({ code: 'TODO_0822' });
      httpClient.patch.mockResolvedValue({ ok: false, error: apiError });

      // When
      const result = await service.updateSubTodo(1, 10, { title: '수정' });

      // Then
      expect(result).toEqual({ ok: false, error: apiError });
    });

    test('Zod 검증 실패 → ParseError throw', async () => {
      // Given
      httpClient.patch.mockResolvedValue({
        ok: true,
        value: { message: '', todo: INVALID_DTO },
      });

      // When & Then
      await expect(service.updateSubTodo(1, 10, { title: '수정' })).rejects.toThrow(
        'Invalid updateSubTodo response',
      );
    });
  });

  describe('deleteSubTodo', () => {
    test('정상 응답 → TodoItem 반환', async () => {
      // Given
      const todo = createTodoDto();
      httpClient.delete.mockResolvedValue({ ok: true, value: { message: '삭제됨', todo } });

      // When
      const result = await service.deleteSubTodo(1, 10);

      // Then
      expect(httpClient.delete).toHaveBeenCalledWith('v1/todos/1/items/10');
      expect(result.ok).toBe(true);
    });

    test('HTTP 에러 → Result.err 반환', async () => {
      // Given
      const apiError = createTodoApiError({ code: 'TODO_0822' });
      httpClient.delete.mockResolvedValue({ ok: false, error: apiError });

      // When
      const result = await service.deleteSubTodo(1, 10);

      // Then
      expect(result).toEqual({ ok: false, error: apiError });
    });

    test('Zod 검증 실패 → ParseError throw', async () => {
      // Given
      httpClient.delete.mockResolvedValue({
        ok: true,
        value: { message: '', todo: INVALID_DTO },
      });

      // When & Then
      await expect(service.deleteSubTodo(1, 10)).rejects.toThrow('Invalid deleteSubTodo response');
    });
  });

  describe('reorderSubTodos', () => {
    test('정상 응답 → TodoItem 반환', async () => {
      // Given
      const todo = createTodoDto();
      httpClient.patch.mockResolvedValue({ ok: true, value: { message: '정렬됨', todo } });

      // When
      const result = await service.reorderSubTodos(1, { itemIds: [3, 1, 2] });

      // Then
      expect(httpClient.patch).toHaveBeenCalledWith('v1/todos/1/items/reorder', {
        itemIds: [3, 1, 2],
      });
      expect(result.ok).toBe(true);
    });

    test('HTTP 에러 → Result.err 반환', async () => {
      // Given
      const apiError = createTodoApiError();
      httpClient.patch.mockResolvedValue({ ok: false, error: apiError });

      // When
      const result = await service.reorderSubTodos(1, { itemIds: [3, 1, 2] });

      // Then
      expect(result).toEqual({ ok: false, error: apiError });
    });

    test('Zod 검증 실패 → ParseError throw', async () => {
      // Given
      httpClient.patch.mockResolvedValue({
        ok: true,
        value: { message: '', todo: INVALID_DTO },
      });

      // When & Then
      await expect(service.reorderSubTodos(1, { itemIds: [3, 1, 2] })).rejects.toThrow(
        'Invalid reorderSubTodos response',
      );
    });
  });
});
