import { instantFromDate } from '@src/shared/date/native-date';

import {
  getTodoRepeatFormIssue,
  createTodoRepeatFormSchema,
  toTodoRepeat,
  type TodoRepeatFormIssue,
  type TodoRepeatFormValues,
} from './todo-repeat-form.schema';

const TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;
const todoRepeatFormSchema = createTodoRepeatFormSchema(TIME_ZONE);
const THURSDAY = instantFromDate(new Date(2026, 10, 5, 12));

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
        untilDate: instantFromDate(new Date(2026, 10, 6, 12)),
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
    expect(getTodoRepeatFormIssue(values, TIME_ZONE)).toBe(issue);
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
    expect(toTodoRepeat(values, TIME_ZONE)).toEqual({
      frequency: 'MONTHLY',
      monthDay: 5,
      end: { type: 'NEVER' },
    });
  });

  it('끝이 있어도 회차가 있으면 확인할 수 있다', () => {
    // Given
    const values = createValues({
      endType: 'UNTIL',
      untilDate: instantFromDate(new Date(2026, 10, 12, 12)),
    });

    // When
    const result = todoRepeatFormSchema.safeParse(values);

    // Then
    expect(result.success).toBe(true);
  });
});

describe('시간대에 따른 반복 규칙', () => {
  it('같은 순간도 시간대에 따라 매월 반복의 날짜와 요일이 달라진다', () => {
    // Given
    const startDate = instantFromDate(new Date('2026-11-06T15:30:00Z'));
    const values = createValues({ startDate, weekdays: [], isMonthly: true });

    // When
    const seoul = toTodoRepeat(values, 'Asia/Seoul');
    const losAngeles = toTodoRepeat(values, 'America/Los_Angeles');

    // Then
    expect(seoul).toMatchObject({ frequency: 'MONTHLY', monthDay: 7 });
    expect(losAngeles).toMatchObject({ frequency: 'MONTHLY', monthDay: 6 });
  });

  it('말일에 시작한 매월 반복은 31일 규칙을 유지한다', () => {
    // Given
    const values = createValues({
      startDate: instantFromDate(new Date('2026-10-31T03:00:00Z')),
      weekdays: [],
      isMonthly: true,
    });

    // When
    const repeat = toTodoRepeat(values, 'Asia/Seoul');

    // Then
    expect(repeat).toMatchObject({ frequency: 'MONTHLY', monthDay: 31 });
  });

  it('종료일은 고른 시간대의 날짜로 저장한다', () => {
    // Given
    const values = createValues({
      endType: 'UNTIL',
      untilDate: instantFromDate(new Date('2026-11-19T15:30:00Z')),
    });

    // When
    const seoul = toTodoRepeat(values, 'Asia/Seoul');
    const newYork = toTodoRepeat(values, 'America/New_York');

    // Then
    expect(seoul?.end).toEqual({ type: 'UNTIL', date: '2026-11-20' });
    expect(newYork?.end).toEqual({ type: 'UNTIL', date: '2026-11-19' });
  });
});
