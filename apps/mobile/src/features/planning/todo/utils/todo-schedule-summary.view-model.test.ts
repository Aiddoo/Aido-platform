import '@src/shared/i18n/init';
import { createDateKey } from '@src/testing/date-key';

import type { TodoRepeat } from '../domains/todo-repeat.model';
import { findTodoScheduleSummary } from './todo-schedule-summary.view-model';

const CONTEXT = {
  todayKey: createDateKey('2026-11-07'),
  timeFormat: 'TWENTY_FOUR_HOUR',
  dateFormatContext: { locale: 'ko-KR', timezone: 'Asia/Seoul' },
} as const;

const TODO = {
  startDate: createDateKey('2026-11-07'),
  endDate: null,
  scheduledTime: null,
  repeat: null,
};

describe('findTodoScheduleSummary', () => {
  it('오늘·내일 할 일은 할 일 칩과 같은 말로 보인다', () => {
    // When
    const today = findTodoScheduleSummary(TODO, CONTEXT);
    const tomorrow = findTodoScheduleSummary(
      { ...TODO, startDate: createDateKey('2026-11-08') },
      CONTEXT,
    );

    // Then
    expect([today, tomorrow]).toEqual(['오늘', '내일']);
  });

  it('다른 날의 할 일은 날짜를 보인다', () => {
    // When
    const summary = findTodoScheduleSummary(
      { ...TODO, startDate: createDateKey('2026-11-10') },
      CONTEXT,
    );

    // Then
    expect(summary).toContain('10');
  });

  it('날짜와 시간을 가운뎃점으로 잇는다', () => {
    // When
    const summary = findTodoScheduleSummary(
      { ...TODO, startDate: createDateKey('2026-11-10'), scheduledTime: '09:30:00' },
      CONTEXT,
    );

    // Then
    expect(summary).toMatch(/10.* · .*09:30/);
  });

  it('반복 할 일은 시작일을 숨기고 반복 규칙을 보인다', () => {
    // Given
    const repeat: TodoRepeat = {
      frequency: 'WEEKLY',
      interval: 1,
      weekdays: ['MON'],
      end: { type: 'NEVER' },
    };

    // When
    const summary = findTodoScheduleSummary(
      { ...TODO, startDate: createDateKey('2026-11-10'), repeat },
      CONTEXT,
    );

    // Then
    expect(summary).not.toBeNull();
    expect(summary).not.toContain('10');
  });

  it('기간 할 일은 시작과 끝을 보인다', () => {
    // When
    const summary = findTodoScheduleSummary(
      { ...TODO, startDate: createDateKey('2026-11-10'), endDate: createDateKey('2026-11-12') },
      CONTEXT,
    );

    // Then
    expect(summary).toMatch(/10.*12/);
  });
});
