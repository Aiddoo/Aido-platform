import { createNotification } from '../__tests__/notification.fixtures';
import { NotificationPolicy } from './notification.model';

describe('NotificationPolicy.isAiFeature', () => {
  it.each([
    ['WEEKLY_REPORT', true],
    ['MONTHLY_REPORT', true],
    ['AI_SUGGESTION', true],
    ['CHEER_RECEIVED', false],
    ['SYSTEM_NOTICE', false],
  ] as const)('%s 알림이 프리미엄 AI 기능인지는 %s다', (type, expected) => {
    // Given
    const notification = createNotification({ type });

    // When
    const result = NotificationPolicy.isAiFeature(notification);

    // Then
    expect(result).toBe(expected);
  });
});

describe('NotificationPolicy.isUnread', () => {
  it.each([
    [false, true],
    [true, false],
  ])('읽음이 %s면 안 읽은 알림인지는 %s다', (isRead, expected) => {
    // Given
    const notification = createNotification({ isRead });

    // When
    const result = NotificationPolicy.isUnread(notification);

    // Then
    expect(result).toBe(expected);
  });
});
