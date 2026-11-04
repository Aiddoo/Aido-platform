import { createMockHttpClient } from '@src/shared/__tests__';

import {
  createTodoApiError,
  createTodoDto,
  createTodoListResponseDto,
  INVALID_DTO,
} from '../__tests__/todo.factories';
import type { RepeatingTodoDraft } from './todo-series.mapper';
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
    test('정상 응답 → TodoListResult 반환', async () => {
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

  describe('getTodoExistence', () => {
    test('날짜 조건 없이 전체·완료 할 일을 한 건씩 읽어 있는지를 돌려준다', async () => {
      // Given
      httpClient.get.mockImplementation(async (_url, options) =>
        options?.params?.completed === true
          ? { ok: true, value: createTodoListResponseDto({ items: [] }) }
          : { ok: true, value: createTodoListResponseDto() },
      );

      // When
      const result = await service.getTodoExistence();

      // Then
      expect(httpClient.get).toHaveBeenCalledWith('v1/todos', {
        params: expect.objectContaining({ size: 1, startDate: undefined, endDate: undefined }),
      });
      expect(result).toEqual({ ok: true, value: { hasTodo: true, hasCompletedTodo: false } });
    });

    test('한 요청이라도 실패하면 그 오류를 돌려준다', async () => {
      // Given
      const apiError = createTodoApiError();
      httpClient.get.mockResolvedValue({ ok: false, error: apiError });

      // When
      const result = await service.getTodoExistence();

      // Then
      expect(result).toEqual({ ok: false, error: apiError });
    });
  });

  // ── getTodoSummary ───────────────────────────

  describe('getTodoSummary', () => {
    test('요약할 날짜를 date 쿼리로 보내고 응답 날짜를 그대로 반환한다', async () => {
      // Given
      httpClient.get.mockResolvedValue({
        ok: true,
        value: {
          date: '2026-07-13',
          totalTodos: 0,
          completedTodos: 0,
          completionRate: 0,
          isComplete: false,
          currentStreak: 3,
          topTodos: [],
        },
      });
      const controller = new AbortController();

      // When
      const result = await service.getTodoSummary('2026-07-13', controller.signal);

      // Then
      expect(httpClient.get).toHaveBeenCalledWith('v1/todos/summary', {
        signal: controller.signal,
        params: { date: '2026-07-13' },
      });
      expect(result.ok && result.value.date).toBe('2026-07-13');
    });
  });

  // ── createTodo ───────────────────────────────

  describe('createTodo', () => {
    test('정상 응답 → Todo 반환', async () => {
      // Given
      const todo = createTodoDto();
      httpClient.post.mockResolvedValue({ ok: true, value: { todo, message: '완료' } });

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
    test('정상 응답 → Todo 반환', async () => {
      // Given
      const todo = createTodoDto({ completed: true });
      httpClient.patch.mockResolvedValue({ ok: true, value: { todo, message: '완료' } });

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

  // ── createRepeatingTodo ──────────────────────

  describe('createRepeatingTodo', () => {
    const draft: RepeatingTodoDraft = {
      title: '반복 할일',
      categoryId: 1,
      startDate: '2026-03-09',
      isAllDay: true,
      visibility: 'PUBLIC',
      repeat: {
        frequency: 'WEEKLY',
        interval: 1,
        weekdays: ['MON', 'WED', 'FRI'],
        end: { type: 'UNTIL', date: '2026-06-30' },
      },
    };

    test('정상 응답 → POST /v1/todos의 repeat로 보내고 첫 회차를 돌려준다', async () => {
      // Given
      httpClient.post.mockResolvedValue({
        ok: true,
        value: { message: '할 일이 생성되었습니다.', todo: createTodoDto({ id: 1 }) },
      });

      // When
      const result = await service.createRepeatingTodo(draft);

      // Then
      expect(httpClient.post).toHaveBeenCalledWith(
        'v1/todos',
        expect.objectContaining({
          startDate: '2026-03-09',
          repeat: {
            frequency: 'WEEKLY',
            interval: 1,
            weekdays: ['MON', 'WED', 'FRI'],
            end: { type: 'UNTIL', date: '2026-06-30' },
          },
        }),
      );
      expect(result.ok && result.value.todo.id).toBe(1);
      expect(result.ok && result.value.series).toBeNull();
    });

    test('반복 제한 → TODO_0813 에러', async () => {
      // Given
      const apiError = createTodoApiError({
        code: 'TODO_0813',
        message: '반복 할일 제한에 도달했어요',
      });
      httpClient.post.mockResolvedValue({ ok: false, error: apiError });

      // When
      const result = await service.createRepeatingTodo(draft);

      // Then
      expect(result).toEqual({ ok: false, error: apiError });
    });

    test('Zod 검증 실패 → ParseError throw', async () => {
      // Given
      httpClient.post.mockResolvedValue({ ok: true, value: INVALID_DTO });

      // When & Then
      await expect(service.createRepeatingTodo(draft)).rejects.toThrow(
        'Invalid createRepeatingTodo response',
      );
    });
  });

  describe('범위가 있는 수정·삭제', () => {
    test('범위를 고르지 않은 삭제는 쿼리 없이 보낸다', async () => {
      // Given
      httpClient.delete.mockResolvedValue({ ok: true, value: { message: '삭제' } });

      // When
      const result = await service.deleteTodo(1);

      // Then
      expect(httpClient.delete).toHaveBeenCalledWith('v1/todos/1');
      expect(result.ok).toBe(true);
    });

    test.each(['THIS_ONLY', 'THIS_AND_FOLLOWING', 'ALL'] as const)(
      '%s 삭제는 scope 쿼리로 보낸다',
      async (scope) => {
        // Given
        httpClient.delete.mockResolvedValue({ ok: true, value: { message: '삭제' } });

        // When
        await service.deleteTodo(1, scope);

        // Then
        expect(httpClient.delete).toHaveBeenCalledWith('v1/todos/1', { params: { scope } });
      },
    );

    test('이후까지 시간을 바꾸면 PATCH로 범위와 시간만 보낸다', async () => {
      // Given
      httpClient.patch.mockResolvedValue({
        ok: true,
        value: { message: '수정', todo: createTodoDto() },
      });

      // When
      await service.updateTodoSchedule(
        1,
        { startDate: '2026-11-05', scheduledTime: '10:00', isAllDay: false },
        'THIS_AND_FOLLOWING',
      );

      // Then
      expect(httpClient.patch).toHaveBeenCalledWith('v1/todos/1', {
        scheduledTime: '10:00',
        isAllDay: false,
        scope: 'THIS_AND_FOLLOWING',
      });
    });

    test('이 할 일만 시간을 바꾸면 기존 일정 경로를 쓴다', async () => {
      // Given
      httpClient.patch.mockResolvedValue({
        ok: true,
        value: { message: '수정', todo: createTodoDto() },
      });
      const input = { startDate: '2026-11-05', scheduledTime: '10:00', isAllDay: false };

      // When
      await service.updateTodoSchedule(1, input, 'THIS_ONLY');

      // Then
      expect(httpClient.patch).toHaveBeenCalledWith('v1/todos/1/schedule', input);
    });
  });

  describe('반복 규칙', () => {
    test('규칙을 읽어 앱 모델로 바꾼다', async () => {
      // Given
      httpClient.get.mockResolvedValue({
        ok: true,
        value: {
          id: 'series-1',
          title: '물 마시기',
          categoryId: 1,
          visibility: 'PUBLIC',
          scheduledTime: null,
          timezone: 'Asia/Seoul',
          repeat: { frequency: 'DAILY', end: { type: 'NEVER' } },
          startDate: '2026-11-02',
          nextOccurrenceDate: null,
          isActive: false,
          checklist: [],
          createdAt: '2026-11-02T00:00:00.000Z',
          updatedAt: '2026-11-02T00:00:00.000Z',
        },
      });

      // When
      const result = await service.getTodoSeries('series-1');

      // Then
      expect(httpClient.get).toHaveBeenCalledWith('v1/todo-series/series-1', {
        signal: undefined,
      });
      expect(result).toEqual({
        ok: true,
        value: {
          id: 'series-1',
          repeat: { frequency: 'DAILY', end: { type: 'NEVER' } },
          startDate: '2026-11-02',
        },
      });
    });

    test('규칙이 없는 옛 묶음(TODO_0841)은 null이다', async () => {
      // Given
      httpClient.get.mockResolvedValue({
        ok: false,
        error: createTodoApiError({ code: 'TODO_0841', message: '없음' }),
      });

      // When
      const result = await service.getTodoSeries('series-1');

      // Then
      expect(result).toEqual({ ok: true, value: null });
    });

    test('반복 끝내기는 repeat null로 PATCH한다', async () => {
      // Given
      httpClient.patch.mockResolvedValue({
        ok: true,
        value: { message: '수정', todo: createTodoDto() },
      });

      // When
      const result = await service.stopTodoSeries(1);

      // Then
      expect(httpClient.patch).toHaveBeenCalledWith('v1/todos/1', { repeat: null });
      expect(result.ok).toBe(true);
    });
  });

  // ── reorderTodo ──────────────────────────────

  describe('reorderTodo', () => {
    test('정상 응답 → Todo 반환', async () => {
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
