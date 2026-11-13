import { toInstant } from '@src/shared/date/instant';

import { createWidgetSnapshot } from '../__tests__/widget-snapshot.fixtures';
import { toWidgetTimelineEntries } from './widget-timeline.mapper';

function summarize(entries: ReturnType<typeof toWidgetTimelineEntries>) {
  return entries.map(({ date, props }) => [date.toISOString(), props.state, props.totalTodos]);
}

describe('toWidgetTimelineEntries', () => {
  it('자정 1초 전에 쓰면 지금 오늘, 다음 자정 내일, 그다음 자정 stale 순서로 예약한다', () => {
    // Given
    // 서울 2026-07-12 23:59:59
    const snapshot = createWidgetSnapshot({}, { state: 'empty', totalTodos: 0 });
    const now = toInstant('2026-07-12T14:59:59.000Z');

    // When
    const entries = toWidgetTimelineEntries(snapshot, {
      now,
      timeZone: 'Asia/Seoul',
      appScheme: 'aido',
    });

    // Then
    expect(summarize(entries)).toEqual([
      ['2026-07-12T14:59:59.000Z', 'data', 5],
      ['2026-07-12T15:00:00.000Z', 'empty', 0],
      ['2026-07-13T15:00:00.000Z', 'stale', 0],
    ]);
  });

  it('자정 정각에 쓰면 저장한 내일 day를 지금 entry로 사용한다', () => {
    // Given
    // 서울 2026-07-13 00:00:00
    const snapshot = createWidgetSnapshot({}, { state: 'empty', totalTodos: 0 });
    const now = toInstant('2026-07-12T15:00:00.000Z');

    // When
    const entries = toWidgetTimelineEntries(snapshot, {
      now,
      timeZone: 'Asia/Seoul',
      appScheme: 'aido',
    });

    // Then
    expect(summarize(entries)).toEqual([
      ['2026-07-12T15:00:00.000Z', 'empty', 0],
      ['2026-07-13T15:00:00.000Z', 'stale', 0],
    ]);
  });

  it('내일 요약을 받지 못했으면 다음 자정부터 stale을 표시한다', () => {
    // Given
    const snapshot = createWidgetSnapshot();
    const now = toInstant('2026-07-12T09:00:00.000Z');

    // When
    const entries = toWidgetTimelineEntries(snapshot, {
      now,
      timeZone: 'Asia/Seoul',
      appScheme: 'aido',
    });

    // Then
    expect(summarize(entries)).toEqual([
      ['2026-07-12T09:00:00.000Z', 'data', 5],
      ['2026-07-12T15:00:00.000Z', 'stale', 5],
    ]);
  });

  it('비로그인 snapshot은 날짜와 무관한 entry 하나만 쓴다', () => {
    // Given
    const snapshot = createWidgetSnapshot({ state: 'loggedOut' });
    const now = toInstant('2026-07-12T09:00:00.000Z');

    // When
    const entries = toWidgetTimelineEntries(snapshot, {
      now,
      timeZone: 'Asia/Seoul',
      appScheme: 'aido',
    });

    // Then
    expect(summarize(entries)).toEqual([['2026-07-12T09:00:00.000Z', 'loggedOut', 5]]);
  });
});
