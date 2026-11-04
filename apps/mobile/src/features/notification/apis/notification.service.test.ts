import { createMockHttpClient } from '@src/shared/__tests__';

import {
  createMarkReadResponseDto,
  createNotificationApiError,
  createNotificationListResponseDto,
  createPushNotificationGatewayStub,
  createUnreadCountResponseDto,
  INVALID_DTO,
} from '../__tests__/notification.factories';
import { NotificationService } from './notification.service';

describe('NotificationService', () => {
  let httpClient: ReturnType<typeof createMockHttpClient>;
  let service: NotificationService;

  beforeEach(() => {
    httpClient = createMockHttpClient();
    service = new NotificationService(httpClient, createPushNotificationGatewayStub());
  });

  // ── getNotifications ─────────────────────────

  describe('getNotifications', () => {
    test('정상 응답 -> NotificationListResult 반환', async () => {
      // Given
      const dto = createNotificationListResponseDto();
      httpClient.get.mockResolvedValue({ ok: true, value: dto });

      // When
      const result = await service.getNotifications({ limit: 20 });

      // Then
      expect(httpClient.get).toHaveBeenCalledWith('v1/notifications/inbox', {
        params: expect.objectContaining({ limit: 20 }),
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.notifications).toHaveLength(2);
        expect(result.value.notifications[0]?.createdAt).toBeInstanceOf(Date);
      }
    });

    test('Zod 검증 실패 -> ParseError throw', async () => {
      // Given
      httpClient.get.mockResolvedValue({ ok: true, value: INVALID_DTO });

      // When & Then
      await expect(service.getNotifications()).rejects.toThrow('Invalid getNotifications response');
    });
  });

  // ── getUnreadCount ───────────────────────────

  describe('getUnreadCount', () => {
    test('정상 응답 -> unreadCount 숫자 반환', async () => {
      // Given
      const dto = createUnreadCountResponseDto({ unreadCount: 5 });
      httpClient.get.mockResolvedValue({ ok: true, value: dto });

      // When
      const result = await service.getUnreadCount();

      // Then
      expect(httpClient.get).toHaveBeenCalledWith('v1/notifications/inbox/unread-count', {
        signal: undefined,
      });
      expect(result).toEqual({ ok: true, value: 5 });
    });

    test('HTTP 에러 -> Result.err 반환', async () => {
      // Given
      const apiError = createNotificationApiError();
      httpClient.get.mockResolvedValue({ ok: false, error: apiError });

      // When
      const result = await service.getUnreadCount();

      // Then
      expect(result).toEqual({ ok: false, error: apiError });
    });
  });

  // ── markAsRead ───────────────────────────────

  describe('markAsRead', () => {
    test('정상 응답 -> MarkReadResult 반환', async () => {
      // Given
      const dto = createMarkReadResponseDto();
      httpClient.patch.mockResolvedValue({ ok: true, value: dto });

      // When
      const result = await service.markAsRead(1);

      // Then
      expect(httpClient.patch).toHaveBeenCalledWith('v1/notifications/1/read');
      expect(result).toEqual({ ok: true, value: dto });
    });

    test('HTTP 에러 -> Result.err 반환', async () => {
      // Given
      const apiError = createNotificationApiError();
      httpClient.patch.mockResolvedValue({ ok: false, error: apiError });

      // When
      const result = await service.markAsRead(1);

      // Then
      expect(result).toEqual({ ok: false, error: apiError });
    });
  });

  // ── markAllAsRead ────────────────────────────

  describe('markAllAsRead', () => {
    test('정상 응답 -> MarkReadResult 반환', async () => {
      // Given
      const dto = createMarkReadResponseDto({ readCount: 5 });
      httpClient.patch.mockResolvedValue({ ok: true, value: dto });

      // When
      const result = await service.markAllAsRead();

      // Then
      expect(httpClient.patch).toHaveBeenCalledWith('v1/notifications/inbox/read-all');
      expect(result).toEqual({ ok: true, value: dto });
    });

    test('HTTP 에러 -> Result.err 반환', async () => {
      // Given
      const apiError = createNotificationApiError();
      httpClient.patch.mockResolvedValue({ ok: false, error: apiError });

      // When
      const result = await service.markAllAsRead();

      // Then
      expect(result).toEqual({ ok: false, error: apiError });
    });
  });
});
