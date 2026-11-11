import type { TodoRepeat } from '@src/features/planning/todo/domains/todo-repeat.model';
import '@src/shared/i18n/init';
import { createDateKey } from '@src/testing/date-key';

import { getPlanTodoSubtitle } from './plan-todo-subtitle.view-model';

const CONTEXT = {
  todayKey: createDateKey('2026-11-07'),
  timeFormat: 'TWENTY_FOUR_HOUR',
  dateFormatContext: { locale: 'ko-KR', timeZone: 'Asia/Seoul' },
} as const;

const TODO = {
  startDate: createDateKey('2026-11-07'),
  endDate: null,
  scheduledTime: null,
  repeat: null,
};

describe('getPlanTodoSubtitle', () => {
  it('오늘의 종일 할 일은 보일 것이 없다', () => {
    // When
    const subtitle = getPlanTodoSubtitle(TODO, CONTEXT);

    // Then
    expect(subtitle).toBeNull();
  });

  it('다른 날의 할 일은 날짜를 보인다', () => {
    // When
    const subtitle = getPlanTodoSubtitle(
      { ...TODO, startDate: createDateKey('2026-11-10') },
      CONTEXT,
    );

    // Then
    expect(subtitle).toContain('10');
  });

  it('날짜와 시간을 가운뎃점으로 잇는다', () => {
    // When
    const subtitle = getPlanTodoSubtitle(
      { ...TODO, startDate: createDateKey('2026-11-10'), scheduledTime: '09:30:00' },
      CONTEXT,
    );

    // Then
    expect(subtitle).toMatch(/10.* · .*09:30/);
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
    const subtitle = getPlanTodoSubtitle(
      { ...TODO, startDate: createDateKey('2026-11-10'), repeat },
      CONTEXT,
    );

    // Then
    expect(subtitle).not.toBeNull();
    expect(subtitle).not.toContain('10');
  });

  it('기간 할 일은 시작과 끝을 보인다', () => {
    // When
    const subtitle = getPlanTodoSubtitle(
      { ...TODO, startDate: createDateKey('2026-11-10'), endDate: createDateKey('2026-11-12') },
      CONTEXT,
    );

    // Then
    expect(subtitle).toMatch(/10.*12/);
  });
});
