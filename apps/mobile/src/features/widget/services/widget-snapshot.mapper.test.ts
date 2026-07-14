import {
  buildWidgetSnapshotContext,
  buildWidgetSummary,
} from '../__tests__/widget-snapshot.factory';
import { toLoggedOutWidgetSnapshot, toWidgetSnapshot } from './widget-snapshot.mapper';

describe('toWidgetSnapshot', () => {
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
