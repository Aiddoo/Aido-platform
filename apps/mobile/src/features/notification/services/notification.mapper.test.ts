import { createNotificationListResponseDto } from '../__tests__/notification.factories';
import { toNotification, toNotificationListResult } from './notification.mapper';

jest.useFakeTimers({ now: new Date('2026-03-08T00:00:00.000Z') });

describe('toNotification', () => {
  test('createdAt ISO -> Date 변환', () => {
    // Given
    const server = createNotificationListResponseDto().notifications[0];
    if (!server) {
      throw new Error('Expected notification DTO');
    }

    // When
    const result = toNotification(server);

    // Then
    expect(result.createdAt).toBeInstanceOf(Date);
    expect(result.createdAt.toISOString()).toBe('2026-03-08T10:00:00.000Z');
    expect(result.id).toBe(1);
    expect(result.type).toBe('FOLLOW_NEW');
  });

  test('readAt ISO -> Date 변환', () => {
    // Given
    const server = createNotificationListResponseDto().notifications[1];
    if (!server) {
      throw new Error('Expected notification DTO');
    }

    // When
    const result = toNotification(server);

    // Then
    expect(result.readAt).toBeInstanceOf(Date);
    expect(result.readAt?.toISOString()).toBe('2026-03-07T10:00:00.000Z');
  });

  test('readAt null -> null', () => {
    // Given
    const server = createNotificationListResponseDto().notifications[0];
    if (!server) {
      throw new Error('Expected notification DTO');
    }

    // When
    const result = toNotification(server);

    // Then
    expect(result.readAt).toBeNull();
  });
});

describe('toNotificationListResult', () => {
  test('배열 변환 + unreadCount/hasMore/nextCursor', () => {
    // Given
    const dto = createNotificationListResponseDto();

    // When
    const result = toNotificationListResult(dto);

    // Then
    expect(result.notifications).toHaveLength(2);
    expect(result.notifications[0]?.createdAt).toBeInstanceOf(Date);
    expect(result.unreadCount).toBe(1);
    expect(result.hasMore).toBe(false);
    expect(result.nextCursor).toBeNull();
  });

  test('빈 배열', () => {
    // Given
    const dto = createNotificationListResponseDto({
      notifications: [],
      unreadCount: 0,
    });

    // When
    const result = toNotificationListResult(dto);

    // Then
    expect(result.notifications).toEqual([]);
    expect(result.unreadCount).toBe(0);
  });
});
