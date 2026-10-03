import {
  buildWidgetSnapshotContext,
  buildWidgetSummary,
} from '../__tests__/widget-snapshot.factory';
import { toLoggedOutWidgetSnapshot, toWidgetSnapshot } from './widget-snapshot.mapper';

describe('toWidgetSnapshot', () => {
  it('주간 발자국은 할 일이 있고 모두 완료한 날에만 표시한다', () => {
    // Given
    const summary = buildWidgetSummary({ date: '2026-07-15', isComplete: false });
    const context = buildWidgetSnapshotContext({
      weekCompletions: [
        { date: '2026-07-12', totalTodos: 0, isComplete: true },
        { date: '2026-07-13', totalTodos: 2, isComplete: true },
        { date: '2026-07-14', totalTodos: 3, isComplete: false },
        { date: '2026-07-15', totalTodos: 2, isComplete: true },
      ],
    });
    // When
    const snapshot = toWidgetSnapshot(summary, context);
    // Then
    expect(snapshot.weekDays?.map((day) => day.date)).toEqual([
      '2026-07-12',
      '2026-07-13',
      '2026-07-14',
      '2026-07-15',
      '2026-07-16',
      '2026-07-17',
      '2026-07-18',
    ]);
    expect(snapshot.weekDays?.filter((day) => day.isComplete).map((day) => day.date)).toEqual([
      '2026-07-13',
    ]);
    expect(snapshot.weekDays?.[0]?.weekdayLabel).toBe('일');
    expect(snapshot.weekDays?.[3]?.hasTodos).toBe(true);
  });

  it('주간 조회가 실패해도 오늘 요약과 달력 날짜를 표시한다', () => {
    // Given
    const summary = buildWidgetSummary({ date: '2026-12-31', totalTodos: 2, isComplete: true });
    // When
    const snapshot = toWidgetSnapshot(summary, buildWidgetSnapshotContext({ locale: 'en' }));
    // Then
    expect(snapshot.weekDays?.[0]?.date).toBe('2026-12-27');
    expect(snapshot.weekDays?.[6]?.date).toBe('2027-01-02');
    expect(snapshot.weekDays?.[0]?.weekdayLabel).toBe('Sun');
    expect(snapshot.weekDays?.filter((day) => day.isComplete).map((day) => day.date)).toEqual([
      '2026-12-31',
    ]);
    expect(snapshot.strings.weekRangeLabel).toBe('12.27 – 01.02');
  });
  it('요약을 data 상태 스냅샷으로 변환한다', () => {
    // Given
    const summary = buildWidgetSummary();

    // When
    const snapshot = toWidgetSnapshot(summary, buildWidgetSnapshotContext());

    // Then
    expect(snapshot.version).toBe(1);
    expect(snapshot.state).toBe('data');
    expect(snapshot.date).toBe('2026-07-12');
    expect(snapshot.updatedAtIso).toBe('2026-07-12T09:00:00.000Z');
    expect(snapshot.totalTodos).toBe(5);
    expect(snapshot.completedTodos).toBe(3);
    expect(snapshot.currentStreak).toBe(12);
    expect(snapshot.topTodos).toHaveLength(2);
    expect(snapshot.locale).toBe('ko');
  });

  it('할 일이 없으면 empty 상태다', () => {
    // Given
    const summary = buildWidgetSummary({ totalTodos: 0, completedTodos: 0, topTodos: [] });

    // When
    const snapshot = toWidgetSnapshot(summary, buildWidgetSnapshotContext());

    // Then
    expect(snapshot.state).toBe('empty');
  });

  it('문자열을 t로 구워 담는다 (카운트·퍼센트·스트릭 보간)', () => {
    // Given
    const summary = buildWidgetSummary();

    // When
    const snapshot = toWidgetSnapshot(summary, buildWidgetSnapshotContext());

    // Then
    expect(snapshot.strings.progressTitle).toBe('widget:progress.title');
    expect(snapshot.strings.percentLabel).toBe('widget:progress.percent({"rate":60})');
    expect(snapshot.strings.streakLabel).toBe('widget:progress.streak({"count":12})');
    expect(snapshot.strings.compactStreakLabel).toBe('widget:progress.compactStreak({"count":12})');
  });

  it('완료율은 반올림해 보간한다', () => {
    // Given
    const summary = buildWidgetSummary({ completionRate: 33.333 });

    // When
    const snapshot = toWidgetSnapshot(summary, buildWidgetSnapshotContext());

    // Then
    expect(snapshot.strings.percentLabel).toBe('widget:progress.percent({"rate":33})');
  });

  it('표시 한도(10개) 초과분은 절단한다', () => {
    // Given - 총 13개 중 topTodos 10개 도착
    const topTodos = Array.from({ length: 10 }, (_, i) => ({
      id: i + 1,
      title: `할 일 ${i + 1}`,
      completed: false,
      categoryColor: '#FFB3B3',
    }));
    const summary = buildWidgetSummary({ totalTodos: 13, topTodos });

    // When
    const snapshot = toWidgetSnapshot(summary, buildWidgetSnapshotContext());

    // Then
    expect(snapshot.topTodos).toHaveLength(10);
  });

  it('moreLabelTemplate은 {count} 플레이스홀더를 남긴 채 굽는다 (표시 행 수는 위젯만 안다)', () => {
    // Given
    const summary = buildWidgetSummary();

    // When
    const snapshot = toWidgetSnapshot(summary, buildWidgetSnapshotContext());

    // Then - 렌더 시점에 위젯이 {count}를 실제 초과분으로 치환한다
    expect(snapshot.strings.moreLabelTemplate).toBe('widget:list.more({"overflow":"{count}"})');
  });
});

describe('toLoggedOutWidgetSnapshot', () => {
  it('비로그인 스냅샷을 만든다 (카운트 0, loggedOut 상태)', () => {
    // When
    const snapshot = toLoggedOutWidgetSnapshot(
      '2026-07-12',
      buildWidgetSnapshotContext({ locale: 'en' }),
    );

    // Then
    expect(snapshot.state).toBe('loggedOut');
    expect(snapshot.date).toBe('2026-07-12');
    expect(snapshot.totalTodos).toBe(0);
    expect(snapshot.topTodos).toEqual([]);
    expect(snapshot.locale).toBe('en');
    expect(snapshot.strings.loggedOutTitle).toBe('widget:state.loggedOutTitle');
  });
});
