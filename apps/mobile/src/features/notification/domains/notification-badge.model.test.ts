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

describe('getBadgeCount', () => {
  it.each([
    ['loading', 3, null],
    ['locked', 3, null],
    ['unauthenticated', 3, 0],
    ['authenticated', 3, 3],
    ['authenticated', 0, 0],
    ['authenticated', undefined, null],
  ] as const)(
    '인증 상태가 %s이고 서버의 안 읽은 수가 %s면 배지를 %s로 맞춘다(null은 그대로 둔다)',
    (authStatus, unreadCount, expected) => {
      // When
      const count = NotificationBadgePolicy.getBadgeCount(unreadCount, { authStatus });

      // Then
      expect(count).toBe(expected);
    },
  );
});
