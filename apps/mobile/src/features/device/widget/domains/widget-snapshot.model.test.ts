import { toDateKey } from '@src/shared/date/zoned';
import { createDateKey } from '@src/testing/date-key';

import { createWidgetSnapshot } from '../__tests__/widget-snapshot.fixtures';
import { WidgetSnapshotPolicy } from './widget-snapshot.model';

describe('isLoggedOut', () => {
  it('첫 day가 loggedOut이면 로그아웃 스냅샷이다', () => {
    // Given
    const snapshot = createWidgetSnapshot({ state: 'loggedOut' });

    // When
    const result = WidgetSnapshotPolicy.isLoggedOut(snapshot);

    // Then
    expect(result).toBe(true);
  });

  it.each(['data', 'empty'] as const)('첫 day가 %s면 로그인한 스냅샷이다', (state) => {
    // Given
    const snapshot = createWidgetSnapshot({ state });

    // When
    const result = WidgetSnapshotPolicy.isLoggedOut(snapshot);

    // Then
    expect(result).toBe(false);
  });

  it('로그아웃은 첫 day로만 판단한다', () => {
    // Given
    const snapshot = createWidgetSnapshot({ state: 'data' }, { state: 'loggedOut' });

    // When
    const result = WidgetSnapshotPolicy.isLoggedOut(snapshot);

    // Then
    expect(result).toBe(false);
  });
});

describe('getDay', () => {
  it('오늘 key와 같은 day의 상태를 그대로 표시한다', () => {
    // Given
    const snapshot = createWidgetSnapshot({}, { state: 'empty', totalTodos: 0 });

    // When
    const { day, renderState } = WidgetSnapshotPolicy.getDay(snapshot, createDateKey('2026-07-12'));

    // Then
    expect(day.date).toBe('2026-07-12');
    expect(renderState).toBe('data');
  });

  it('서울 23:59:59에는 오늘, 00:00:00에는 저장해 둔 내일 day를 고른다', () => {
    // Given
    const snapshot = createWidgetSnapshot({}, { state: 'empty', totalTodos: 0 });
    const beforeMidnight = toDateKey(new Date('2026-07-12T14:59:59.000Z'), 'Asia/Seoul');
    const atMidnight = toDateKey(new Date('2026-07-12T15:00:00.000Z'), 'Asia/Seoul');

    // When
    const before = WidgetSnapshotPolicy.getDay(snapshot, beforeMidnight);
    const after = WidgetSnapshotPolicy.getDay(snapshot, atMidnight);

    // Then
    expect([before.day.date, before.renderState]).toEqual(['2026-07-12', 'data']);
    expect([after.day.date, after.renderState]).toEqual(['2026-07-13', 'empty']);
  });

  it('저장한 어느 day와도 날짜가 맞지 않으면 stale을 표시한다', () => {
    // Given
    const snapshot = createWidgetSnapshot({}, {});

    // When
    const { renderState } = WidgetSnapshotPolicy.getDay(snapshot, createDateKey('2026-07-14'));

    // Then
    expect(renderState).toBe('stale');
  });

  it('loggedOut 스냅샷은 날짜가 지나도 loggedOut을 유지한다', () => {
    // Given
    const snapshot = createWidgetSnapshot({
      state: 'loggedOut',
      date: createDateKey('2026-07-01'),
    });

    // When
    const { renderState } = WidgetSnapshotPolicy.getDay(snapshot, createDateKey('2026-07-12'));

    // Then
    expect(renderState).toBe('loggedOut');
  });
});

describe('getDayForOwner', () => {
  it('소유자를 모르는 개인 목록은 오늘 day가 있어도 stale을 표시한다', () => {
    // Given
    const snapshot = createWidgetSnapshot({});

    // When
    const { renderState } = WidgetSnapshotPolicy.getDayForOwner(
      snapshot,
      createDateKey('2026-07-12'),
      null,
    );

    // Then
    expect(renderState).toBe('stale');
  });

  it('소유자를 모르는 loggedOut 스냅샷은 loggedOut을 유지한다', () => {
    // Given
    const snapshot = createWidgetSnapshot({ state: 'loggedOut' });

    // When
    const { renderState } = WidgetSnapshotPolicy.getDayForOwner(
      snapshot,
      createDateKey('2026-07-12'),
      null,
    );

    // Then
    expect(renderState).toBe('loggedOut');
  });

  it('소유자가 있으면 오늘 key와 같은 day를 고른다', () => {
    // Given
    const snapshot = createWidgetSnapshot({});

    // When
    const { day, renderState } = WidgetSnapshotPolicy.getDayForOwner(
      snapshot,
      createDateKey('2026-07-12'),
      'user-1',
    );

    // Then
    expect([day.date, renderState]).toEqual(['2026-07-12', 'data']);
  });
});
