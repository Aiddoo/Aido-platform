import { ErrorCode } from '@aido/api/errors';
import type { RequestConfig } from '@src/core/ports/http';
import type { Logger } from '@src/core/ports/logger';
import {
  ApiError,
  err,
  NetworkError,
  ok,
  type Result,
  ServerError,
  TimeoutError,
} from '@src/shared/errors';

import { LOGOUT_REQUEST_TIMEOUT_MS, logOutDevice } from './log-out-device';

const silentLogger: Logger = { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} };

type TimeoutConfig = Pick<RequestConfig, 'timeout'> | undefined;

const createStubServices = ({
  logout = async (): Promise<Result<void, ApiError>> => ok(undefined),
} = {}) => {
  const calls: {
    unregister: TimeoutConfig[];
    logout: TimeoutConfig[];
    clearLocalSession: number;
    recorded: string[];
  } = { unregister: [], logout: [], clearLocalSession: 0, recorded: [] };
  return {
    calls,
    pushDeviceService: {
      unregister: async (config?: TimeoutConfig) => {
        calls.unregister.push(config);
        return ok(undefined);
      },
    },
    authService: {
      logout: (config?: TimeoutConfig) => {
        calls.logout.push(config);
        return logout();
      },
      clearLocalSession: async () => {
        calls.clearLocalSession += 1;
      },
    },
    tokenStore: { readRefreshToken: async () => 'refresh-a' },
    sessionRevocationService: {
      record: async (refreshToken: string) => {
        calls.recorded.push(refreshToken);
      },
    },
  };
};

describe('logOutDevice', () => {
  it('오프라인이면 서버 요청 없이 이 기기의 세션만 끝낸다', async () => {
    // Given
    const stub = createStubServices();

    // When
    await logOutDevice({ isOnline: false, ...stub, logger: silentLogger });

    // Then
    expect(stub.calls.unregister).toEqual([]);
    expect(stub.calls.logout).toEqual([]);
    expect(stub.calls.clearLocalSession).toBe(1);
  });

  it('온라인이면 푸시 토큰 해제와 로그아웃 요청에 짧은 timeout을 건다', async () => {
    // Given
    const stub = createStubServices();

    // When
    await logOutDevice({ isOnline: true, ...stub, logger: silentLogger });

    // Then
    expect(stub.calls.unregister).toEqual([{ timeout: LOGOUT_REQUEST_TIMEOUT_MS }]);
    expect(stub.calls.logout).toEqual([{ timeout: LOGOUT_REQUEST_TIMEOUT_MS }]);
  });

  it('로그아웃 요청이 시간 초과돼도 실패로 던지지 않는다', async () => {
    // Given
    const stub = createStubServices({
      logout: async () => {
        throw new TimeoutError();
      },
    });

    // When
    const result = logOutDevice({ isOnline: true, ...stub, logger: silentLogger });

    // Then
    await expect(result).resolves.toBeUndefined();
  });

  it('오프라인이면 복귀 후 해제하도록 지우기 전에 기록한다', async () => {
    // Given
    const stub = createStubServices();

    // When
    await logOutDevice({ isOnline: false, ...stub, logger: silentLogger });

    // Then
    expect(stub.calls.recorded).toEqual(['refresh-a']);
    expect(stub.calls.clearLocalSession).toBe(1);
  });

  it.each([
    ['시간 초과', new TimeoutError()],
    ['연결 실패', new NetworkError()],
    ['서버 장애', new ServerError(503)],
  ])('서버에 닿지 못한 %s도 복귀 후 해제하도록 기록한다', async (_name, failure) => {
    // Given
    const stub = createStubServices({
      logout: async () => {
        throw failure;
      },
    });

    // When
    await logOutDevice({ isOnline: true, ...stub, logger: silentLogger });

    // Then
    expect(stub.calls.recorded).toEqual(['refresh-a']);
  });

  it('서버가 답한 로그아웃은 기록하지 않는다', async () => {
    // Given
    const stub = createStubServices({
      logout: async () => err(new ApiError(ErrorCode.SESSION_0701, '세션 없음', 401)),
    });

    // When
    await logOutDevice({ isOnline: true, ...stub, logger: silentLogger });

    // Then
    expect(stub.calls.recorded).toEqual([]);
  });

  it('기록에 실패해도 이 기기의 토큰은 지운다', async () => {
    // Given
    const stub = createStubServices();

    // When
    await logOutDevice({
      isOnline: false,
      ...stub,
      sessionRevocationService: {
        record: async () => {
          throw new Error('keychain write failed');
        },
      },
      logger: silentLogger,
    });

    // Then
    expect(stub.calls.clearLocalSession).toBe(1);
  });

  it('토큰을 읽지 못해도 이 기기의 토큰은 지운다', async () => {
    // Given
    const stub = createStubServices();

    // When
    await logOutDevice({
      isOnline: false,
      ...stub,
      tokenStore: {
        readRefreshToken: async () => {
          throw new Error('keychain read failed');
        },
      },
      logger: silentLogger,
    });

    // Then
    expect(stub.calls.clearLocalSession).toBe(1);
    expect(stub.calls.recorded).toEqual([]);
  });

  it('기록을 로그에 토큰 없이 남긴다', async () => {
    // Given
    const stub = createStubServices();
    const warnings: unknown[] = [];

    // When
    await logOutDevice({
      isOnline: false,
      ...stub,
      sessionRevocationService: {
        record: async () => {
          throw new Error('keychain write failed');
        },
      },
      logger: { ...silentLogger, warn: (...args: unknown[]) => warnings.push(args) },
    });

    // Then
    expect(JSON.stringify(warnings)).not.toContain('refresh-a');
  });
});
