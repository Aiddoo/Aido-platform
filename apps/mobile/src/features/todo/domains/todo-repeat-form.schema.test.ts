import {
  getTodoRepeatFormIssue,
  todoRepeatFormSchema,
  toTodoRepeat,
  type TodoRepeatFormIssue,
  type TodoRepeatFormValues,
} from './todo-repeat-form.schema';

const THURSDAY = new Date(2026, 10, 5, 12);

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
  const CASES: [string, Partial<TodoRepeatFormValues>, TodoRepeatFormIssue][] = [
    ['요일 없음', { weekdays: [] }, 'no-weekdays'],
    ['날짜 종료인데 종료일 없음', { endType: 'UNTIL' }, 'until-required'],
    [
      '기간 안에 회차 없음',
      { weekdays: ['MON'], endType: 'UNTIL', untilDate: new Date(2026, 10, 6, 12) },
      'no-occurrence',
    ],
  ];

  test.each(CASES)('%s는 확인할 수 없다', (_title, overrides, issue) => {
    // Given
    const values = createValues(overrides);

    // When
    const result = todoRepeatFormSchema.safeParse(values);

    // Then
    expect(getTodoRepeatFormIssue(values)).toBe(issue);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(issue);
  });

  test('요일이 비어도 매월이면 확인할 수 있다', () => {
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

  test('끝이 있어도 회차가 있으면 확인할 수 있다', () => {
    // Given
    const values = createValues({ endType: 'UNTIL', untilDate: new Date(2026, 10, 12, 12) });

    // When
    const result = todoRepeatFormSchema.safeParse(values);

    // Then
    expect(result.success).toBe(true);
  });
});
