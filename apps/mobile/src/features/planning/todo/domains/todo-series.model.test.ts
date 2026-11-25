import { createDateKey } from '@src/testing/date-key';

import { isBeyondRepeatHorizon, isMonthBeyondRepeatHorizon } from './todo-series.model';

const HORIZON_TODAY = createDateKey('2026-11-05');

describe('isBeyondRepeatHorizon', () => {
  it.each([
    { title: '오늘은 미리 만든 범위 안이다', dateKey: '2026-11-05', expected: false },
    { title: '오늘 + 90일은 미리 만든 범위 안이다', dateKey: '2027-02-03', expected: false },
    { title: '오늘 + 91일부터는 미리 만든 범위를 넘는다', dateKey: '2027-02-04', expected: true },
  ])('$title', ({ dateKey, expected }) => {
    // When
    const result = isBeyondRepeatHorizon(createDateKey(dateKey), HORIZON_TODAY);

    // Then
    expect(result).toBe(expected);
  });
});

describe('isMonthBeyondRepeatHorizon', () => {
  it.each([
    { title: '말일이 범위 안인 달은 넘어간 달이 아니다', dateKey: '2027-01-15', expected: false },
    {
      title: '말일이 범위를 넘는 달은 월초여도 넘어간 달이다',
      dateKey: '2027-02-01',
      expected: true,
    },
    { title: '범위를 완전히 벗어난 달은 넘어간 달이다', dateKey: '2027-03-01', expected: true },
  ])('$title', ({ dateKey, expected }) => {
    // When
    const result = isMonthBeyondRepeatHorizon(createDateKey(dateKey), HORIZON_TODAY);

    // Then
    expect(result).toBe(expected);
  });
});
