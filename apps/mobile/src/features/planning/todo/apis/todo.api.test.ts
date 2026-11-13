import { ok, unwrap } from '@src/core/errors/result';
import { createHttpClientStub } from '@src/testing/core';
import { createDateKey } from '@src/testing/date-key';

import {
  createTodoDto,
  createTodoFormValues,
  createTodoListResponseDto,
} from '../__tests__/todo.fixtures';
import type { TodoRepeat } from '../domains/todo-repeat.model';
import { TodoApi } from './todo.api';

function createSut() {
  const httpClient = createHttpClientStub();

  return { httpClient, api: new TodoApi(httpClient) };
}

describe('TodoApi', () => {
  it.each([
    {
      name: 'createTodo',
      call: (api: TodoApi) => api.createTodo(createTodoFormValues({ title: '테스트' })),
      method: 'post',
      args: ['v1/todos', expect.any(Object)],
    },
    {
      name: 'toggleTodoComplete',
      call: (api: TodoApi) => api.toggleTodoComplete(1, { completed: true }),
      method: 'patch',
      args: ['v1/todos/1/complete', { completed: true }],
    },
    {
      name: 'reorderTodo',
      call: (api: TodoApi) => api.reorderTodo(1, { position: 'after', targetTodoId: 2 }),
      method: 'patch',
      args: ['v1/todos/1/reorder', { position: 'after', targetTodoId: 2 }],
    },
    {
      name: 'changeTodoCategory',
      call: (api: TodoApi) => api.changeTodoCategory(1, { categoryId: 2 }),
      method: 'patch',
      args: ['v1/todos/1/category', { categoryId: 2 }],
    },
  ] as const)(
    '$name은 계약 경로로 보내고 응답을 할 일로 바꾼다',
    async ({ call, method, args }) => {
      // Given
      const { httpClient, api } = createSut();
      const response = ok({ message: 'ok', todo: createTodoDto() });
      httpClient.post.mockResolvedValue(response);
      httpClient.patch.mockResolvedValue(response);

      // When
      const result = await call(api);

      // Then
      expect(httpClient[method]).toHaveBeenCalledWith(...args);
      expect(result.ok).toBe(true);
    },
  );

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
  });

  describe('createRepeatingTodo', () => {
    const repeat: TodoRepeat = {
      frequency: 'WEEKLY',
      interval: 1,
      weekdays: ['MON', 'WED', 'FRI'],
      end: { type: 'UNTIL', date: createDateKey('2026-06-30') },
    };
    const draft = createTodoFormValues({
      title: '반복 할일',
      startDate: createDateKey('2026-03-09'),
      repeat,
    });

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
});
