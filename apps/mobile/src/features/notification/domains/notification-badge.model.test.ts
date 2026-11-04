import { NotificationBadgePolicy } from './notification-badge.model';

describe('NotificationBadgePolicy', () => {
  it('읽지 않은 알림이 하나라도 있으면 채운 종을 그린다', () => {
    // Given
    const counts = [0, 1, 120];

    // When
    const results = counts.map(NotificationBadgePolicy.hasUnread);

    // Then
    expect(results).toEqual([false, true, true]);
  });

  it('읽지 않은 수가 늘었을 때만 새 알림으로 보고 처음 읽은 값과 줄어든 값은 흔들지 않는다', () => {
    // Given
    const transitions: [number, number | null][] = [
      [3, null],
      [3, 2],
      [3, 3],
      [1, 3],
    ];

    // When
    const results = transitions.map(([count, previous]) =>
      NotificationBadgePolicy.hasNewUnread(count, previous),
    );

    // Then
    expect(results).toEqual([false, true, false, false]);
  });
});
