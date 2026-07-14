import { buildWidgetSnapshot } from '../__tests__/widget-snapshot.factory';
import { WidgetSnapshotPolicy, widgetSnapshotSchema } from './widget-snapshot.model';

describe('WidgetSnapshotPolicy.renderState', () => {
  it('오늘 날짜의 data 스냅샷은 data를 반환한다', () => {
    // Given
    const snapshot = buildWidgetSnapshot();

    // When
    const result = WidgetSnapshotPolicy.renderState(snapshot, '2026-07-12');

    // Then
    expect(result).toBe('data');
  });

  it('날짜가 지난 스냅샷은 stale을 반환한다 (자정 롤오버)', () => {
    // Given
    const snapshot = buildWidgetSnapshot({ date: '2026-07-11' });

    // When
    const result = WidgetSnapshotPolicy.renderState(snapshot, '2026-07-12');

    // Then
    expect(result).toBe('stale');
  });

  it('loggedOut 스냅샷은 날짜가 지나도 loggedOut을 유지한다', () => {
    // Given
    const snapshot = buildWidgetSnapshot({ state: 'loggedOut', date: '2026-07-01' });

    // When
    const result = WidgetSnapshotPolicy.renderState(snapshot, '2026-07-12');

    // Then
    expect(result).toBe('loggedOut');
  });

  it('오늘 날짜의 empty 스냅샷은 empty를 반환한다', () => {
    // Given
    const snapshot = buildWidgetSnapshot({ state: 'empty', totalTodos: 0, completedTodos: 0 });

    // When
    const result = WidgetSnapshotPolicy.renderState(snapshot, '2026-07-12');

    // Then
    expect(result).toBe('empty');
  });
});

describe('widgetSnapshotSchema compatibility', () => {
  it('compact streak가 없는 v1.5.1 스냅샷도 계속 읽는다', () => {
    const legacySnapshot = buildWidgetSnapshot();
    delete legacySnapshot.strings.compactStreakLabel;

    expect(widgetSnapshotSchema.safeParse(legacySnapshot).success).toBe(true);
  });
});
