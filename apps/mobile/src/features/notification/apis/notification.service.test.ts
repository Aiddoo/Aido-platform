import { err, ok } from '@src/core/errors/result';
import { createHttpClientStub } from '@src/shared/__tests__';
import { NetworkError } from '@src/shared/errors';
import { noop } from 'es-toolkit';

import {
  createMarkReadResponseDto,
  createNotificationApiError,
  createNotificationListResponseDto,
  createPushNotificationGatewayStub,
  createUnreadCountResponseDto,
  INVALID_DTO,
} from '../__tests__/notification.fixtures';
import { NOTIFICATION_READ_BUDGET_MS } from '../constants/notification.constants';
import { NotificationService } from './notification.service';

describe('NotificationService', () => {
  let httpClient: ReturnType<typeof createHttpClientStub>;
  let service: NotificationService;

  beforeEach(() => {
    httpClient = createHttpClientStub();
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
        expect(result.value.notifications[0]?.createdAt).toBe('2026-03-08T10:00:00.000Z');
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

describe('NotificationService.checkOwnership', () => {
  function setup() {
    const httpClient = createHttpClientStub();
    return {
      httpClient,
      service: new NotificationService(httpClient, createPushNotificationGatewayStub()),
    };
  }

  afterEach(() => {
    jest.useRealTimers();
  });

  test('읽음이 성공하면 내 알림이다', async () => {
    // Given
    const { httpClient, service } = setup();
    httpClient.patch.mockResolvedValue(ok(createMarkReadResponseDto()));

    // When
    const ownership = await service.checkOwnership(7);

    // Then
    expect(ownership).toBe('ok');
  });

  test.each([403, 404])('읽음이 %s면 다른 계정 알림이다', async (status) => {
    // Given
    const { httpClient, service } = setup();
    httpClient.patch.mockResolvedValue(err(createNotificationApiError({ status })));

    // When
    const ownership = await service.checkOwnership(7);

    // Then
    expect(ownership).toBe('foreign');
  });

  test('다른 4xx와 네트워크 실패는 모르는 것이다', async () => {
    // Given
    const { httpClient, service } = setup();
    httpClient.patch.mockResolvedValueOnce(err(createNotificationApiError({ status: 400 })));
    httpClient.patch.mockRejectedValueOnce(new NetworkError());

    // When
    const rejected = await service.checkOwnership(7);
    const offline = await service.checkOwnership(7);

    // Then
    expect(rejected).toBe('unknown');
    expect(offline).toBe('unknown');
  });

  test('응답이 예산을 넘기면 기다리지 않고 모르는 것으로 끝난다', async () => {
    // Given
    jest.useFakeTimers();
    const { httpClient, service } = setup();
    httpClient.patch.mockReturnValue(new Promise(noop));

    // When
    const ownership = service.checkOwnership(7);
    await jest.advanceTimersByTimeAsync(NOTIFICATION_READ_BUDGET_MS);

    // Then
    await expect(ownership).resolves.toBe('unknown');
  });

  test('ID가 0이면 묻지 않는다', async () => {
    // Given
    const { httpClient, service } = setup();

    // When
    const ownership = await service.checkOwnership(0);

    // Then
    expect(ownership).toBe('ok');
    expect(httpClient.patch).not.toHaveBeenCalled();
  });
});
