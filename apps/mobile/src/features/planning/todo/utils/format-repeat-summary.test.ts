import { createDateKey } from '@src/testing/date-key';
import '@src/shared/i18n/init';

import type { TodoRepeat } from '../domains/todo-repeat.model';
import {
  formatRepeatCadence,
  formatRepeatRuleLabel,
  formatRepeatSummary,
} from './format-repeat-summary';

const NEVER = { type: 'NEVER' } as const;

describe('formatRepeatCadence', () => {
  const CASES: [TodoRepeat, string][] = [
    [{ frequency: 'DAILY', end: NEVER }, '매일'],
    [
      {
        frequency: 'WEEKLY',
        interval: 1,
        weekdays: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'],
        end: NEVER,
      },
      '매일',
    ],
    [
      {
        frequency: 'WEEKLY',
        interval: 1,
        weekdays: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
        end: NEVER,
      },
      '주중',
    ],
    [{ frequency: 'WEEKLY', interval: 1, weekdays: ['SAT', 'SUN'], end: NEVER }, '주말'],
    [{ frequency: 'WEEKLY', interval: 1, weekdays: ['MON', 'THU'], end: NEVER }, '매주 월·목'],
    [{ frequency: 'WEEKLY', interval: 2, weekdays: ['TUE'], end: NEVER }, '격주 화'],
    [{ frequency: 'MONTHLY', monthDay: 15, end: { type: 'COUNT', count: 10 } }, '매월 15일'],
  ];

  it.each(CASES)('%j → %s', (repeat, expected) => {
    // When
    const label = formatRepeatCadence(repeat, 'ko');

    // Then
    expect(label).toBe(expected);
  });
});

describe('formatRepeatSummary', () => {
  it('주기 뒤에 끝나는 조건을 잇는다', () => {
    // When
    const label = formatRepeatSummary(
      { frequency: 'MONTHLY', monthDay: 15, end: { type: 'COUNT', count: 10 } },
      createDateKey('2026-11-09'),
      { locale: 'ko-KR', timeZone: 'Asia/Seoul' },
    );

    // Then
    expect(label).toBe('매월 15일 · 10회');
  });

  it.each([
    ['올해 끝나면 연도를 뺀다', '2026-12-31', '12월 31일까지'],
    ['내년에 끝나면 연도를 붙인다', '2027-01-31', '2027년 1월 31일까지'],
  ] as const)('%s', (_name, untilDate, expectedEnd) => {
    // When
    const label = formatRepeatSummary(
      { frequency: 'DAILY', end: { type: 'UNTIL', date: createDateKey(untilDate) } },
      createDateKey('2026-11-09'),
      { locale: 'ko-KR', timeZone: 'Asia/Seoul' },
    );

    // Then
    expect(label).toBe(`매일 · ${expectedEnd}`);
  });
});

describe('formatRepeatRuleLabel', () => {
  it('규칙을 모르는 반복 회차는 반복이라고만 한다', () => {
    // When
    const label = formatRepeatRuleLabel(null, 'ko');

    // Then
    expect(label).toBe('반복');
  });

  it('규칙을 알면 주기를 보인다', () => {
    // When
    const label = formatRepeatRuleLabel({ frequency: 'DAILY', end: NEVER }, 'ko');

    // Then
    expect(label).toBe('매일');
  });
});
