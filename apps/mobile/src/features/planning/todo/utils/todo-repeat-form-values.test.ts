import { instantFromDate } from '@src/shared/date/native-date';

import { TODO_REPEAT_WEEKDAYS } from '../constants/todo-repeat.constants';
import type { TodoRepeatFormValues } from '../schemas/todo-repeat-form.schema';
import {
  isTodoRepeatFormPreset,
  withTodoRepeatFormBiweeklyToggled,
  withTodoRepeatFormCalendarDate,
  withTodoRepeatFormDayToggled,
  withTodoRepeatFormMonthlyToggled,
  withTodoRepeatFormPreset,
  toTodoRepeatFormValues,
} from './todo-repeat-form-values';

const TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;
const TODAY = new Date(2026, 10, 2);

const createValues = (overrides: Partial<TodoRepeatFormValues> = {}): TodoRepeatFormValues => ({
  startDate: instantFromDate(new Date(2026, 10, 2)),
  weekdays: ['MON'],
  interval: 1,
  isMonthly: false,
  monthDay: null,
  endType: 'UNTIL',
  untilDate: null,
  count: 10,
  ...overrides,
});

describe('반복 요일 프리셋', () => {
  it('격주나 매월이면 요일이 같아도 프리셋이 켜진 것으로 보지 않는다', () => {
    // Given
    const days = [...TODO_REPEAT_WEEKDAYS];

    // When
    const weekly = isTodoRepeatFormPreset(createValues({ weekdays: days }), days);
    const biweekly = isTodoRepeatFormPreset(createValues({ weekdays: days, interval: 2 }), days);
    const monthly = isTodoRepeatFormPreset(createValues({ weekdays: days, isMonthly: true }), days);

    // Then
    expect(weekly).toBe(true);
    expect(biweekly).toBe(false);
    expect(monthly).toBe(false);
  });

  it('켜진 프리셋을 다시 누르면 요일을 비우고 꺼진 프리셋은 매주로 맞춘다', () => {
    // Given
    const days = [...TODO_REPEAT_WEEKDAYS];

    // When
    const cleared = withTodoRepeatFormPreset(createValues({ weekdays: days }), days);
    const applied = withTodoRepeatFormPreset(createValues({ interval: 2, isMonthly: true }), days);

    // Then
    expect(cleared.weekdays).toEqual([]);
    expect(applied).toMatchObject({ weekdays: days, interval: 1, isMonthly: false });
  });

  it('격주는 켜고 끌 수 있고 매월을 끈다. 매월을 켜면 매주로 돌아간다', () => {
    // Given
    const monthly = createValues({ isMonthly: true });
    const biweekly = createValues({ interval: 2 });

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
    const weekly = createValues({ weekdays: ['MON'] });
    const monthly = createValues({ weekdays: ['MON', 'TUE'], isMonthly: true });

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

describe('반복 달력에서 날짜 누르기', () => {
  it('오늘 이전은 값을 바꾸지 않는다', () => {
    // Given
    const values = createValues();

    // When
    const next = withTodoRepeatFormCalendarDate(values, {
      date: new Date(2026, 10, 1),
      today: TODAY,
      timeZone: TIME_ZONE,
    });

    // Then
    expect(next).toBe(values);
  });

  it('시작일 뒤를 누르면 그 날이 종료일이 된다', () => {
    // Given
    const values = createValues({ endType: 'NEVER' });
    const date = new Date(2026, 10, 20);

    // When
    const next = withTodoRepeatFormCalendarDate(values, {
      date: date,
      today: TODAY,
      timeZone: TIME_ZONE,
    });

    // Then
    expect(next).toMatchObject({ endType: 'UNTIL', untilDate: instantFromDate(date) });
  });

  it('기간을 이미 골랐으면 누른 날부터 다시 시작한다', () => {
    // Given
    const values = createValues({ untilDate: instantFromDate(new Date(2026, 10, 20)) });
    const date = new Date(2026, 10, 25);

    // When
    const next = withTodoRepeatFormCalendarDate(values, {
      date: date,
      today: TODAY,
      timeZone: TIME_ZONE,
    });

    // Then
    expect(next).toMatchObject({ startDate: instantFromDate(date), untilDate: null });
  });

  it('시작일 앞을 누르면 시작일을 옮기고 시작일을 다시 누르면 그대로다', () => {
    // Given
    const values = createValues({
      startDate: instantFromDate(new Date(2026, 10, 9)),
      endType: 'NEVER',
    });
    const earlier = new Date(2026, 10, 3);

    // When
    const moved = withTodoRepeatFormCalendarDate(values, {
      date: earlier,
      today: TODAY,
      timeZone: TIME_ZONE,
    });
    const same = withTodoRepeatFormCalendarDate(values, {
      date: new Date(2026, 10, 9),
      today: TODAY,
      timeZone: TIME_ZONE,
    });

    // Then
    expect(moved.startDate).toEqual(instantFromDate(earlier));
    expect(same).toBe(values);
  });
});

describe('반복 폼 값의 시간대', () => {
  it('시작 요일은 고른 시간대의 날짜로 정한다', () => {
    // Given
    const startDate = instantFromDate(new Date('2026-11-06T15:30:00Z'));

    // When
    const seoul = toTodoRepeatFormValues(startDate, null, 'Asia/Seoul');
    const losAngeles = toTodoRepeatFormValues(startDate, null, 'America/Los_Angeles');

    // Then
    expect(seoul.weekdays).toEqual(['SAT']);
    expect(losAngeles.weekdays).toEqual(['FRI']);
  });

  it('말일 규칙이 있는 폼을 열면 매월 며칠인지 규칙 값을 그대로 보여 준다', () => {
    // Given
    const startDate = instantFromDate(new Date('2026-02-28T03:00:00Z'));

    // When
    const values = toTodoRepeatFormValues(
      startDate,
      { frequency: 'MONTHLY', monthDay: 31, end: { type: 'NEVER' } },
      'Asia/Seoul',
    );

    // Then
    expect(values).toMatchObject({ isMonthly: true, monthDay: 31 });
  });
});
