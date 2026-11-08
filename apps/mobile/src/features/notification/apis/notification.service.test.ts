import { err, ok, unwrap } from '@src/core/errors/result';
import {
  createHttpClientStub,
  createLoggerStub,
  createPushNotificationGatewayStub,
} from '@src/shared/__tests__';
import { NetworkError, ServerError } from '@src/shared/errors';
import { noop } from 'es-toolkit';

import {
  createMarkReadResponseDto,
  createNotificationApiError,
  createNotificationListResponseDto,
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
    service = new NotificationService({
      httpClient,
      badgeGateway: createPushNotificationGatewayStub(),
      publicHttpClient: httpClient,
      logger: createLoggerStub(),
    });
  });

  // ── getNotifications ─────────────────────────

  describe('getNotifications', () => {
    it('응답을 받으면 알림 목록을 반환한다', async () => {
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
      const page = unwrap(result);
      expect(page.notifications).toHaveLength(2);
      expect(page.notifications[0]?.createdAt).toBe('2026-03-08T10:00:00.000Z');
    });

    it('응답이 계약과 다르면 ParseError를 던진다', async () => {
      // Given
      httpClient.get.mockResolvedValue({ ok: true, value: INVALID_DTO });

      // When

      const result = service.getNotifications();

      // Then

      await expect(result).rejects.toThrow('Invalid getNotifications response');
    });
  });

  // ── getUnreadCount ───────────────────────────

  describe('getUnreadCount', () => {
    it('응답을 받으면 읽지 않은 수를 반환한다', async () => {
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

    it('HTTP 오류이면 실패 결과를 반환한다', async () => {
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
    it('응답을 받으면 읽음 처리 결과를 반환한다', async () => {
      // Given
      const dto = createMarkReadResponseDto();
      httpClient.patch.mockResolvedValue({ ok: true, value: dto });

      // When
      const result = await service.markAsRead(1);

      // Then
      expect(httpClient.patch).toHaveBeenCalledWith('v1/notifications/1/read');
      expect(result).toEqual({ ok: true, value: dto });
    });

    it('HTTP 오류이면 실패 결과를 반환한다', async () => {
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
    it('응답을 받으면 읽음 처리 결과를 반환한다', async () => {
      // Given
      const dto = createMarkReadResponseDto({ readCount: 5 });
      httpClient.patch.mockResolvedValue({ ok: true, value: dto });

      // When
      const result = await service.markAllAsRead();

      // Then
      expect(httpClient.patch).toHaveBeenCalledWith('v1/notifications/inbox/read-all');
      expect(result).toEqual({ ok: true, value: dto });
    });

    it('HTTP 오류이면 실패 결과를 반환한다', async () => {
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

describe('NotificationService.markAsReadAndCheckOwnership', () => {
  function setup() {
    const httpClient = createHttpClientStub();
    return {
      httpClient,
      service: new NotificationService({
        httpClient,
        badgeGateway: createPushNotificationGatewayStub(),
        publicHttpClient: httpClient,
        logger: createLoggerStub(),
      }),
    };
  }

  afterEach(() => {
    jest.useRealTimers();
  });

  it('읽음이 성공하면 내 알림이다', async () => {
    // Given
    const { httpClient, service } = setup();
    httpClient.patch.mockResolvedValue(ok(createMarkReadResponseDto()));

    // When
    const ownership = await service.markAsReadAndCheckOwnership(7);

    // Then
    expect(ownership).toBe('ok');
  });

  it.each([403, 404])('읽음이 %s면 다른 계정 알림이다', async (status) => {
    // Given
    const { httpClient, service } = setup();
    httpClient.patch.mockResolvedValue(err(createNotificationApiError({ status })));

    // When
    const ownership = await service.markAsReadAndCheckOwnership(7);

    // Then
    expect(ownership).toBe('foreign');
  });

  it('다른 4xx와 네트워크 실패는 모르는 것이다', async () => {
    // Given
    const { httpClient, service } = setup();
    httpClient.patch.mockResolvedValueOnce(err(createNotificationApiError({ status: 400 })));
    httpClient.patch.mockRejectedValueOnce(new NetworkError());

    // When
    const rejected = await service.markAsReadAndCheckOwnership(7);
    const offline = await service.markAsReadAndCheckOwnership(7);

    // Then
    expect(rejected).toBe('unknown');
    expect(offline).toBe('unknown');
  });

  it('응답이 예산을 넘기면 기다리지 않고 모르는 것으로 끝난다', async () => {
    // Given
    jest.useFakeTimers();
    const { httpClient, service } = setup();
    httpClient.patch.mockReturnValue(new Promise(noop));

    // When
    const ownership = service.markAsReadAndCheckOwnership(7);
    await jest.advanceTimersByTimeAsync(NOTIFICATION_READ_BUDGET_MS);

    // Then
    await expect(ownership).resolves.toBe('unknown');
  });

  it('ID가 0이면 묻지 않는다', async () => {
    // Given
    const { httpClient, service } = setup();

    // When
    const ownership = await service.markAsReadAndCheckOwnership(0);

    // Then
    expect(ownership).toBe('ok');
    expect(httpClient.patch).not.toHaveBeenCalled();
  });
});

describe('NotificationService.syncBadge', () => {
  function setup() {
    const httpClient = createHttpClientStub();
    const badgeGateway = createPushNotificationGatewayStub();
    const logger = createLoggerStub();
    return {
      httpClient,
      badgeGateway,
      logger,
      service: new NotificationService({
        httpClient,
        badgeGateway,
        publicHttpClient: httpClient,
        logger,
      }),
    };
  }

  it.each(['loading', 'locked'] as const)(
    '인증을 확인하는 중(%s)에는 배지를 지우지도 맞추지도 않는다',
    async (authStatus) => {
      // Given
      const { httpClient, badgeGateway, service } = setup();

      // When
      await service.syncBadge({ authStatus, isOnline: true });

      // Then
      expect(httpClient.get).not.toHaveBeenCalled();
      expect(badgeGateway.setBadgeCount).not.toHaveBeenCalled();
    },
  );

  it('로그아웃 상태로 확정되면 배지를 지운다', async () => {
    // Given
    const { httpClient, badgeGateway, service } = setup();

    // When
    await service.syncBadge({ authStatus: 'unauthenticated', isOnline: true });

    // Then
    expect(httpClient.get).not.toHaveBeenCalled();
    expect(badgeGateway.setBadgeCount).toHaveBeenCalledWith(0);
  });

  it('로그인 상태면 읽지 않은 알림 수로 배지를 맞춘다', async () => {
    // Given
    const { httpClient, badgeGateway, service } = setup();
    httpClient.get.mockResolvedValue(ok(createUnreadCountResponseDto({ unreadCount: 3 })));

    // When
    await service.syncBadge({ authStatus: 'authenticated', isOnline: true });

    // Then
    expect(badgeGateway.setBadgeCount).toHaveBeenCalledWith(3);
  });

  it('오프라인이면 배지 조회를 건너뛰고 오류를 남기지 않는다', async () => {
    // Given
    const { httpClient, logger, service } = setup();

    // When
    await service.syncBadge({ authStatus: 'authenticated', isOnline: false });

    // Then
    expect(httpClient.get).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('연결 오류로 실패하면 사용자에게 보이는 오류 대신 경고로만 남긴다', async () => {
    // Given
    const { httpClient, logger, service } = setup();
    httpClient.get.mockRejectedValue(new NetworkError());

    // When
    await service.syncBadge({ authStatus: 'authenticated', isOnline: true });

    // Then
    expect(logger.error).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith('notification.badge-sync.failed', expect.any(Object));
  });

  it('서버 오류로 실패하면 오류로 남긴다', async () => {
    // Given
    const { httpClient, logger, service } = setup();
    httpClient.get.mockRejectedValue(new ServerError(503));

    // When
    await service.syncBadge({ authStatus: 'authenticated', isOnline: true });

    // Then
    expect(logger.error).toHaveBeenCalledWith('notification.badge-sync.failed', expect.any(Error));
  });
});
