import { createLocalDateState, isSameLocalDateState } from './local-date-clock';

describe('로컬 날짜와 시간대 상태', () => {
  test('같은 시각도 명시한 시간대의 날짜로 계산한다', () => {
    // Given
    const now = new Date('2026-10-03T16:00:00.000Z');
    // When
    const seoul = createLocalDateState(now, 'Asia/Seoul', 540);
    const utc = createLocalDateState(now, 'UTC', 0);
    // Then
    expect(seoul.currentLocalDateKey).toBe('2026-10-04');
    expect(utc.currentLocalDateKey).toBe('2026-10-03');
    expect(seoul.currentLocalDate).not.toBe(now);
  });

  test('하루 안의 단순 시간 경과로 오늘 상태를 반복 갱신하지 않는다', () => {
    // Given
    const previous = createLocalDateState(new Date('2026-10-04T00:00:00.000Z'), 'Asia/Seoul', 540);
    const next = createLocalDateState(new Date('2026-10-04T01:00:00.000Z'), 'Asia/Seoul', 540);
    // When
    const isSame = isSameLocalDateState(previous, next);
    // Then
    expect(isSame).toBe(true);
  });

  test('같은 날짜와 UTC 오프셋이라도 시간대가 바뀌면 갱신한다', () => {
    // Given
    const now = new Date('2026-10-04T00:00:00.000Z');
    const previous = createLocalDateState(now, 'Asia/Seoul', 540);
    const next = createLocalDateState(now, 'Asia/Tokyo', 540);
    // When
    const isSame = isSameLocalDateState(previous, next);
    // Then
    expect(isSame).toBe(false);
  });

  test('같은 시간대에서 서머타임 UTC 오프셋이 바뀌면 갱신한다', () => {
    // Given
    const now = new Date('2026-03-08T16:00:00.000Z');
    const previous = createLocalDateState(now, 'America/New_York', -300);
    const next = createLocalDateState(now, 'America/New_York', -240);
    // When
    const isSame = isSameLocalDateState(previous, next);
    // Then
    expect(isSame).toBe(false);
  });
});
