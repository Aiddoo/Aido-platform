import { NotificationBadgePolicy } from './notification-badge.model';

describe('hasUnread', () => {
  it.each([
    [0, false],
    [1, true],
    [120, true],
  ])('읽지 않은 알림이 %i개면 채운 종을 그리는지 %s다', (count, expected) => {
    // When
    const hasUnread = NotificationBadgePolicy.hasUnread(count);

    // Then
    expect(hasUnread).toBe(expected);
  });
});
