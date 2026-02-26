import { createMockHttpClient } from '@src/shared/__tests__';
import { ApiError } from '@src/shared/errors/api-error';
import { NotificationRepositoryImpl } from './notification.repository.impl';

describe('NotificationRepositoryImpl', () => {
  let httpClient: ReturnType<typeof createMockHttpClient>;
  let repository: NotificationRepositoryImpl;

  beforeEach(() => {
    httpClient = createMockHttpClient();
    repository = new NotificationRepositoryImpl(httpClient);
  });

  describe('unregisterToken', () => {
    test('deviceId가 있으면 query params로 전달한다', async () => {
      // Given
      httpClient.delete.mockResolvedValue({ ok: true, value: { message: 'ok' } });

      // When
      const result = await repository.unregisterToken('device-1');

      // Then
      expect(httpClient.delete).toHaveBeenCalledWith('v1/notifications/token', {
        params: { deviceId: 'device-1' },
      });
      expect(result).toEqual({ ok: true, value: undefined });
    });

    test('deviceId가 없으면 config 없이 호출한다', async () => {
      // Given
      httpClient.delete.mockResolvedValue({ ok: true, value: { message: 'ok' } });

      // When
      const result = await repository.unregisterToken();

      // Then
      expect(httpClient.delete).toHaveBeenCalledWith('v1/notifications/token', undefined);
      expect(result).toEqual({ ok: true, value: undefined });
    });

    test('HTTP 에러를 그대로 반환한다', async () => {
      // Given
      const apiError = new ApiError('AUTH_0107', '로그인이 필요합니다', 401);
      httpClient.delete.mockResolvedValue({ ok: false, error: apiError });

      // When
      const result = await repository.unregisterToken('device-1');

      // Then
      expect(result).toEqual({ ok: false, error: apiError });
    });
  });
});
