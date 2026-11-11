import { createDateKey } from '@src/testing/date-key';

import {
  getTodoRepeatFormIssue,
  todoRepeatFormSchema,
  toTodoRepeat,
  type TodoRepeatFormIssue,
  type TodoRepeatFormValues,
} from './todo-repeat-form.schema';

const THURSDAY = createDateKey('2026-11-05');

const createValues = (overrides: Partial<TodoRepeatFormValues> = {}): TodoRepeatFormValues => ({
  startDate: THURSDAY,
  weekdays: ['THU'],
  interval: 1,
  isMonthly: false,
  monthDay: null,
  endType: 'NEVER',
  untilDate: null,
  count: 10,
  ...overrides,
});

describe('todoRepeatFormSchema', () => {
  const CASES: [string, Partial<TodoRepeatFormValues>, TodoRepeatFormIssue, string][] = [
    ['요일 없음', { weekdays: [] }, 'no-weekdays', 'weekdays'],
    ['날짜 종료인데 종료일 없음', { endType: 'UNTIL' }, 'until-required', 'untilDate'],
    [
      '기간 안에 회차 없음',
      {
        weekdays: ['MON'],
        endType: 'UNTIL',
        untilDate: createDateKey('2026-11-06'),
      },
      'no-occurrence',
      'untilDate',
    ],
  ];

  it.each(CASES)('%s는 확인할 수 없다', (_title, overrides, issue, path) => {
    // Given
    const values = createValues(overrides);

    // When
    const result = todoRepeatFormSchema.safeParse(values);

    // Then
    expect(getTodoRepeatFormIssue(values)).toBe(issue);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(issue);
    expect(result.error?.issues[0]?.path).toEqual([path]);
  });

  it('요일이 비어도 매월이면 확인할 수 있다', () => {
    // Given
    const values = createValues({ weekdays: [], isMonthly: true });

    // When
    const result = todoRepeatFormSchema.safeParse(values);

    // Then
    expect(result.success).toBe(true);
    expect(toTodoRepeat(values)).toEqual({
      frequency: 'MONTHLY',
      monthDay: 5,
      end: { type: 'NEVER' },
    });
  });

  it('끝이 있어도 회차가 있으면 확인할 수 있다', () => {
    // Given
    const values = createValues({
      endType: 'UNTIL',
      untilDate: createDateKey('2026-11-12'),
    });

    // When
    const result = todoRepeatFormSchema.safeParse(values);

    // Then
    expect(result.success).toBe(true);
  });
});

describe('toTodoRepeat', () => {
  it('말일에 시작한 매월 반복은 31일 규칙을 유지한다', () => {
    // Given
    const values = createValues({
      startDate: createDateKey('2026-10-31'),
      weekdays: [],
      isMonthly: true,
    });

    // When
    const repeat = toTodoRepeat(values);

    // Then
    expect(repeat).toMatchObject({ frequency: 'MONTHLY', monthDay: 31 });
  });
});
