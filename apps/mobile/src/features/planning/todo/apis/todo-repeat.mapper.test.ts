import { todoRepeatSchema } from '@aido/api';
import { createDateKey } from '@src/testing/date-key';

import type { TodoRepeat } from '../domains/todo-repeat.model';
import { toRepeat, toRepeatDto, toTodoRepeatFormValues } from './todo-repeat.mapper';

const DAILY: TodoRepeat = { frequency: 'DAILY', end: { type: 'NEVER' } };
const BIWEEKLY_COUNT: TodoRepeat = {
  frequency: 'WEEKLY',
  interval: 2,
  weekdays: ['TUE'],
  end: { type: 'COUNT', count: 10 },
};

const REPEATS: TodoRepeat[] = [
  DAILY,
  {
    frequency: 'WEEKLY',
    interval: 1,
    weekdays: ['MON', 'FRI'],
    end: { type: 'UNTIL', date: createDateKey('2026-12-31') },
  },
  BIWEEKLY_COUNT,
  { frequency: 'MONTHLY', monthDay: 31, end: { type: 'NEVER' } },
];

describe('toRepeat', () => {
  it.each(REPEATS)('계약 모양으로 보내고 되받으면 같은 규칙이다: %j', (repeat) => {
    // Given
    const dto = todoRepeatSchema.parse(toRepeatDto(repeat));

    // When
    const result = toRepeat(dto);

    // Then
    expect(result).toEqual(repeat);
  });
});

describe('toTodoRepeatFormValues', () => {
  it('시작 요일은 시작일의 요일로 정한다', () => {
    // When
    const values = toTodoRepeatFormValues(createDateKey('2026-11-07'), null);

    // Then
    expect(values.weekdays).toEqual(['SAT']);
  });

  it('말일 규칙이 있는 폼을 열면 매월 며칠인지 규칙 값을 그대로 보여 준다', () => {
    // When
    const values = toTodoRepeatFormValues(createDateKey('2026-02-28'), {
      frequency: 'MONTHLY',
      monthDay: 31,
      end: { type: 'NEVER' },
    });

    // Then
    expect(values).toMatchObject({ isMonthly: true, monthDay: 31 });
  });
});
