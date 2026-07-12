import type { WidgetSnapshot } from './widget-snapshot.model';
import { WidgetSnapshotPolicy } from './widget-snapshot.model';

function buildSnapshot(overrides: Partial<WidgetSnapshot> = {}): WidgetSnapshot {
  return {
    version: 1,
    state: 'data',
    date: '2026-07-12',
    updatedAtIso: '2026-07-12T09:00:00.000Z',
    totalTodos: 5,
    completedTodos: 3,
    completionRate: 60,
    isComplete: false,
    currentStreak: 12,
    topTodos: [],
    locale: 'ko',
    strings: {
      progressTitle: '오늘의 할 일',
      progressLabel: '3/5 완료',
      percentLabel: '60%',
      streakLabel: '12일 연속',
      allDoneLabel: '모두 완료!',
      moreLabel: '',
      emptyTitle: '오늘 할 일이 없어요',
      emptyCta: '탭해서 추가하기',
      loggedOutTitle: '로그인이 필요해요',
      loggedOutCta: '탭해서 시작하기',
      staleTitle: '새로운 하루가 시작됐어요',
      staleCta: '앱을 열어 확인하기',
    },
    ...overrides,
  };
}

describe('WidgetSnapshotPolicy.renderState', () => {
  it('오늘 날짜의 data 스냅샷은 data를 반환한다', () => {
    // Given
    const snapshot = buildSnapshot();

    // When
    const result = WidgetSnapshotPolicy.renderState(snapshot, '2026-07-12');

    // Then
    expect(result).toBe('data');
  });

  it('날짜가 지난 스냅샷은 stale을 반환한다 (자정 롤오버)', () => {
    // Given
    const snapshot = buildSnapshot({ date: '2026-07-11' });

    // When
    const result = WidgetSnapshotPolicy.renderState(snapshot, '2026-07-12');

    // Then
    expect(result).toBe('stale');
  });

  it('loggedOut 스냅샷은 날짜가 지나도 loggedOut을 유지한다', () => {
    // Given
    const snapshot = buildSnapshot({ state: 'loggedOut', date: '2026-07-01' });

    // When
    const result = WidgetSnapshotPolicy.renderState(snapshot, '2026-07-12');

    // Then
    expect(result).toBe('loggedOut');
  });

  it('오늘 날짜의 empty 스냅샷은 empty를 반환한다', () => {
    // Given
    const snapshot = buildSnapshot({ state: 'empty', totalTodos: 0, completedTodos: 0 });

    // When
    const result = WidgetSnapshotPolicy.renderState(snapshot, '2026-07-12');

    // Then
    expect(result).toBe('empty');
  });
});
