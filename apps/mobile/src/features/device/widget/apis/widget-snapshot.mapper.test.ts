import { range } from 'es-toolkit';

import {
  createWidgetSnapshotContext,
  createWidgetSummary,
} from '../__tests__/widget-snapshot.fixtures';
import {
  toLoggedOutWidgetSnapshot,
  toWidgetSnapshot,
  type WidgetSnapshotContext,
  type WidgetSummaryInput,
} from './widget-snapshot.mapper';

function toTodaySnapshot(summary: WidgetSummaryInput, context: WidgetSnapshotContext) {
  return toWidgetSnapshot({ today: summary }, context).days[0];
}

describe('toWidgetSnapshot', () => {
  it('요약을 data 상태 스냅샷으로 변환한다', () => {
    // Given
    const summary = createWidgetSummary();

    // When
    const document = toWidgetSnapshot({ today: summary }, createWidgetSnapshotContext());
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

  it('내일 요약을 받으면 오늘 다음 day로 함께 담고 각 날짜의 주간 달력을 만든다', () => {
    // Given
    // 토요일 다음 날은 새 주의 일요일이다
    const today = createWidgetSummary({ date: '2026-07-18', totalTodos: 2 });
    const tomorrow = createWidgetSummary({ date: '2026-07-19', totalTodos: 0, topTodos: [] });

    // When
    const { days } = toWidgetSnapshot({ today, tomorrow }, createWidgetSnapshotContext());

    // Then
    expect(days.map((day) => [day.date, day.state])).toEqual([
      ['2026-07-18', 'data'],
      ['2026-07-19', 'empty'],
    ]);
    expect(days[1]?.weekDays?.[0]?.date).toBe('2026-07-19');
  });

  it('표시 한도(10개) 초과분은 절단한다', () => {
    // Given
    // 총 13개 중 topTodos 10개 도착
    const topTodos = range(10).map((i) => ({
      id: i + 1,
      title: `할 일 ${i + 1}`,
      completed: false,
      categoryColor: '#FFB3B3',
    }));
    const summary = createWidgetSummary({ totalTodos: 13, topTodos });

    // When
    const snapshot = toTodaySnapshot(summary, createWidgetSnapshotContext());

    // Then
    expect(snapshot.topTodos).toHaveLength(10);
  });
});

describe('toLoggedOutWidgetSnapshot', () => {
  it('비로그인 스냅샷을 만든다 (카운트 0, loggedOut 상태)', () => {
    // When
    const [snapshot] = toLoggedOutWidgetSnapshot(
      '2026-07-12',
      createWidgetSnapshotContext({ locale: 'en' }),
    ).days;

    // Then
    expect(snapshot.state).toBe('loggedOut');
    expect(snapshot.date).toBe('2026-07-12');
    expect(snapshot.totalTodos).toBe(0);
    expect(snapshot.topTodos).toEqual([]);
    expect(snapshot.locale).toBe('en');
    expect(snapshot.strings.loggedOutTitle).toBe('widget:state.loggedOutTitle');
  });
});
