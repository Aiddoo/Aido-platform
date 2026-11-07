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

describe('hasNewUnread', () => {
  it.each([
    ['처음 읽은 값은 흔들지 않는다', 3, null, false],
    ['읽지 않은 수가 늘면 새 알림이다', 3, 2, true],
    ['읽지 않은 수가 그대로면 새 알림이 아니다', 3, 3, false],
    ['읽지 않은 수가 줄면 새 알림이 아니다', 1, 3, false],
  ])('%s', (_label, count, previous, expected) => {
    // When
    const hasNewUnread = NotificationBadgePolicy.hasNewUnread(count, previous);

    // Then
    expect(hasNewUnread).toBe(expected);
  });
});
