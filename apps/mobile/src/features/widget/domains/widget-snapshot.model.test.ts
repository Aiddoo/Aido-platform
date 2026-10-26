import { formatDateKey } from '@src/shared/utils/date-format';

import { buildWidgetSnapshot } from '../__tests__/widget-snapshot.factory';
import { storedWidgetSnapshotSchema, WidgetSnapshotPolicy } from './widget-snapshot.model';

describe('WidgetSnapshotPolicy.selectDay', () => {
  it('오늘 key와 같은 day의 상태를 그대로 표시한다', () => {
    // Given
    const snapshot = buildWidgetSnapshot({}, { state: 'empty', totalTodos: 0 });

    // When
    const { day, renderState } = WidgetSnapshotPolicy.selectDay(snapshot, '2026-07-12');

    // Then
    expect(day.date).toBe('2026-07-12');
    expect(renderState).toBe('data');
  });

  it('서울 23:59:59에는 오늘, 00:00:00에는 저장해 둔 내일 day를 고른다', () => {
    // Given
    const snapshot = buildWidgetSnapshot({}, { state: 'empty', totalTodos: 0 });
    const beforeMidnight = formatDateKey(new Date('2026-07-12T14:59:59.000Z'), 'Asia/Seoul');
    const atMidnight = formatDateKey(new Date('2026-07-12T15:00:00.000Z'), 'Asia/Seoul');

    // When
    const before = WidgetSnapshotPolicy.selectDay(snapshot, beforeMidnight);
    const after = WidgetSnapshotPolicy.selectDay(snapshot, atMidnight);

    // Then
    expect([before.day.date, before.renderState]).toEqual(['2026-07-12', 'data']);
    expect([after.day.date, after.renderState]).toEqual(['2026-07-13', 'empty']);
  });

  it('저장한 어느 day와도 날짜가 맞지 않으면 stale을 표시한다', () => {
    // Given
    const snapshot = buildWidgetSnapshot({}, {});

    // When
    const { renderState } = WidgetSnapshotPolicy.selectDay(snapshot, '2026-07-14');

    // Then
    expect(renderState).toBe('stale');
  });

  it('loggedOut 스냅샷은 날짜가 지나도 loggedOut을 유지한다', () => {
    // Given
    const snapshot = buildWidgetSnapshot({ state: 'loggedOut', date: '2026-07-01' });

    // When
    const { renderState } = WidgetSnapshotPolicy.selectDay(snapshot, '2026-07-12');

    // Then
    expect(renderState).toBe('loggedOut');
  });
});

describe('WidgetSnapshotPolicy.selectDayForOwner', () => {
  it('소유자를 모르는 개인 목록은 오늘 day가 있어도 stale을 표시한다', () => {
    // Given
    const snapshot = buildWidgetSnapshot({});

    // When
    const { renderState } = WidgetSnapshotPolicy.selectDayForOwner(snapshot, '2026-07-12', null);

    // Then
    expect(renderState).toBe('stale');
  });

  it('소유자를 모르는 loggedOut 스냅샷은 loggedOut을 유지한다', () => {
    // Given
    const snapshot = buildWidgetSnapshot({ state: 'loggedOut' });

    // When
    const { renderState } = WidgetSnapshotPolicy.selectDayForOwner(snapshot, '2026-07-12', null);

    // Then
    expect(renderState).toBe('loggedOut');
  });

  it('소유자가 있으면 오늘 key와 같은 day를 고른다', () => {
    // Given
    const snapshot = buildWidgetSnapshot({});

    // When
    const { day, renderState } = WidgetSnapshotPolicy.selectDayForOwner(
      snapshot,
      '2026-07-12',
      'user-1',
    );

    // Then
    expect([day.date, renderState]).toEqual(['2026-07-12', 'data']);
  });
});

describe('storedWidgetSnapshotSchema 하위 호환', () => {
  it('이미 저장된 v1 snapshot을 같은 내용의 하루짜리 v2로 읽는다', () => {
    // Given
    const { days, updatedAtIso } = buildWidgetSnapshot();
    const legacySnapshot = { version: 1, updatedAtIso, ...days[0] };

    // When
    const result = storedWidgetSnapshotSchema.safeParse(legacySnapshot);

    // Then
    expect(result.success && result.data).toEqual({ version: 2, updatedAtIso, days });
  });

  it('compact streak가 없는 v1.5.1 스냅샷도 계속 읽는다', () => {
    // Given
    const { days, updatedAtIso } = buildWidgetSnapshot();
    const legacySnapshot = { version: 1, updatedAtIso, ...days[0] };
    delete legacySnapshot.strings.compactStreakLabel;

    // When
    const result = storedWidgetSnapshotSchema.safeParse(legacySnapshot);

    // Then
    expect(result.success).toBe(true);
  });
});
