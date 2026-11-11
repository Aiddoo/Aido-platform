import { createHttpClientStub } from '@src/testing/core';

import { createTodoApiError, createTodoDto, INVALID_DTO } from '../__tests__/todo.fixtures';
import { SubTodoService } from './sub-todo.service';

function createSut() {
  const httpClient = createHttpClientStub();

  return { httpClient, service: new SubTodoService(httpClient) };
}

describe('SubTodoService', () => {
  describe('addSubTodo', () => {
    it('응답을 받으면 Todo를 반환한다', async () => {
      // Given
      const { httpClient, service } = createSut();
      const todo = createTodoDto();
      httpClient.post.mockResolvedValue({ ok: true, value: { message: '추가됨', todo } });

      // When
      const result = await service.addSubTodo(1, { title: '새 항목' });

      // Then
      expect(httpClient.post).toHaveBeenCalledWith('v1/todos/1/items', { title: '새 항목' });
      expect(result.ok).toBe(true);
    });

    it('응답에 모르는 반복 빈도가 있어도 저장은 성공으로 읽고 규칙만 비운다', async () => {
      // Given
      const { httpClient, service } = createSut();
      const todo = { ...createTodoDto(), repeat: { frequency: 'YEARLY', end: { type: 'NEVER' } } };
      httpClient.post.mockResolvedValue({ ok: true, value: { message: '추가됨', todo } });

      // When
      const result = await service.addSubTodo(1, { title: '새 항목' });

      // Then
      expect(result.ok && result.value.repeat).toBeNull();
    });

    it('HTTP 에러 → Result.err 반환', async () => {
      // Given
      const { httpClient, service } = createSut();
      const apiError = createTodoApiError({ code: 'TODO_0821' });
      httpClient.post.mockResolvedValue({ ok: false, error: apiError });

      // When
      const result = await service.addSubTodo(1, { title: '새 항목' });

      // Then
      expect(result).toEqual({ ok: false, error: apiError });
    });

    it('Zod 검증 실패 → ParseError throw', async () => {
      // Given
      const { httpClient, service } = createSut();
      httpClient.post.mockResolvedValue({ ok: true, value: { message: '', todo: INVALID_DTO } });

      // When
      const result = service.addSubTodo(1, { title: '새 항목' });

      // Then
      await expect(result).rejects.toThrow('Invalid addSubTodo response');
    });
  });

  describe('updateSubTodo', () => {
    it('응답을 받으면 Todo를 반환한다', async () => {
      // Given
      const { httpClient, service } = createSut();
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

    it('HTTP 에러 → Result.err 반환', async () => {
      // Given
      const { httpClient, service } = createSut();
      const apiError = createTodoApiError({ code: 'TODO_0822' });
      httpClient.patch.mockResolvedValue({ ok: false, error: apiError });

      // When
      const result = await service.updateSubTodo(1, 10, { title: '수정' });

      // Then
      expect(result).toEqual({ ok: false, error: apiError });
    });

    it('Zod 검증 실패 → ParseError throw', async () => {
      // Given
      const { httpClient, service } = createSut();
      httpClient.patch.mockResolvedValue({
        ok: true,
        value: { message: '', todo: INVALID_DTO },
      });

      // When
      const result = service.updateSubTodo(1, 10, { title: '수정' });

      // Then
      await expect(result).rejects.toThrow('Invalid updateSubTodo response');
    });
  });

  describe('deleteSubTodo', () => {
    it('응답을 받으면 Todo를 반환한다', async () => {
      // Given
      const { httpClient, service } = createSut();
      const todo = createTodoDto();
      httpClient.delete.mockResolvedValue({ ok: true, value: { message: '삭제됨', todo } });

      // When
      const result = await service.deleteSubTodo(1, 10);

      // Then
      expect(httpClient.delete).toHaveBeenCalledWith('v1/todos/1/items/10');
      expect(result.ok).toBe(true);
    });

    it('HTTP 에러 → Result.err 반환', async () => {
      // Given
      const { httpClient, service } = createSut();
      const apiError = createTodoApiError({ code: 'TODO_0822' });
      httpClient.delete.mockResolvedValue({ ok: false, error: apiError });

      // When
      const result = await service.deleteSubTodo(1, 10);

      // Then
      expect(result).toEqual({ ok: false, error: apiError });
    });

    it('Zod 검증 실패 → ParseError throw', async () => {
      // Given
      const { httpClient, service } = createSut();
      httpClient.delete.mockResolvedValue({
        ok: true,
        value: { message: '', todo: INVALID_DTO },
      });

      // When
      const result = service.deleteSubTodo(1, 10);

      // Then
      await expect(result).rejects.toThrow('Invalid deleteSubTodo response');
    });
  });

  describe('reorderSubTodos', () => {
    it('응답을 받으면 Todo를 반환한다', async () => {
      // Given
      const { httpClient, service } = createSut();
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

    it('HTTP 에러 → Result.err 반환', async () => {
      // Given
      const { httpClient, service } = createSut();
      const apiError = createTodoApiError();
      httpClient.patch.mockResolvedValue({ ok: false, error: apiError });

      // When
      const result = await service.reorderSubTodos(1, { itemIds: [3, 1, 2] });

      // Then
      expect(result).toEqual({ ok: false, error: apiError });
    });

    it('Zod 검증 실패 → ParseError throw', async () => {
      // Given
      const { httpClient, service } = createSut();
      httpClient.patch.mockResolvedValue({
        ok: true,
        value: { message: '', todo: INVALID_DTO },
      });

      // When
      const result = service.reorderSubTodos(1, { itemIds: [3, 1, 2] });

      // Then
      await expect(result).rejects.toThrow('Invalid reorderSubTodos response');
    });
  });
});
