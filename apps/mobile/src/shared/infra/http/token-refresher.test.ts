import { createMockStorage } from '@src/shared/__tests__';

jest.mock('@src/shared/config/env', () => ({
  ENV: {
    APP_ENV: 'development',
    IS_DEV: true,
    IS_PRODUCTION: false,
    API_URL: 'http://localhost:3000',
    SCHEME: 'aido',
    PLATFORM: 'ios',
    IS_IOS: true,
    IS_ANDROID: false,
  },
}));

jest.mock('ky', () => ({
  __esModule: true,
  default: { post: jest.fn() },
}));

jest.mock('@src/core/events/session-expired', () => ({
  emitSessionExpired: jest.fn(),
}));

import { emitSessionExpired } from '@src/core/events/session-expired';
import ky from 'ky';
import { createTokenRefresher } from './token-refresher';

const mockPost = ky.post as jest.Mock;
const mockEmitSessionExpired = emitSessionExpired as jest.Mock;

const createFakeResponse = (params: { ok: boolean; status: number; body?: unknown }): Response => {
  return {
    ok: params.ok,
    status: params.status,
    json: jest.fn().mockResolvedValue(params.body),
  } as unknown as Response;
};

const TOKENS_BODY = {
  success: true,
  data: { accessToken: 'new-access', refreshToken: 'new-refresh' },
  timestamp: 1234567890,
};

describe('createTokenRefresher', () => {
  let storage: ReturnType<typeof createMockStorage>;

  beforeEach(() => {
    jest.clearAllMocks();
    storage = createMockStorage();
  });

  describe('성공', () => {
    it('갱신 성공 시 새 토큰 페어를 저장하고 true를 반환해야 한다', async () => {
      // Given
      storage.get.mockResolvedValue('old-refresh');
      mockPost.mockResolvedValue(createFakeResponse({ ok: true, status: 200, body: TOKENS_BODY }));
      const refresh = createTokenRefresher(storage);

      // When
      const result = await refresh();

      // Then
      expect(result).toBe(true);
      expect(storage.set).toHaveBeenCalledWith('accessToken', 'new-access');
      expect(storage.set).toHaveBeenCalledWith('refreshToken', 'new-refresh');
      expect(mockEmitSessionExpired).not.toHaveBeenCalled();
    });

    it('동시 호출은 하나의 갱신 요청을 공유해야 한다 (single-flight)', async () => {
      // Given
      storage.get.mockResolvedValue('old-refresh');
      let resolveResponse: (response: Response) => void = () => {};
      mockPost.mockReturnValue(
        new Promise<Response>((resolve) => {
          resolveResponse = resolve;
        }),
      );
      const refresh = createTokenRefresher(storage);

      // When
      const first = refresh();
      const second = refresh();
      resolveResponse(createFakeResponse({ ok: true, status: 200, body: TOKENS_BODY }));

      // Then
      await expect(first).resolves.toBe(true);
      await expect(second).resolves.toBe(true);
      expect(mockPost).toHaveBeenCalledTimes(1);
    });

    it('갱신이 정산된 뒤의 재호출은 새 갱신 요청을 보내야 한다', async () => {
      // Given
      storage.get.mockResolvedValue('old-refresh');
      mockPost.mockResolvedValue(createFakeResponse({ ok: true, status: 200, body: TOKENS_BODY }));
      const refresh = createTokenRefresher(storage);

      // When
      await refresh();
      await refresh();

      // Then
      expect(mockPost).toHaveBeenCalledTimes(2);
    });
  });

  describe('definitive 실패 (세션 만료 확정)', () => {
    it('401 응답이면 토큰을 삭제하고 이벤트를 발행해야 한다', async () => {
      // Given
      storage.get.mockResolvedValue('old-refresh');
      mockPost.mockResolvedValue(createFakeResponse({ ok: false, status: 401 }));
      const refresh = createTokenRefresher(storage);

      // When
      const result = await refresh();

      // Then
      expect(result).toBe(false);
      expect(storage.remove).toHaveBeenCalledWith('accessToken');
      expect(storage.remove).toHaveBeenCalledWith('refreshToken');
      expect(mockEmitSessionExpired).toHaveBeenCalledTimes(1);
    });

    it('2xx인데 응답 스키마가 어긋나면 세션 만료로 처리해야 한다', async () => {
      // Given: 서버는 이미 로테이션했으므로 보유 토큰은 곧 무효
      storage.get.mockResolvedValue('old-refresh');
      mockPost.mockResolvedValue(
        createFakeResponse({ ok: true, status: 200, body: { data: { unexpected: true } } }),
      );
      const refresh = createTokenRefresher(storage);

      // When
      const result = await refresh();

      // Then
      expect(result).toBe(false);
      expect(storage.remove).toHaveBeenCalledWith('refreshToken');
      expect(mockEmitSessionExpired).toHaveBeenCalledTimes(1);
    });

    it('리프레시 토큰이 없으면 네트워크 호출 없이 세션 만료로 처리해야 한다', async () => {
      // Given
      storage.get.mockResolvedValue(null);
      const refresh = createTokenRefresher(storage);

      // When
      const result = await refresh();

      // Then
      expect(result).toBe(false);
      expect(mockPost).not.toHaveBeenCalled();
      expect(mockEmitSessionExpired).toHaveBeenCalledTimes(1);
    });
  });

  describe('transient 실패 (토큰 보존)', () => {
    it.each([
      429, 500,
    ])('%i 응답이면 토큰을 보존하고 이벤트를 발행하지 않아야 한다', async (status) => {
      // Given
      storage.get.mockResolvedValue('old-refresh');
      mockPost.mockResolvedValue(createFakeResponse({ ok: false, status }));
      const refresh = createTokenRefresher(storage);

      // When
      const result = await refresh();

      // Then
      expect(result).toBe(false);
      expect(storage.remove).not.toHaveBeenCalled();
      expect(mockEmitSessionExpired).not.toHaveBeenCalled();
    });

    it('네트워크 오류면 토큰을 보존하고 false를 반환해야 한다', async () => {
      // Given
      storage.get.mockResolvedValue('old-refresh');
      mockPost.mockRejectedValue(new TypeError('Network request failed'));
      const refresh = createTokenRefresher(storage);

      // When
      const result = await refresh();

      // Then
      expect(result).toBe(false);
      expect(storage.remove).not.toHaveBeenCalled();
      expect(mockEmitSessionExpired).not.toHaveBeenCalled();
    });
  });
});
