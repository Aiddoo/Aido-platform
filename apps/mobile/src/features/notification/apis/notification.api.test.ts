import { err, ok, unwrap } from '@src/core/errors/result';
import { NetworkError } from '@src/shared/errors';
import { createHttpClientStub } from '@src/testing/core';
import { setupFakeTimersPerTest } from '@src/testing/timers';
import { noop } from 'es-toolkit';

import {
  createMarkReadResponseDto,
  createNotificationApiError,
  createNotificationListResponseDto,
  createUnreadCountResponseDto,
  INVALID_DTO,
} from '../__tests__/notification.fixtures';
import { NOTIFICATION_READ_BUDGET_MS } from '../constants/notification.constants';
import { NotificationApi } from './notification.api';

describe('NotificationApi', () => {
  let httpClient: ReturnType<typeof createHttpClientStub>;
  let api: NotificationApi;

  beforeEach(() => {
    httpClient = createHttpClientStub();
    api = new NotificationApi({
      httpClient,
      publicHttpClient: httpClient,
    });
  });

  describe('getNotifications', () => {
    it('응답을 받으면 알림 목록을 반환한다', async () => {
      // Given
      const dto = createNotificationListResponseDto();
      httpClient.get.mockResolvedValue({ ok: true, value: dto });

      // When
      const result = await api.getNotifications({ limit: 20 });

      // Then
      expect(httpClient.get).toHaveBeenCalledWith('v1/notifications/inbox', {
        params: expect.objectContaining({ limit: 20 }),
      });
      expect(result.ok).toBe(true);
      const page = unwrap(result);
      expect(page.items).toHaveLength(2);
      expect(page.items[0]?.createdAt).toBe('2026-03-08T10:00:00.000Z');
    });

    it('응답이 계약과 다르면 ParseError를 던진다', async () => {
      // Given
      httpClient.get.mockResolvedValue({ ok: true, value: INVALID_DTO });

      // When

      const result = api.getNotifications();

      // Then

      await expect(result).rejects.toThrow('Invalid getNotifications response');
    });
  });

  describe('getUnreadCount', () => {
    it('응답을 받으면 읽지 않은 수를 반환한다', async () => {
      // Given
      const dto = createUnreadCountResponseDto({ unreadCount: 5 });
      httpClient.get.mockResolvedValue({ ok: true, value: dto });

      // When
      const result = await api.getUnreadCount();

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
      const result = await api.getUnreadCount();

      // Then
      expect(result).toEqual({ ok: false, error: apiError });
    });
  });

  describe('markAsRead', () => {
    it('응답을 받으면 읽음 처리한 수를 반환한다', async () => {
      // Given
      const dto = createMarkReadResponseDto({ readCount: 1 });
      httpClient.patch.mockResolvedValue({ ok: true, value: dto });

      // When
      const result = await api.markAsRead(1);

      // Then
      expect(httpClient.patch).toHaveBeenCalledWith('v1/notifications/1/read');
      expect(result).toEqual({ ok: true, value: 1 });
    });

    it('HTTP 오류이면 실패 결과를 반환한다', async () => {
      // Given
      const apiError = createNotificationApiError();
      httpClient.patch.mockResolvedValue({ ok: false, error: apiError });

      // When
      const result = await api.markAsRead(1);

      // Then
      expect(result).toEqual({ ok: false, error: apiError });
    });
  });

  describe('markAllAsRead', () => {
    it('응답을 받으면 읽음 처리한 수를 반환한다', async () => {
      // Given
      const dto = createMarkReadResponseDto({ readCount: 5 });
      httpClient.patch.mockResolvedValue({ ok: true, value: dto });

      // When
      const result = await api.markAllAsRead();

      // Then
      expect(httpClient.patch).toHaveBeenCalledWith('v1/notifications/inbox/read-all');
      expect(result).toEqual({ ok: true, value: 5 });
    });

    it('HTTP 오류이면 실패 결과를 반환한다', async () => {
      // Given
      const apiError = createNotificationApiError();
      httpClient.patch.mockResolvedValue({ ok: false, error: apiError });

      // When
      const result = await api.markAllAsRead();

      // Then
      expect(result).toEqual({ ok: false, error: apiError });
    });
  });
});

describe('NotificationApi.markAsReadAndCheckOwnership', () => {
  setupFakeTimersPerTest();

  function setup() {
    const httpClient = createHttpClientStub();
    return {
      httpClient,
      api: new NotificationApi({
        httpClient,
        publicHttpClient: httpClient,
      }),
    };
  }

  it('읽음이 성공하면 내 알림이다', async () => {
    // Given
    const { httpClient, api } = setup();
    httpClient.patch.mockResolvedValue(ok(createMarkReadResponseDto()));

    // When
    const ownership = await api.markAsReadAndCheckOwnership(7);

    // Then
    expect(ownership).toBe('ok');
  });

  it.each([403, 404])('읽음이 %s면 다른 계정 알림이다', async (status) => {
    // Given
    const { httpClient, api } = setup();
    httpClient.patch.mockResolvedValue(err(createNotificationApiError({ status })));

    // When
    const ownership = await api.markAsReadAndCheckOwnership(7);

    // Then
    expect(ownership).toBe('foreign');
  });

  it('다른 4xx와 네트워크 실패는 모르는 것이다', async () => {
    // Given
    const { httpClient, api } = setup();
    httpClient.patch.mockResolvedValueOnce(err(createNotificationApiError({ status: 400 })));
    httpClient.patch.mockRejectedValueOnce(new NetworkError());

    // When
    const rejected = await api.markAsReadAndCheckOwnership(7);
    const offline = await api.markAsReadAndCheckOwnership(7);

    // Then
    expect(rejected).toBe('unknown');
    expect(offline).toBe('unknown');
  });

  it('응답이 예산을 넘기면 기다리지 않고 모르는 것으로 끝난다', async () => {
    // Given
    const { httpClient, api } = setup();
    httpClient.patch.mockReturnValue(new Promise(noop));

    // When
    const ownership = api.markAsReadAndCheckOwnership(7);
    await jest.advanceTimersByTimeAsync(NOTIFICATION_READ_BUDGET_MS);

    // Then
    await expect(ownership).resolves.toBe('unknown');
  });

  it('ID가 0이면 묻지 않는다', async () => {
    // Given
    const { httpClient, api } = setup();

    // When
    const ownership = await api.markAsReadAndCheckOwnership(0);

    // Then
    expect(ownership).toBe('ok');
    expect(httpClient.patch).not.toHaveBeenCalled();
  });
});
