import { unwrap } from '@src/core/errors/result';
import { createHttpClientStub } from '@src/testing/core';

import {
  createTodoApiError,
  createTodoDto,
  createTodoFormValues,
  createTodoListResponseDto,
  INVALID_DTO,
} from '../__tests__/todo.fixtures';
import type { TodoRepeat } from '../domains/todo-repeat.model';
import { TodoApi } from './todo.api';

function createSut() {
  const httpClient = createHttpClientStub();

  return { httpClient, api: new TodoApi(httpClient) };
}

describe('TodoApi', () => {
  describe('getTodos', () => {
    it('응답을 받으면 TodoListResult를 반환한다', async () => {
      // Given
      const { httpClient, api } = createSut();
      const dto = createTodoListResponseDto();
      httpClient.get.mockResolvedValue({ ok: true, value: dto });

      // When
      const result = await api.getTodos({
        size: 20,
        startDate: '2026-03-08',
        endDate: '2026-03-08',
      });

      // Then
      expect(httpClient.get).toHaveBeenCalledWith('v1/todos', {
        params: expect.objectContaining({ startDate: '2026-03-08' }),
      });
      expect(result.ok).toBe(true);
      const page = unwrap(result);
      expect(page.todos).toHaveLength(1);
      expect(page.hasNext).toBe(false);
    });

    it('응답에 모르는 반복 빈도가 있어도 목록은 살리고 그 할 일만 규칙을 비운다', async () => {
      // Given
      const { httpClient, api } = createSut();
      const dto = {
        ...createTodoListResponseDto(),
        items: [
          { ...createTodoDto({ id: 1 }), repeat: { frequency: 'YEARLY', end: { type: 'NEVER' } } },
          createTodoDto({
            id: 2,
            repeat: { frequency: 'DAILY', end: { type: 'NEVER' } },
          }),
        ],
      };
      httpClient.get.mockResolvedValue({ ok: true, value: dto });

      // When
      const result = await api.getTodos({ size: 20 });

      // Then
      expect(result.ok).toBe(true);
      const page = unwrap(result);
      expect(page.todos.map(({ id, repeat }) => ({ id, repeat }))).toEqual([
        { id: 1, repeat: null },
        { id: 2, repeat: { frequency: 'DAILY', end: { type: 'NEVER' } } },
      ]);
    });

    it('HTTP 에러 → Result.err 반환', async () => {
      // Given
      const { httpClient, api } = createSut();
      const apiError = createTodoApiError();
      httpClient.get.mockResolvedValue({ ok: false, error: apiError });

      // When
      const result = await api.getTodos({
        size: 20,
        startDate: '2026-03-08',
        endDate: '2026-03-08',
      });

      // Then
      expect(result).toEqual({ ok: false, error: apiError });
    });

    it('Zod 검증 실패 → ParseError throw', async () => {
      // Given
      const { httpClient, api } = createSut();
      httpClient.get.mockResolvedValue({ ok: true, value: INVALID_DTO });

      // When
      const result = api.getTodos({ size: 20, startDate: '2026-03-08', endDate: '2026-03-08' });

      // Then
      await expect(result).rejects.toThrow('Invalid getTodos response');
    });
  });

  describe('getTodoSummary', () => {
    it('요약할 날짜를 date 쿼리로 보내고 응답 날짜를 그대로 반환한다', async () => {
      // Given
      const { httpClient, api } = createSut();
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
      const result = await api.getTodoSummary('2026-07-13', controller.signal);

      // Then
      expect(httpClient.get).toHaveBeenCalledWith('v1/todos/summary', {
        signal: controller.signal,
        params: { date: '2026-07-13' },
      });
      expect(result.ok && result.value.date).toBe('2026-07-13');
    });
  });

  describe('createTodo', () => {
    it('응답을 받으면 Todo를 반환한다', async () => {
      // Given
      const { httpClient, api } = createSut();
      const todo = createTodoDto();
      httpClient.post.mockResolvedValue({ ok: true, value: { todo, message: '완료' } });

      // When
      const result = await api.createTodo(createTodoFormValues({ title: '테스트' }));

      // Then
      expect(httpClient.post).toHaveBeenCalledWith('v1/todos', expect.any(Object));
      expect(result.ok).toBe(true);
    });

    it('프리미엄 한도 → TODO_0811 에러', async () => {
      // Given
      const { httpClient, api } = createSut();
      const apiError = createTodoApiError({
        code: 'TODO_0811',
        message: '할일 개수 한도에 도달했어요',
      });
      httpClient.post.mockResolvedValue({ ok: false, error: apiError });

      // When
      const result = await api.createTodo(createTodoFormValues({ title: '테스트' }));

      // Then
      expect(result).toEqual({ ok: false, error: apiError });
    });

    it('Zod 검증 실패 → ParseError throw', async () => {
      // Given
      const { httpClient, api } = createSut();
      httpClient.post.mockResolvedValue({ ok: true, value: { todo: INVALID_DTO } });

      // When
      const result = api.createTodo(createTodoFormValues({ title: '테스트' }));

      // Then
      await expect(result).rejects.toThrow('Invalid createTodo response');
    });
  });

  describe('toggleTodoComplete', () => {
    it('응답에 모르는 반복 빈도가 있어도 완료 처리는 성공으로 읽고 규칙만 비운다', async () => {
      // Given
      const { httpClient, api } = createSut();
      const todo = { ...createTodoDto(), repeat: { frequency: 'YEARLY', end: { type: 'NEVER' } } };
      httpClient.patch.mockResolvedValue({ ok: true, value: { todo, message: '완료' } });

      // When
      const result = await api.toggleTodoComplete(1, { completed: true });

      // Then
      expect(result.ok && result.value.repeat).toBeNull();
    });

    it('응답을 받으면 Todo를 반환한다', async () => {
      // Given
      const { httpClient, api } = createSut();
      const todo = createTodoDto({ completed: true });
      httpClient.patch.mockResolvedValue({ ok: true, value: { todo, message: '완료' } });

      // When
      const result = await api.toggleTodoComplete(1, { completed: true });

      // Then
      expect(httpClient.patch).toHaveBeenCalledWith('v1/todos/1/complete', { completed: true });
      expect(result).toMatchObject({ ok: true, value: { completed: true } });
    });

    it('HTTP 에러 → Result.err 반환', async () => {
      // Given
      const { httpClient, api } = createSut();
      const apiError = createTodoApiError();
      httpClient.patch.mockResolvedValue({ ok: false, error: apiError });

      // When
      const result = await api.toggleTodoComplete(1, { completed: true });

      // Then
      expect(result).toEqual({ ok: false, error: apiError });
    });

    it('Zod 검증 실패 → ParseError throw', async () => {
      // Given
      const { httpClient, api } = createSut();
      httpClient.patch.mockResolvedValue({ ok: true, value: { todo: INVALID_DTO } });

      // When
      const result = api.toggleTodoComplete(1, { completed: true });

      // Then
      await expect(result).rejects.toThrow('Invalid toggleTodoComplete response');
    });
  });

  describe('deleteTodo', () => {
    it('응답을 받으면 void를 반환한다', async () => {
      // Given
      const { httpClient, api } = createSut();
      httpClient.delete.mockResolvedValue({
        ok: true,
        value: { message: '할일이 삭제되었습니다.' },
      });

      // When
      const result = await api.deleteTodo(1);

      // Then
      expect(httpClient.delete).toHaveBeenCalledWith('v1/todos/1');
      expect(result).toEqual({ ok: true, value: undefined });
    });

    it('HTTP 에러 → Result.err 반환', async () => {
      // Given
      const { httpClient, api } = createSut();
      const apiError = createTodoApiError();
      httpClient.delete.mockResolvedValue({ ok: false, error: apiError });

      // When
      const result = await api.deleteTodo(1);

      // Then
      expect(result).toEqual({ ok: false, error: apiError });
    });
  });

  describe('createRepeatingTodo', () => {
    const repeat: TodoRepeat = {
      frequency: 'WEEKLY',
      interval: 1,
      weekdays: ['MON', 'WED', 'FRI'],
      end: { type: 'UNTIL', date: '2026-06-30' },
    };
    const draft = createTodoFormValues({ title: '반복 할일', startDate: '2026-03-09', repeat });

    it('정상 응답 → POST /v1/todos의 repeat로 보내고 첫 회차를 돌려준다', async () => {
      // Given
      const { httpClient, api } = createSut();
      httpClient.post.mockResolvedValue({
        ok: true,
        value: {
          message: '할 일이 생성되었습니다.',
          todo: createTodoDto({ id: 1 }),
          series: {
            id: 'series-1',
            title: '반복 할일',
            categoryId: 1,
            visibility: 'PUBLIC',
            scheduledTime: null,
            timezone: 'Asia/Seoul',
            repeat,
            startDate: '2026-03-09',
            nextOccurrenceDate: '2026-03-11',
            isActive: true,
            checklist: [],
            createdAt: '2026-03-01T00:00:00.000Z',
            updatedAt: '2026-03-01T00:00:00.000Z',
          },
        },
      });

      // When
      const result = await api.createRepeatingTodo(draft);

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
      expect(result.ok && result.value.series.id).toBe('series-1');
    });

    it('반복 제한 → TODO_0813 에러', async () => {
      // Given
      const { httpClient, api } = createSut();
      const apiError = createTodoApiError({
        code: 'TODO_0813',
        message: '반복 할일 제한에 도달했어요',
      });
      httpClient.post.mockResolvedValue({ ok: false, error: apiError });

      // When
      const result = await api.createRepeatingTodo(draft);

      // Then
      expect(result).toEqual({ ok: false, error: apiError });
    });

    it('반복으로 만들었는데 응답에 규칙이 없으면 검증 실패로 던진다', async () => {
      // Given
      const { httpClient, api } = createSut();
      httpClient.post.mockResolvedValue({
        ok: true,
        value: { todo: createTodoDto({ id: 1 }), message: '생성' },
      });

      // When
      const result = api.createRepeatingTodo(draft);

      // Then
      await expect(result).rejects.toThrow('Invalid createRepeatingTodo response');
    });

    it('Zod 검증 실패 → ParseError throw', async () => {
      // Given
      const { httpClient, api } = createSut();
      httpClient.post.mockResolvedValue({ ok: true, value: INVALID_DTO });

      // When
      const result = api.createRepeatingTodo(draft);

      // Then
      await expect(result).rejects.toThrow('Invalid createRepeatingTodo response');
    });
  });

  describe('범위가 있는 수정·삭제', () => {
    it('범위를 고르지 않은 삭제는 쿼리 없이 보낸다', async () => {
      // Given
      const { httpClient, api } = createSut();
      httpClient.delete.mockResolvedValue({ ok: true, value: { message: '삭제' } });

      // When
      const result = await api.deleteTodo(1);

      // Then
      expect(httpClient.delete).toHaveBeenCalledWith('v1/todos/1');
      expect(result.ok).toBe(true);
    });

    it.each(['THIS_ONLY', 'THIS_AND_FOLLOWING', 'ALL'] as const)(
      '%s 삭제는 scope 쿼리로 보낸다',
      async (scope) => {
        // Given
        const { httpClient, api } = createSut();
        httpClient.delete.mockResolvedValue({ ok: true, value: { message: '삭제' } });

        // When
        await api.deleteTodo(1, scope);

        // Then
        expect(httpClient.delete).toHaveBeenCalledWith('v1/todos/1', { params: { scope } });
      },
    );

    it('이후까지 시간을 바꾸면 PATCH로 범위와 시간만 보낸다', async () => {
      // Given
      const { httpClient, api } = createSut();
      httpClient.patch.mockResolvedValue({
        ok: true,
        value: { message: '수정', todo: createTodoDto() },
      });

      // When
      await api.updateTodoSchedule(
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

    it('이 할 일만 시간을 바꾸면 기존 일정 경로를 쓴다', async () => {
      // Given
      const { httpClient, api } = createSut();
      httpClient.patch.mockResolvedValue({
        ok: true,
        value: { message: '수정', todo: createTodoDto() },
      });
      const input = { startDate: '2026-11-05', scheduledTime: '10:00', isAllDay: false };

      // When
      await api.updateTodoSchedule(1, input, 'THIS_ONLY');

      // Then
      expect(httpClient.patch).toHaveBeenCalledWith('v1/todos/1/schedule', input);
    });
  });

  describe('반복 규칙', () => {
    it('반복 끝내기는 repeat null로 PATCH한다', async () => {
      // Given
      const { httpClient, api } = createSut();
      httpClient.patch.mockResolvedValue({
        ok: true,
        value: { message: '수정', todo: createTodoDto() },
      });

      // When
      const result = await api.stopTodoSeries(1);

      // Then
      expect(httpClient.patch).toHaveBeenCalledWith('v1/todos/1', { repeat: null });
      expect(result.ok).toBe(true);
    });
  });

  describe('reorderTodo', () => {
    it('응답을 받으면 Todo를 반환한다', async () => {
      // Given
      const { httpClient, api } = createSut();
      const todo = createTodoDto();
      httpClient.patch.mockResolvedValue({
        ok: true,
        value: { message: '할 일 순서가 변경되었습니다.', todo },
      });

      // When
      const result = await api.reorderTodo(1, { position: 'after', targetTodoId: 2 });

      // Then
      expect(httpClient.patch).toHaveBeenCalledWith('v1/todos/1/reorder', {
        position: 'after',
        targetTodoId: 2,
      });
      expect(result.ok).toBe(true);
    });

    it('HTTP 에러 → Result.err 반환', async () => {
      // Given
      const { httpClient, api } = createSut();
      const apiError = createTodoApiError();
      httpClient.patch.mockResolvedValue({ ok: false, error: apiError });

      // When
      const result = await api.reorderTodo(1, { position: 'after', targetTodoId: 2 });

      // Then
      expect(result).toEqual({ ok: false, error: apiError });
    });
  });

  describe('changeTodoCategory', () => {
    it('응답을 받으면 Todo를 반환한다 (카테고리 변경됨)', async () => {
      // Given
      const { httpClient, api } = createSut();
      const todo = createTodoDto({
        category: { id: 2, name: '업무', color: '#EF4444', sortOrder: 1 },
      });
      httpClient.patch.mockResolvedValue({
        ok: true,
        value: { message: '카테고리가 변경되었습니다.', todo },
      });

      // When
      const result = await api.changeTodoCategory(1, { categoryId: 2 });

      // Then
      expect(httpClient.patch).toHaveBeenCalledWith('v1/todos/1/category', { categoryId: 2 });
      expect(result).toMatchObject({ ok: true, value: { category: { id: 2 } } });
    });

    it('HTTP 에러 → Result.err 반환', async () => {
      // Given
      const { httpClient, api } = createSut();
      const apiError = createTodoApiError();
      httpClient.patch.mockResolvedValue({ ok: false, error: apiError });

      // When
      const result = await api.changeTodoCategory(1, { categoryId: 2 });

      // Then
      expect(result).toEqual({ ok: false, error: apiError });
    });

    it('Zod 검증 실패 → ParseError throw', async () => {
      // Given
      const { httpClient, api } = createSut();
      httpClient.patch.mockResolvedValue({
        ok: true,
        value: { message: '카테고리가 변경되었습니다.', todo: INVALID_DTO },
      });

      // When
      const result = api.changeTodoCategory(1, { categoryId: 2 });

      // Then
      await expect(result).rejects.toThrow('Invalid changeTodoCategory response');
    });
  });
});
