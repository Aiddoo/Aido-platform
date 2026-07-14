import type { Logger } from '@src/core/ports/logger';
import { createMockHttpClient } from '@src/shared/__tests__';
import {
  createMarkReadResponseDto,
  createNotificationApiError,
  createNotificationListResponseDto,
  createRegisterTokenResponseDto,
  createUnreadCountResponseDto,
  INVALID_DTO,
} from '../__tests__/notification.factories';
import type { DeviceIdService } from './device-id.service';
import { NotificationService } from './notification.service';
import type { PushTokenService } from './push-token.service';

// expo-notifications mock
jest.mock('expo-notifications', () => ({
  setBadgeCountAsync: jest.fn(),
}));

describe('NotificationService', () => {
  let httpClient: ReturnType<typeof createMockHttpClient>;
  let deviceIdService: { get: jest.Mock; clear: jest.Mock };
  let pushTokenService: {
    getExpoPushToken: jest.Mock;
    isPhysicalDevice: jest.Mock;
    requestPermission: jest.Mock;
  };
  let logger: jest.Mocked<Logger>;
  let service: NotificationService;

  beforeEach(() => {
    httpClient = createMockHttpClient();
    deviceIdService = {
      get: jest.fn().mockResolvedValue('device-123'),
      clear: jest.fn(),
    };
    pushTokenService = {
      getExpoPushToken: jest.fn().mockResolvedValue({ ok: true, value: 'ExponentPushToken[xxx]' }),
      isPhysicalDevice: jest.fn().mockReturnValue(true),
      requestPermission: jest.fn(),
    };
    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    service = new NotificationService(
      httpClient,
      deviceIdService as unknown as DeviceIdService,
      pushTokenService as unknown as PushTokenService,
      logger,
    );
  });

  // ── setupPushNotifications ───────────────────

  describe('setupPushNotifications', () => {
    test('정상 -> registerToken 호출 + 결과 반환', async () => {
      // Given
      const dto = createRegisterTokenResponseDto();
      httpClient.post.mockResolvedValue({ ok: true, value: dto });

      // When
      const result = await service.setupPushNotifications();

      // Then
      expect(httpClient.post).toHaveBeenCalledWith('v1/notifications/token', {
        token: 'ExponentPushToken[xxx]',
        deviceId: 'device-123',
        payloadVersion: 2,
        appVersion: 'mock',
      });
      expect(result).toEqual({ ok: true, value: dto });
    });

    test('PushTokenService 실패 -> 에러 전파', async () => {
      // Given
      const error = { code: 'NOTIFICATION_PERMISSION_DENIED', message: '권한 거부' };
      pushTokenService.getExpoPushToken.mockResolvedValue({ ok: false, error });

      // When
      const result = await service.setupPushNotifications();

      // Then
      expect(result).toEqual({ ok: false, error });
      expect(httpClient.post).not.toHaveBeenCalled();
    });

    test('Zod 검증 실패 -> ParseError throw', async () => {
      // Given
      httpClient.post.mockResolvedValue({ ok: true, value: INVALID_DTO });

      // When & Then
      await expect(service.setupPushNotifications()).rejects.toThrow(
        'Invalid registerToken response',
      );
    });
  });

  // ── unregisterPushToken ──────────────────────

  describe('unregisterPushToken', () => {
    test('deviceId와 함께 호출', async () => {
      // Given
      httpClient.delete.mockResolvedValue({ ok: true, value: { message: 'ok' } });

      // When
      const result = await service.unregisterPushToken();

      // Then
      expect(httpClient.delete).toHaveBeenCalledWith('v1/notifications/token', {
        params: { deviceId: 'device-123' },
      });
      expect(result).toEqual({ ok: true, value: undefined });
    });

    test('HTTP 에러 -> Result.err 반환', async () => {
      // Given
      const apiError = createNotificationApiError();
      httpClient.delete.mockResolvedValue({ ok: false, error: apiError });

      // When
      const result = await service.unregisterPushToken();

      // Then
      expect(result).toEqual({ ok: false, error: apiError });
    });
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
      expect(httpClient.get).toHaveBeenCalledWith('v1/notifications', {
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
      expect(httpClient.get).toHaveBeenCalledWith('v1/notifications/unread-count');
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
      expect(httpClient.patch).toHaveBeenCalledWith('v1/notifications/read-all');
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
