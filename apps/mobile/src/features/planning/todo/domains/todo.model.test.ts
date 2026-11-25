import { TODO_LIMITS } from '@aido/api/vocabulary';
import { toInstant } from '@src/shared/date/instant';
import { createDateKey } from '@src/testing/date-key';

import { createParentTodo, createSubTodo } from '../__tests__/sub-todo.fixtures';
import { SubTodoPolicy } from './sub-todo.model';
import type { TodoRepeat } from './todo-repeat.model';
import { createTodoTitle, TodoPolicy } from './todo.model';

function createParentOf(subTodos: ReturnType<typeof createSubTodo>[]) {
  return createParentTodo({ subTodos });
}

describe('createTodoTitle', () => {
  it('한도 안의 글은 그대로 제목이 된다', () => {
    // When
    const title = createTodoTitle('장보기');

    // Then
    expect(title).toBe('장보기');
  });

  it('한도에 걸친 이모지는 반으로 자르지 않고 뺀다', () => {
    // Given
    // 이모지가 UTF-16 두 칸이라 한도(100)의 마지막 칸과 그다음 칸에 걸친다. `slice(0, 100)`은 앞 반쪽만 남겨 깨진 글자가 된다
    const text = `${'가'.repeat(TODO_LIMITS.TITLE_MAX_LENGTH - 1)}😀끝`;

    // When
    const title = createTodoTitle(text);

    // Then
    expect(title).toBe('가'.repeat(TODO_LIMITS.TITLE_MAX_LENGTH - 1));
    expect(title).not.toBe(text.slice(0, TODO_LIMITS.TITLE_MAX_LENGTH));
  });
});

const REPEAT_RULE: TodoRepeat = {
  frequency: 'WEEKLY',
  interval: 1,
  weekdays: ['MON'],
  end: { type: 'NEVER' },
};
const RULE_OCCURRENCE = createParentTodo({ recurrenceGroupId: 'series-1', repeat: REPEAT_RULE });
const RULELESS_OCCURRENCE = createParentTodo({ recurrenceGroupId: 'old-group', repeat: null });
const SINGLE_TODO = createParentTodo({ recurrenceGroupId: null, repeat: null });

describe('TodoPolicy', () => {
  describe('findLocalTime', () => {
    const instant = toInstant('2026-11-05T01:00:00.000Z');

    it('서버가 준 벽시계는 시간대를 바꿔도 같은 오전 10시다', () => {
      // Given
      const todo = createParentTodo({ isAllDay: false, localTime: '10:00', scheduledAt: instant });

      // When
      const seoul = TodoPolicy.findLocalTime(todo, 'Asia/Seoul');
      const newYork = TodoPolicy.findLocalTime(todo, 'America/New_York');

      // Then
      expect(seoul).toBe('10:00');
      expect(newYork).toBe('10:00');
    });

    it('서버가 벽시계 칸을 비운 시간 행은 보는 순간의 시간대로 계산한다', () => {
      // Given
      const todo = createParentTodo({ isAllDay: false, localTime: null, scheduledAt: instant });

      // When
      const seoul = TodoPolicy.findLocalTime(todo, 'Asia/Seoul');
      const newYork = TodoPolicy.findLocalTime(todo, 'America/New_York');

      // Then
      expect(seoul).toBe('10:00');
      expect(newYork).toBe('20:00');
    });

    it('서머타임이 시작되는 날도 순간을 그 날의 오프셋으로 계산한다', () => {
      // Given
      const todo = createParentTodo({
        isAllDay: false,
        localTime: null,
        scheduledAt: toInstant('2026-03-08T07:30:00.000Z'),
      });

      // When
      const time = TodoPolicy.findLocalTime(todo, 'America/New_York');

      // Then
      expect(time).toBe('03:30');
    });

    it('종일이거나 시간이 없으면 null이다', () => {
      // Given
      const allDay = createParentTodo({ isAllDay: true, localTime: '10:00', scheduledAt: instant });
      const noTime = createParentTodo({ isAllDay: false, localTime: null, scheduledAt: null });

      // When
      const allDayTime = TodoPolicy.findLocalTime(allDay, 'Asia/Seoul');
      const noTimeTime = TodoPolicy.findLocalTime(noTime, 'Asia/Seoul');

      // Then
      expect(allDayTime).toBeNull();
      expect(noTimeTime).toBeNull();
    });
  });

  describe('isTodoOnDate', () => {
    it.each([
      {
        title: '하루짜리는 그날만 포함한다',
        todo: { startDate: createDateKey('2026-11-05'), endDate: null },
        date: createDateKey('2026-11-05'),
        expected: true,
      },
      {
        title: '하루짜리는 다음 날에는 포함하지 않는다',
        todo: { startDate: createDateKey('2026-11-05'), endDate: null },
        date: createDateKey('2026-11-06'),
        expected: false,
      },
      {
        title: '여러 날은 시작일을 포함한다',
        todo: { startDate: createDateKey('2026-11-05'), endDate: createDateKey('2026-11-07') },
        date: createDateKey('2026-11-05'),
        expected: true,
      },
      {
        title: '여러 날은 종료일을 포함한다',
        todo: { startDate: createDateKey('2026-11-05'), endDate: createDateKey('2026-11-07') },
        date: createDateKey('2026-11-07'),
        expected: true,
      },
      {
        title: '여러 날은 시작일 전날을 포함하지 않는다',
        todo: { startDate: createDateKey('2026-11-05'), endDate: createDateKey('2026-11-07') },
        date: createDateKey('2026-11-04'),
        expected: false,
      },
      {
        title: '여러 날은 종료일 다음 날을 포함하지 않는다',
        todo: { startDate: createDateKey('2026-11-05'), endDate: createDateKey('2026-11-07') },
        date: createDateKey('2026-11-08'),
        expected: false,
      },
    ])('$title', ({ todo, date, expected }) => {
      // When
      const result = TodoPolicy.isTodoOnDate(createParentTodo(todo), date);

      // Then
      expect(result).toBe(expected);
    });
  });

  describe('isMultiDayTodo', () => {
    it.each([
      { title: '종료일이 없으면 여러 날이 아니다', endDate: null, expected: false },
      {
        title: '종료일이 시작일과 같으면 여러 날이 아니다',
        endDate: createDateKey('2026-11-05'),
        expected: false,
      },
      {
        title: '종료일이 시작일보다 늦으면 여러 날이다',
        endDate: createDateKey('2026-11-06'),
        expected: true,
      },
    ])('$title', ({ endDate, expected }) => {
      // Given
      const todo = createParentTodo({ startDate: createDateKey('2026-11-05'), endDate });

      // When
      const result = TodoPolicy.isMultiDayTodo(todo);

      // Then
      expect(result).toBe(expected);
    });
  });

  describe('isOptimisticTodo', () => {
    it.each([
      { title: 'id가 음수이면 서버 응답 전의 임시 행이다', id: -1, expected: true },
      { title: 'id가 양수이면 저장된 행이다', id: 1, expected: false },
    ])('$title', ({ id, expected }) => {
      // When
      const result = TodoPolicy.isOptimisticTodo(createParentTodo({ id }));

      // Then
      expect(result).toBe(expected);
    });
  });

  describe('findSubTodo', () => {
    const first = createSubTodo({ id: 11, title: '물 사기' });
    const second = createSubTodo({ id: 12, title: '우유 사기', sortOrder: 1 });

    it('할 일의 하위 할 일 중 같은 id를 찾는다', () => {
      // Given
      const todo = createParentTodo({ subTodos: [first, second] });

      // When
      const result = TodoPolicy.findSubTodo(todo, 12);

      // Then
      expect(result).toEqual(second);
    });

    it('하위 할 일에 없는 id면 null이다', () => {
      // Given
      const todo = createParentTodo({ subTodos: [first, second] });

      // When
      const result = TodoPolicy.findSubTodo(todo, 13);

      // Then
      expect(result).toBeNull();
    });

    it('할 일을 아직 찾지 못했으면 null이다', () => {
      // When
      const result = TodoPolicy.findSubTodo(null, 11);

      // Then
      expect(result).toBeNull();
    });
  });

  describe('isRecurringTodo', () => {
    it('반복 묶음에 속한 할 일은 반복 할 일이다', () => {
      // Given
      const todo = createParentTodo({ recurrenceGroupId: 'group-1' });

      // When
      const result = TodoPolicy.isRecurringTodo(todo);

      // Then
      expect(result).toBe(true);
    });

    it('반복 묶음이 없으면 한 번만 하는 할 일이다', () => {
      // Given
      const todo = createParentTodo({ recurrenceGroupId: null });

      // When
      const result = TodoPolicy.isRecurringTodo(todo);

      // Then
      expect(result).toBe(false);
    });
  });

  describe('hasRepeatRule', () => {
    it.each([
      { title: '규칙 있는 회차는 반복 규칙이 있다', todo: RULE_OCCURRENCE, expected: true },
      { title: '규칙 없는 묶음은 반복 규칙이 없다', todo: RULELESS_OCCURRENCE, expected: false },
      { title: '단일 할 일은 반복 규칙이 없다', todo: SINGLE_TODO, expected: false },
    ])('$title', ({ todo, expected }) => {
      // When
      const result = TodoPolicy.hasRepeatRule(todo);

      // Then
      expect(result).toBe(expected);
    });
  });

  describe('canChangeRepeat', () => {
    it.each([
      { title: '규칙 있는 회차는 반복을 바꿀 수 있다', todo: RULE_OCCURRENCE, expected: true },
      { title: '규칙 없는 묶음은 반복을 바꿀 수 없다', todo: RULELESS_OCCURRENCE, expected: false },
      { title: '단일 할 일은 반복을 새로 정할 수 있다', todo: SINGLE_TODO, expected: true },
    ])('$title', ({ todo, expected }) => {
      // When
      const result = TodoPolicy.canChangeRepeat(todo);

      // Then
      expect(result).toBe(expected);
    });
  });

  describe('getDeleteScopes', () => {
    it.each([
      {
        title: '규칙 있는 회차는 이번만, 이후 전체, 전체를 고를 수 있다',
        todo: RULE_OCCURRENCE,
        expected: ['THIS_ONLY', 'THIS_AND_FOLLOWING', 'ALL'],
      },
      {
        title: '규칙 없는 묶음은 이후 전체를 정할 수 없어 이번만과 전체만 고른다',
        todo: RULELESS_OCCURRENCE,
        expected: ['THIS_ONLY', 'ALL'],
      },
      { title: '단일 할 일은 고를 범위가 없다', todo: SINGLE_TODO, expected: [] },
    ])('$title', ({ todo, expected }) => {
      // When
      const scopes = TodoPolicy.getDeleteScopes(todo);

      // Then
      expect(scopes).toEqual(expected);
    });
  });

  describe('getTodayToggleDates', () => {
    const TODAY = createDateKey('2026-03-08');

    it('오늘 시작한 할 일은 내일로 옮긴다', () => {
      // Given
      const todo = createParentTodo({ startDate: TODAY, endDate: null });

      // When
      const result = TodoPolicy.getTodayToggleDates(todo, TODAY);

      // Then
      // 2026-03-08 + 1일 = 2026-03-09
      expect(result).toEqual({ startDate: '2026-03-09', endDate: null });
    });

    it('다른 날 할 일은 오늘로 옮긴다', () => {
      // Given
      const yesterday = createParentTodo({ startDate: createDateKey('2026-03-07'), endDate: null });
      const tomorrow = createParentTodo({ startDate: createDateKey('2026-03-09'), endDate: null });

      // When
      const fromYesterday = TodoPolicy.getTodayToggleDates(yesterday, TODAY);
      const fromTomorrow = TodoPolicy.getTodayToggleDates(tomorrow, TODAY);

      // Then
      expect(fromYesterday).toEqual({ startDate: TODAY, endDate: null });
      expect(fromTomorrow).toEqual({ startDate: TODAY, endDate: null });
    });

    it('끝 날짜가 새 시작일보다 하루 앞서면 지운다', () => {
      // Given
      const todo = createParentTodo({
        startDate: createDateKey('2026-03-05'),
        endDate: createDateKey('2026-03-07'),
      });

      // When
      const result = TodoPolicy.getTodayToggleDates(todo, TODAY);

      // Then
      // 끝 2026-03-07 < 새 시작 2026-03-08
      expect(result).toEqual({ startDate: TODAY, endDate: null });
    });

    it('끝 날짜가 새 시작일과 같거나 뒤면 남긴다', () => {
      // Given
      const endsToday = createParentTodo({
        startDate: createDateKey('2026-03-05'),
        endDate: TODAY,
      });
      const endsTomorrow = createParentTodo({
        startDate: createDateKey('2026-03-05'),
        endDate: createDateKey('2026-03-09'),
      });

      // When
      const sameDay = TodoPolicy.getTodayToggleDates(endsToday, TODAY);
      const dayAfter = TodoPolicy.getTodayToggleDates(endsTomorrow, TODAY);

      // Then
      expect(sameDay).toEqual({ startDate: TODAY, endDate: TODAY });
      expect(dayAfter).toEqual({ startDate: TODAY, endDate: '2026-03-09' });
    });

    it('오늘 끝나는 여러 날 할 일을 내일로 옮기면 지난 끝 날짜를 지운다', () => {
      // Given
      const endsToday = createParentTodo({ startDate: TODAY, endDate: TODAY });
      const endsLater = createParentTodo({
        startDate: TODAY,
        endDate: createDateKey('2026-03-10'),
      });

      // When
      const shortened = TodoPolicy.getTodayToggleDates(endsToday, TODAY);
      const kept = TodoPolicy.getTodayToggleDates(endsLater, TODAY);

      // Then
      // 끝 2026-03-08 < 새 시작 2026-03-09, 끝 2026-03-10 >= 2026-03-09
      expect(shortened).toEqual({ startDate: '2026-03-09', endDate: null });
      expect(kept).toEqual({ startDate: '2026-03-09', endDate: '2026-03-10' });
    });

    it('달의 마지막 날에 오늘 할 일을 옮기면 다음 달 1일이다', () => {
      // Given
      const todo = createParentTodo({ startDate: createDateKey('2026-03-31'), endDate: null });

      // When
      const result = TodoPolicy.getTodayToggleDates(todo, createDateKey('2026-03-31'));

      // Then
      expect(result).toEqual({ startDate: '2026-04-01', endDate: null });
    });
  });

  describe('canNudgeOnDate', () => {
    const TODAY_KEY = createDateKey('2026-02-25');
    const NEXT_DAY_KEY = createDateKey('2026-02-26');

    it('미완료 + 오늘이면 true를 반환한다', () => {
      // Given
      const todo = createParentTodo({ completed: false });

      // When
      const result = TodoPolicy.canNudgeOnDate(todo, TODAY_KEY, TODAY_KEY);

      // Then
      expect(result).toBe(true);
    });

    it('완료된 할 일은 오늘이어도 false를 반환한다', () => {
      // Given
      const todo = createParentTodo({ completed: true });

      // When
      const result = TodoPolicy.canNudgeOnDate(todo, TODAY_KEY, TODAY_KEY);

      // Then
      expect(result).toBe(false);
    });

    it('미완료여도 오늘이 아니면 false를 반환한다', () => {
      // Given
      const todo = createParentTodo({ completed: false });

      // When
      const result = TodoPolicy.canNudgeOnDate(todo, NEXT_DAY_KEY, TODAY_KEY);

      // Then
      expect(result).toBe(false);
    });
  });

  describe('hasTimeChanged', () => {
    const todo = createParentTodo({ isAllDay: false, localTime: '10:00' });
    const allDayTodo = createParentTodo({ isAllDay: true, localTime: null });

    it.each([
      [
        '같은 시각을 다시 고르면 바뀐 것이 아니다',
        todo,
        { isAllDay: false, scheduledTime: '10:00' },
        false,
      ],
      ['다른 시각을 고르면 바뀐 것이다', todo, { isAllDay: false, scheduledTime: '11:00' }, true],
      [
        '시각이 있던 할 일을 종일로 바꾸면 바뀐 것이다',
        todo,
        { isAllDay: true, scheduledTime: '10:00' },
        true,
      ],
      [
        '종일 할 일에 종일을 다시 고르면 남은 시각이 달라도 바뀐 것이 아니다',
        allDayTodo,
        { isAllDay: true, scheduledTime: '11:00' },
        false,
      ],
    ])('%s', (_case, target, picked, expected) => {
      // When
      const hasChanged = TodoPolicy.hasTimeChanged(target, picked, 'Asia/Seoul');

      // Then
      expect(hasChanged).toBe(expected);
    });
  });

  describe('findSubTodoSnapshot', () => {
    it('지울 항목과 그 자리를 함께 돌려준다', () => {
      // Given
      const target = createSubTodo({ id: 6 });
      const todo = createParentOf([createSubTodo({ id: 5 }), target]);

      // When
      const snapshot = TodoPolicy.findSubTodoSnapshot(todo, 6);

      // Then
      expect(snapshot).toEqual({ subTodo: target, index: 1 });
    });

    it('캐시에 없는 할 일이거나 목록에 없는 항목이면 null이다', () => {
      // Given
      const todo = createParentOf([createSubTodo({ id: 5 })]);

      // When
      const missingTodo = TodoPolicy.findSubTodoSnapshot(null, 5);
      const missingSubTodo = TodoPolicy.findSubTodoSnapshot(todo, 9);

      // Then
      expect(missingTodo).toBeNull();
      expect(missingSubTodo).toBeNull();
    });
  });

  describe('withSubTodoCompleted', () => {
    it('서브투두를 완료하면 목록과 통계가 함께 바뀐다', () => {
      // Given
      const parentTodo = createParentTodo({
        subTodos: [createSubTodo({ id: 1 }), createSubTodo({ id: 2 })],
      });

      // When
      const result = TodoPolicy.withSubTodoCompleted(parentTodo, 1, true);

      // Then
      expect(result.subTodos.map((subTodo) => subTodo.completed)).toEqual([true, false]);
      expect(SubTodoPolicy.getSubTodoStats(result.subTodos)).toEqual({ total: 2, completed: 1 });
    });

    it('이미 완료한 서브투두를 다시 완료해도 1/1을 넘지 않는다', () => {
      // Given
      const parentTodo = createParentTodo({
        subTodos: [createSubTodo({ id: 1, completed: true })],
      });

      // When
      const result = TodoPolicy.withSubTodoCompleted(parentTodo, 1, true);

      // Then
      expect(SubTodoPolicy.getSubTodoStats(result.subTodos)).toEqual({ total: 1, completed: 1 });
    });
  });

  describe('withSubTodoAdded', () => {
    it('미완료 부모에 항목을 더하면 목록과 전체 개수가 늘고 완료 개수는 그대로다', () => {
      // Given
      const parentTodo = createParentTodo({
        subTodos: [createSubTodo({ id: 1, completed: true })],
      });

      // When
      const result = TodoPolicy.withSubTodoAdded(parentTodo, createSubTodo({ id: 2 }));

      // Then
      expect(result.subTodos.map((subTodo) => subTodo.id)).toEqual([1, 2]);
      expect(SubTodoPolicy.getSubTodoStats(result.subTodos)).toEqual({ total: 2, completed: 1 });
    });

    it('완료한 부모에 항목을 더하면 남은 일이 생겨 완료가 풀린다', () => {
      // Given
      const parentTodo = createParentTodo({
        completed: true,
        subTodos: [createSubTodo({ id: 1, completed: true })],
      });

      // When
      const result = TodoPolicy.withSubTodoAdded(parentTodo, createSubTodo({ id: 2 }));

      // Then
      expect(result.completed).toBe(false);
    });

    it('미완료 부모에 항목을 더해도 미완료로 남는다', () => {
      // Given
      const parentTodo = createParentTodo({ completed: false });

      // When
      const result = TodoPolicy.withSubTodoAdded(parentTodo, createSubTodo({ id: 2 }));

      // Then
      expect(result.completed).toBe(false);
    });
  });

  describe('withSubTodoRemoved', () => {
    it('완료한 서브투두를 지우면 전체와 완료 개수가 함께 줄어든다', () => {
      // Given
      const parentTodo = createParentTodo({
        subTodos: [createSubTodo({ id: 1, completed: true }), createSubTodo({ id: 2 })],
      });

      // When
      const result = TodoPolicy.withSubTodoRemoved(parentTodo, 1);

      // Then
      expect(SubTodoPolicy.getSubTodoStats(result.subTodos)).toEqual({ total: 1, completed: 0 });
    });

    it('없는 서브투두를 지우려 하면 목록과 통계가 그대로다', () => {
      // Given
      const parentTodo = createParentTodo({
        subTodos: [createSubTodo({ id: 1, completed: true })],
      });

      // When
      const result = TodoPolicy.withSubTodoRemoved(parentTodo, 999);

      // Then
      expect(result.subTodos).toEqual(parentTodo.subTodos);
      expect(SubTodoPolicy.getSubTodoStats(result.subTodos)).toEqual({ total: 1, completed: 1 });
    });
  });

  describe('withSubTodoRenamed', () => {
    it('지정한 항목의 제목만 바뀌고 완료 상태와 통계는 그대로다', () => {
      // Given
      const parentTodo = createParentTodo({
        subTodos: [
          createSubTodo({ id: 1, title: '장보기', completed: true }),
          createSubTodo({ id: 2, title: '청소' }),
        ],
      });

      // When
      const result = TodoPolicy.withSubTodoRenamed(parentTodo, 1, '장보기 끝');

      // Then
      expect(result.subTodos).toEqual([
        createSubTodo({ id: 1, title: '장보기 끝', completed: true }),
        createSubTodo({ id: 2, title: '청소' }),
      ]);
      expect(SubTodoPolicy.getSubTodoStats(result.subTodos)).toEqual({ total: 2, completed: 1 });
    });

    it('없는 항목의 제목을 바꾸려 하면 목록이 그대로다', () => {
      // Given
      const parentTodo = createParentTodo({
        subTodos: [createSubTodo({ id: 1, title: '장보기' })],
      });

      // When
      const result = TodoPolicy.withSubTodoRenamed(parentTodo, 999, '새 제목');

      // Then
      expect(result.subTodos).toEqual(parentTodo.subTodos);
    });
  });

  describe('withSubTodoConfirmed', () => {
    it('임시 항목은 응답의 같은 제목 새 항목으로 바뀌고 진행 중인 다른 체크는 남는다', () => {
      // Given
      const optimistic = createSubTodo({ id: -3, title: '새 항목' });
      const checked = createSubTodo({ id: 5, title: '기존', completed: true });
      const saved = {
        subTodos: [
          createSubTodo({ id: 5, title: '기존', completed: false }),
          createSubTodo({ id: 9, title: '새 항목' }),
        ],
      };

      // When
      const result = TodoPolicy.withSubTodoConfirmed(
        createParentOf([checked, optimistic]),
        -3,
        saved,
      );

      // Then
      expect(result.subTodos).toEqual([checked, createSubTodo({ id: 9, title: '새 항목' })]);
    });

    it('임시 항목이 이미 없으면 응답으로 다시 넣지 않는다', () => {
      // Given
      const todo = createParentOf([createSubTodo({ id: 9, title: '새 항목' })]);
      const saved = { subTodos: [createSubTodo({ id: 9, title: '새 항목' })] };

      // When
      const result = TodoPolicy.withSubTodoConfirmed(todo, -3, saved);

      // Then
      expect(result).toBe(todo);
    });
  });

  describe('withSubTodoRestored', () => {
    it('지운 항목은 원래 자리로 돌아오고 숫자도 다시 계산한다', () => {
      // Given
      const removed = createSubTodo({ id: 6, completed: true });
      const todo = createParentOf([createSubTodo({ id: 5 }), createSubTodo({ id: 7 })]);

      // When
      const result = TodoPolicy.withSubTodoRestored(todo, { subTodo: removed, index: 1 });

      // Then
      expect(result.subTodos.map((subTodo) => subTodo.id)).toEqual([5, 6, 7]);
      expect(SubTodoPolicy.getSubTodoStats(result.subTodos)).toEqual({ total: 3, completed: 1 });
    });

    it('같은 id의 항목이 이미 있으면 다시 넣지 않는다', () => {
      // Given
      const todo = createParentOf([createSubTodo({ id: 5 })]);

      // When
      const result = TodoPolicy.withSubTodoRestored(todo, {
        subTodo: createSubTodo({ id: 5 }),
        index: 0,
      });

      // Then
      expect(result).toBe(todo);
    });
  });

  describe('withSubTodosOrdered', () => {
    it('순서를 정한 뒤 더한 항목은 사라지지 않고 뒤에 남는다', () => {
      // Given
      const todo = createParentOf([
        createSubTodo({ id: 5 }),
        createSubTodo({ id: 6 }),
        createSubTodo({ id: -1 }),
      ]);

      // When
      const result = TodoPolicy.withSubTodosOrdered(todo, [6, 5]);

      // Then
      expect(result.subTodos.map((subTodo) => subTodo.id)).toEqual([6, 5, -1]);
    });
  });
});
