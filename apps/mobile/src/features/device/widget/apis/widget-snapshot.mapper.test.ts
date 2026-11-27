import { toInstant } from '@src/shared/date/instant';
import { createDateKey } from '@src/testing/date-key';

import {
  createWidgetDaySnapshot,
  createWidgetSummary,
} from '../__tests__/widget-snapshot.fixtures';
import {
  toLoggedOutWidgetDaySnapshot,
  toWidgetDaySnapshot,
  toWidgetSnapshot,
  type WidgetDayCopy,
} from './widget-snapshot.mapper';

const { strings: STRINGS, weekDays: WEEK_DAYS = [] } = createWidgetDaySnapshot({
  weekDays: [
    createDateKey('2026-07-12'),
    createDateKey('2026-07-13'),
    createDateKey('2026-07-14'),
    createDateKey('2026-07-15'),
    createDateKey('2026-07-16'),
    createDateKey('2026-07-17'),
    createDateKey('2026-07-18'),
  ].map((date) => ({
    date,
    weekdayLabel: '일',
    dayLabel: '12',
    isComplete: false,
    hasTodos: false,
  })),
});
const COPY: WidgetDayCopy = {
  strings: STRINGS,
  week: { days: WEEK_DAYS, title: '7월 3주차', rangeLabel: '07.12 ~ 07.18' },
};

describe('toWidgetSnapshot', () => {
  it('요약을 data 상태 스냅샷으로 변환한다', () => {
    // Given
    const summary = createWidgetSummary();

    // When
    const document = toWidgetSnapshot(
      [toWidgetDaySnapshot(summary, COPY, 'ko')],
      toInstant('2026-07-12T09:00:00.000Z'),
    );
    const [snapshot] = document.days;

    // Then
    expect(document.version).toBe(2);
    expect(document.days).toHaveLength(1);
    expect(document.updatedAtIso).toBe('2026-07-12T09:00:00.000Z');
    expect(snapshot.state).toBe('data');
    expect(snapshot.date).toBe('2026-07-12');
    expect(snapshot.totalTodos).toBe(5);
    expect(snapshot.completedTodos).toBe(3);
    expect(snapshot.currentStreak).toBe(12);
    expect(snapshot.topTodos).toHaveLength(2);
    expect(snapshot.locale).toBe('ko');
  });
});

describe('toWidgetDaySnapshot', () => {
  it.each([
    [0, 'empty'],
    [1, 'data'],
  ] as const)('할 일 %i개면 %s 상태다', (totalTodos, expected) => {
    // When
    const { state } = toWidgetDaySnapshot(createWidgetSummary({ totalTodos }), COPY, 'ko');

    // Then
    expect(state).toBe(expected);
  });

  it('구운 문구 뒤에 주간 제목·범위를 붙이고 주간 달력을 담는다', () => {
    // When
    const day = toWidgetDaySnapshot(createWidgetSummary(), COPY, 'ko');

    // Then
    expect(day.weekDays).toBe(WEEK_DAYS);
    expect(day.strings).toEqual({
      ...STRINGS,
      weekTitle: '7월 3주차',
      weekRangeLabel: '07.12 ~ 07.18',
    });
  });
});

describe('toLoggedOutWidgetDaySnapshot', () => {
  it('비로그인 스냅샷을 만든다 (카운트 0, loggedOut 상태)', () => {
    // When
    const snapshot = toLoggedOutWidgetDaySnapshot(createDateKey('2026-07-12'), STRINGS, 'en');

    // Then
    expect(snapshot.state).toBe('loggedOut');
    expect(snapshot.date).toBe('2026-07-12');
    expect(snapshot.totalTodos).toBe(0);
    expect(snapshot.topTodos).toEqual([]);
    expect(snapshot.locale).toBe('en');
    expect(snapshot.strings.loggedOutTitle).toBe(STRINGS.loggedOutTitle);
    expect(snapshot.weekDays).toBeUndefined();
  });
});
