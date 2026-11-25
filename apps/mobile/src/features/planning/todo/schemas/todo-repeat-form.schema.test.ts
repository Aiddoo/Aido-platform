import { WEEKDAYS } from '@aido/api/vocabulary';
import { createDateKey } from '@src/testing/date-key';

import {
  findTodoRepeatFormIssue,
  isTodoRepeatFormPreset,
  todoRepeatFormSchema,
  toTodoRepeat,
  type TodoRepeatFormIssue,
  type TodoRepeatFormValues,
  withTodoRepeatFormBiweeklyToggled,
  withTodoRepeatFormCalendarDate,
  withTodoRepeatFormDayToggled,
  withTodoRepeatFormMonthlyToggled,
  withTodoRepeatFormPreset,
} from './todo-repeat-form.schema';

const THURSDAY = createDateKey('2026-11-05');

function createValues(overrides: Partial<TodoRepeatFormValues> = {}): TodoRepeatFormValues {
  return {
    startDate: THURSDAY,
    weekdays: ['THU'],
    interval: 1,
    isMonthly: false,
    monthDay: null,
    endType: 'NEVER',
    untilDate: null,
    count: 10,
    ...overrides,
  };
}

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
    expect(findTodoRepeatFormIssue(values)).toBe(issue);
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

const TODAY_KEY = createDateKey('2026-11-02');

function createPickerValues(overrides: Partial<TodoRepeatFormValues> = {}): TodoRepeatFormValues {
  return {
    startDate: createDateKey('2026-11-02'),
    weekdays: ['MON'],
    interval: 1,
    isMonthly: false,
    monthDay: null,
    endType: 'UNTIL',
    untilDate: null,
    count: 10,
    ...overrides,
  };
}

describe('isTodoRepeatFormPreset', () => {
  it('격주나 매월이면 요일이 같아도 프리셋이 켜진 것으로 보지 않는다', () => {
    // Given
    const days = [...WEEKDAYS];

    // When
    const weekly = isTodoRepeatFormPreset(createPickerValues({ weekdays: days }), days);
    const biweekly = isTodoRepeatFormPreset(
      createPickerValues({ weekdays: days, interval: 2 }),
      days,
    );
    const monthly = isTodoRepeatFormPreset(
      createPickerValues({ weekdays: days, isMonthly: true }),
      days,
    );

    // Then
    expect(weekly).toBe(true);
    expect(biweekly).toBe(false);
    expect(monthly).toBe(false);
  });

  it('켜진 프리셋을 다시 누르면 요일을 비우고 꺼진 프리셋은 매주로 맞춘다', () => {
    // Given
    const days = [...WEEKDAYS];

    // When
    const cleared = withTodoRepeatFormPreset(createPickerValues({ weekdays: days }), days);
    const applied = withTodoRepeatFormPreset(
      createPickerValues({ interval: 2, isMonthly: true }),
      days,
    );

    // Then
    expect(cleared.weekdays).toEqual([]);
    expect(applied).toMatchObject({ weekdays: days, interval: 1, isMonthly: false });
  });

  it('격주는 켜고 끌 수 있고 매월을 끈다. 매월을 켜면 매주로 돌아간다', () => {
    // Given
    const monthly = createPickerValues({ isMonthly: true });
    const biweekly = createPickerValues({ interval: 2 });

    // When
    const fromMonthly = withTodoRepeatFormBiweeklyToggled(monthly);
    const fromBiweekly = withTodoRepeatFormBiweeklyToggled(biweekly);
    const toMonthly = withTodoRepeatFormMonthlyToggled(biweekly);

    // Then
    expect(fromMonthly).toMatchObject({ isMonthly: false, interval: 2 });
    expect(fromBiweekly.interval).toBe(1);
    expect(toMonthly).toMatchObject({ isMonthly: true, interval: 1 });
  });

  it('요일을 누르면 넣고 뺀다. 매월에서 누르면 그 요일 하나로 돌아간다', () => {
    // Given
    const weekly = createPickerValues({ weekdays: ['MON'] });
    const monthly = createPickerValues({ weekdays: ['MON', 'TUE'], isMonthly: true });

    // When
    const added = withTodoRepeatFormDayToggled(weekly, 'WED');
    const removed = withTodoRepeatFormDayToggled(weekly, 'MON');
    const fromMonthly = withTodoRepeatFormDayToggled(monthly, 'WED');

    // Then
    expect(added.weekdays).toEqual(['MON', 'WED']);
    expect(removed.weekdays).toEqual([]);
    expect(fromMonthly).toMatchObject({ weekdays: ['WED'], isMonthly: false });
  });
});

describe('withTodoRepeatFormCalendarDate', () => {
  it('오늘 이전은 값을 바꾸지 않는다', () => {
    // Given
    const values = createPickerValues();

    // When
    const next = withTodoRepeatFormCalendarDate(values, {
      dateKey: createDateKey('2026-11-01'),
      todayKey: TODAY_KEY,
    });

    // Then
    expect(next).toBe(values);
  });

  it('시작일 뒤를 누르면 그 날이 종료일이 된다', () => {
    // Given
    const values = createPickerValues({ endType: 'NEVER' });

    // When
    const next = withTodoRepeatFormCalendarDate(values, {
      dateKey: createDateKey('2026-11-20'),
      todayKey: TODAY_KEY,
    });

    // Then
    expect(next).toMatchObject({
      endType: 'UNTIL',
      untilDate: createDateKey('2026-11-20'),
    });
  });

  it('기간을 이미 골랐으면 누른 날부터 다시 시작한다', () => {
    // Given
    const values = createPickerValues({ untilDate: createDateKey('2026-11-20') });

    // When
    const next = withTodoRepeatFormCalendarDate(values, {
      dateKey: createDateKey('2026-11-25'),
      todayKey: TODAY_KEY,
    });

    // Then
    expect(next).toMatchObject({
      startDate: createDateKey('2026-11-25'),
      untilDate: null,
    });
  });

  it('시작일 앞을 누르면 시작일을 옮기고 시작일을 다시 누르면 그대로다', () => {
    // Given
    const values = createPickerValues({
      startDate: createDateKey('2026-11-09'),
      endType: 'NEVER',
    });

    // When
    const moved = withTodoRepeatFormCalendarDate(values, {
      dateKey: createDateKey('2026-11-03'),
      todayKey: TODAY_KEY,
    });
    const same = withTodoRepeatFormCalendarDate(values, {
      dateKey: createDateKey('2026-11-09'),
      todayKey: TODAY_KEY,
    });

    // Then
    expect(moved.startDate).toEqual(createDateKey('2026-11-03'));
    expect(same).toBe(values);
  });
});
