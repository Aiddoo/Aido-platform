import { createMockHttpClient } from '@src/shared/__tests__';

import {
  createAiUsageResponseDto,
  createParseTodoResponseDto,
  createTodoApiError,
  createTodoDto,
  createTodoListResponseDto,
  INVALID_DTO,
} from '../__tests__/todo.factories';
import { TodoService } from './todo.service';

describe('TodoService', () => {
  let httpClient: ReturnType<typeof createMockHttpClient>;
  let service: TodoService;

  beforeEach(() => {
    httpClient = createMockHttpClient();
    service = new TodoService(httpClient);
  });

  // ── getTodos ─────────────────────────────────

  describe('getTodos', () => {
    test('정상 응답 → TodosResult 반환', async () => {
      // Given
      const dto = createTodoListResponseDto();
      httpClient.get.mockResolvedValue({ ok: true, value: dto });

      // When
      const result = await service.getTodos({
        size: 20,
        startDate: '2026-03-08',
        endDate: '2026-03-08',
      });

      // Then
      expect(httpClient.get).toHaveBeenCalledWith('v1/todos', {
        params: expect.objectContaining({ startDate: '2026-03-08' }),
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.todos).toHaveLength(1);
        expect(result.value.hasNext).toBe(false);
      }
    });

    test('HTTP 에러 → Result.err 반환', async () => {
      // Given
      const apiError = createTodoApiError();
      httpClient.get.mockResolvedValue({ ok: false, error: apiError });

      // When
      const result = await service.getTodos({
        size: 20,
        startDate: '2026-03-08',
        endDate: '2026-03-08',
      });

      // Then
      expect(result).toEqual({ ok: false, error: apiError });
    });

    test('Zod 검증 실패 → ParseError throw', async () => {
      // Given
      httpClient.get.mockResolvedValue({ ok: true, value: INVALID_DTO });

      // When & Then
      await expect(
        service.getTodos({ size: 20, startDate: '2026-03-08', endDate: '2026-03-08' }),
      ).rejects.toThrow('Invalid getTodos response');
    });
  });

  // ── createTodo ───────────────────────────────

  describe('createTodo', () => {
    test('정상 응답 → TodoItem 반환', async () => {
      // Given
      const todo = createTodoDto();
      httpClient.post.mockResolvedValue({ ok: true, value: { todo } });

      // When
      const result = await service.createTodo({
        title: '테스트',
        categoryId: 1,
        startDate: '2026-03-08',
        isAllDay: true,
        visibility: 'PUBLIC',
      });

      // Then
      expect(httpClient.post).toHaveBeenCalledWith('v1/todos', expect.any(Object));
      expect(result.ok).toBe(true);
    });

    test('프리미엄 한도 → TODO_0811 에러', async () => {
      // Given
      const apiError = createTodoApiError({
        code: 'TODO_0811',
        message: '할일 개수 한도에 도달했어요',
      });
      httpClient.post.mockResolvedValue({ ok: false, error: apiError });

      // When
      const result = await service.createTodo({
        title: '테스트',
        categoryId: 1,
        startDate: '2026-03-08',
        isAllDay: true,
        visibility: 'PUBLIC',
      });

      // Then
      expect(result).toEqual({ ok: false, error: apiError });
    });

    test('Zod 검증 실패 → ParseError throw', async () => {
      // Given
      httpClient.post.mockResolvedValue({ ok: true, value: { todo: INVALID_DTO } });

      // When & Then
      await expect(
        service.createTodo({
          title: '테스트',
          categoryId: 1,
          startDate: '2026-03-08',
          isAllDay: true,
          visibility: 'PUBLIC',
        }),
      ).rejects.toThrow('Invalid createTodo response');
    });
  });

  // ── toggleTodoComplete ───────────────────────

  describe('toggleTodoComplete', () => {
    test('정상 응답 → TodoItem 반환', async () => {
      // Given
      const todo = createTodoDto({ completed: true });
      httpClient.patch.mockResolvedValue({ ok: true, value: { todo } });

      // When
      const result = await service.toggleTodoComplete(1, { completed: true });

      // Then
      expect(httpClient.patch).toHaveBeenCalledWith('v1/todos/1/complete', { completed: true });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.completed).toBe(true);
      }
    });

    test('HTTP 에러 → Result.err 반환', async () => {
      // Given
      const apiError = createTodoApiError();
      httpClient.patch.mockResolvedValue({ ok: false, error: apiError });

      // When
      const result = await service.toggleTodoComplete(1, { completed: true });

      // Then
      expect(result).toEqual({ ok: false, error: apiError });
    });

    test('Zod 검증 실패 → ParseError throw', async () => {
      // Given
      httpClient.patch.mockResolvedValue({ ok: true, value: { todo: INVALID_DTO } });

      // When & Then
      await expect(service.toggleTodoComplete(1, { completed: true })).rejects.toThrow(
        'Invalid toggleTodoComplete response',
      );
    });
  });

  // ── deleteTodo ───────────────────────────────

  describe('deleteTodo', () => {
    test('정상 응답 → void 반환', async () => {
      // Given
      httpClient.delete.mockResolvedValue({
        ok: true,
        value: { message: '할일이 삭제되었습니다.' },
      });

      // When
      const result = await service.deleteTodo(1);

      // Then
      expect(httpClient.delete).toHaveBeenCalledWith('v1/todos/1');
      expect(result).toEqual({ ok: true, value: undefined });
    });

    test('HTTP 에러 → Result.err 반환', async () => {
      // Given
      const apiError = createTodoApiError();
      httpClient.delete.mockResolvedValue({ ok: false, error: apiError });

      // When
      const result = await service.deleteTodo(1);

      // Then
      expect(result).toEqual({ ok: false, error: apiError });
    });
  });

  // ── parseTodo ────────────────────────────────

  describe('parseTodo', () => {
    test('정상 응답 → ParsedTodoResult 반환', async () => {
      // Given
      const dto = createParseTodoResponseDto();
      httpClient.post.mockResolvedValue({ ok: true, value: dto });

      // When
      const result = await service.parseTodo('내일 오전 9시 회의');

      // Then
      expect(httpClient.post).toHaveBeenCalledWith('v1/ai/parse-todo', {
        text: '내일 오전 9시 회의',
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.data.startDate).toBeInstanceOf(Date);
      }
    });

    test('AI 사용량 초과 → AI_1303 에러', async () => {
      // Given
      const apiError = createTodoApiError({
        code: 'AI_1303',
        message: 'AI 사용량을 초과했어요',
      });
      httpClient.post.mockResolvedValue({ ok: false, error: apiError });

      // When
      const result = await service.parseTodo('테스트');

      // Then
      expect(result).toEqual({ ok: false, error: apiError });
    });

    test('Zod 검증 실패 → ParseError throw', async () => {
      // Given
      httpClient.post.mockResolvedValue({ ok: true, value: INVALID_DTO });

      // When & Then
      await expect(service.parseTodo('테스트')).rejects.toThrow('Invalid parseTodo response');
    });
  });

  // ── getAiUsage ───────────────────────────────

  describe('getAiUsage', () => {
    test('정상 응답 → AiUsage 반환', async () => {
      // Given
      const dto = createAiUsageResponseDto();
      httpClient.get.mockResolvedValue({ ok: true, value: dto });

      // When
      const result = await service.getAiUsage();

      // Then
      expect(httpClient.get).toHaveBeenCalledWith('v1/ai/usage');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.used).toBe(3);
        expect(result.value.limit).toBe(10);
      }
    });

    test('HTTP 에러 → Result.err 반환', async () => {
      // Given
      const apiError = createTodoApiError();
      httpClient.get.mockResolvedValue({ ok: false, error: apiError });

      // When
      const result = await service.getAiUsage();

      // Then
      expect(result).toEqual({ ok: false, error: apiError });
    });
  });

  // ── createRecurringTodo ──────────────────────

  describe('createRecurringTodo', () => {
    test('정상 응답 → TodoItem[] 반환', async () => {
      // Given
      const todos = [createTodoDto({ id: 1 }), createTodoDto({ id: 2 })];
      httpClient.post.mockResolvedValue({
        ok: true,
        value: { message: '반복 할 일이 2개 생성되었습니다.', todos, count: 2 },
      });

      // When
      const result = await service.createRecurringTodo({
        title: '반복 할일',
        categoryId: 1,
        startDate: '2026-03-08',
        endDate: '2026-06-30',
        daysOfWeek: ['MON', 'WED', 'FRI'],
        isAllDay: true,
        visibility: 'PUBLIC',
      });

      // Then
      expect(httpClient.post).toHaveBeenCalledWith('v1/todos/recurring', expect.any(Object));
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(2);
      }
    });

    test('반복 제한 → TODO_0813 에러', async () => {
      // Given
      const apiError = createTodoApiError({
        code: 'TODO_0813',
        message: '반복 할일 제한에 도달했어요',
      });
      httpClient.post.mockResolvedValue({ ok: false, error: apiError });

      // When
      const result = await service.createRecurringTodo({
        title: '반복',
        categoryId: 1,
        startDate: '2026-03-08',
        isAllDay: true,
        visibility: 'PUBLIC',
        endDate: '2026-06-30',
        daysOfWeek: ['MON'],
      });

      // Then
      expect(result).toEqual({ ok: false, error: apiError });
    });

    test('Zod 검증 실패 → ParseError throw', async () => {
      // Given
      httpClient.post.mockResolvedValue({ ok: true, value: INVALID_DTO });

      // When & Then
      await expect(
        service.createRecurringTodo({
          title: '반복',
          categoryId: 1,
          startDate: '2026-03-08',
          isAllDay: true,
          visibility: 'PUBLIC',
          endDate: '2026-06-30',
          daysOfWeek: ['MON'],
        }),
      ).rejects.toThrow('Invalid createRecurringTodo response');
    });
  });

  // ── reorderTodo ──────────────────────────────

  describe('reorderTodo', () => {
    test('정상 응답 → TodoItem 반환', async () => {
      // Given
      const todo = createTodoDto();
      httpClient.patch.mockResolvedValue({
        ok: true,
        value: { message: '할 일 순서가 변경되었습니다.', todo },
      });

      // When
      const result = await service.reorderTodo(1, { position: 'after', targetTodoId: 2 });

      // Then
      expect(httpClient.patch).toHaveBeenCalledWith('v1/todos/1/reorder', {
        position: 'after',
        targetTodoId: 2,
      });
      expect(result.ok).toBe(true);
    });

    test('HTTP 에러 → Result.err 반환', async () => {
      // Given
      const apiError = createTodoApiError();
      httpClient.patch.mockResolvedValue({ ok: false, error: apiError });

      // When
      const result = await service.reorderTodo(1, { position: 'after', targetTodoId: 2 });

      // Then
      expect(result).toEqual({ ok: false, error: apiError });
    });
  });
});
