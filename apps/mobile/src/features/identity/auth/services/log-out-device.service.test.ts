import { ErrorCode } from '@aido/api/errors';
import type { RequestConfig } from '@src/core/ports/http-client';
import { createSessionEpoch } from '@src/core/session/session-epoch';
import {
  ApiError,
  err,
  NetworkError,
  ok,
  type Result,
  ServerError,
  TimeoutError,
} from '@src/shared/errors';
import { createAppLoggerStub } from '@src/testing/core';

import { LOGOUT_REQUEST_TIMEOUT_MS, LogOutDeviceService } from './log-out-device.service';

type TimeoutConfig = Pick<RequestConfig, 'timeout'> | undefined;

const createStubServices = ({
  logout = async (): Promise<Result<void, ApiError>> => ok(undefined),
  unregister = async (): Promise<Result<void, ApiError>> => ok(undefined),
} = {}) => {
  const calls: {
    unregister: TimeoutConfig[];
    logout: TimeoutConfig[];
    tokenClears: number;
    recorded: string[];
    pushReleaseRequests: number;
  } = { unregister: [], logout: [], tokenClears: 0, recorded: [], pushReleaseRequests: 0 };
  return {
    calls,
    pushRegistrationService: {
      unregister: (config?: TimeoutConfig) => {
        calls.unregister.push(config);
        return unregister();
      },
      requestRelease: () => {
        calls.pushReleaseRequests += 1;
      },
    },
    authApi: {
      logout: (config?: TimeoutConfig) => {
        calls.logout.push(config);
        return logout();
      },
    },
    tokenStore: {
      getRefreshToken: async (): Promise<string | null> => 'refresh-a',
      clear: async () => {
        calls.tokenClears += 1;
      },
    },
    sessionRevocationService: {
      record: async (refreshToken: string) => {
        calls.recorded.push(refreshToken);
      },
    },
    sessionEpoch: createSessionEpoch(),
  };
};

describe('LogOutDeviceService.logOut', () => {
  it('오프라인이면 서버 요청 없이 이 기기의 세션만 끝낸다', async () => {
    // Given
    const stub = createStubServices();

    // When
    await new LogOutDeviceService({ ...stub, logger: createAppLoggerStub() }).logOut({
      isOnline: false,
    });

    // Then
    expect(stub.calls.unregister).toEqual([]);
    expect(stub.calls.logout).toEqual([]);
    expect(stub.calls.tokenClears).toBe(1);
  });

  it('온라인이면 푸시 토큰 해제와 로그아웃 요청에 짧은 timeout을 건다', async () => {
    // Given
    const stub = createStubServices();

    // When
    await new LogOutDeviceService({ ...stub, logger: createAppLoggerStub() }).logOut({
      isOnline: true,
    });

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
    const result = new LogOutDeviceService({ ...stub, logger: createAppLoggerStub() }).logOut({
      isOnline: true,
    });

    // Then
    await expect(result).resolves.toBe('ended');
  });

  it('오프라인이면 복귀 후 해제하도록 지우기 전에 기록한다', async () => {
    // Given
    const stub = createStubServices();

    // When
    await new LogOutDeviceService({ ...stub, logger: createAppLoggerStub() }).logOut({
      isOnline: false,
    });

    // Then
    expect(stub.calls.recorded).toEqual(['refresh-a']);
    expect(stub.calls.tokenClears).toBe(1);
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
    await new LogOutDeviceService({ ...stub, logger: createAppLoggerStub() }).logOut({
      isOnline: true,
    });

    // Then
    expect(stub.calls.recorded).toEqual(['refresh-a']);
  });

  it('서버가 답한 로그아웃은 기록하지 않는다', async () => {
    // Given
    const stub = createStubServices({
      logout: async () => err(new ApiError(ErrorCode.SESSION_0701, '세션 없음', 401)),
    });

    // When
    await new LogOutDeviceService({ ...stub, logger: createAppLoggerStub() }).logOut({
      isOnline: true,
    });

    // Then
    expect(stub.calls.recorded).toEqual([]);
  });

  it('기록에 실패해도 이 기기의 토큰은 지운다', async () => {
    // Given
    const stub = createStubServices();

    // When
    await new LogOutDeviceService({
      ...stub,
      sessionRevocationService: {
        record: async () => {
          throw new Error('keychain write failed');
        },
      },
      logger: createAppLoggerStub(),
    }).logOut({ isOnline: false });

    // Then
    expect(stub.calls.tokenClears).toBe(1);
  });

  it('토큰을 읽지 못해도 이 기기의 토큰은 지운다', async () => {
    // Given
    const stub = createStubServices();

    // When
    await new LogOutDeviceService({
      ...stub,
      tokenStore: {
        ...stub.tokenStore,
        getRefreshToken: async () => {
          throw new Error('keychain read failed');
        },
      },
      logger: createAppLoggerStub(),
    }).logOut({ isOnline: false });

    // Then
    expect(stub.calls.tokenClears).toBe(1);
    expect(stub.calls.recorded).toEqual([]);
  });

  it('기록을 로그에 토큰 없이 남긴다', async () => {
    // Given
    const stub = createStubServices();
    const warnings: unknown[] = [];

    // When
    await new LogOutDeviceService({
      ...stub,
      sessionRevocationService: {
        record: async () => {
          throw new Error('keychain write failed');
        },
      },
      logger: { ...createAppLoggerStub(), warn: (...args: unknown[]) => warnings.push(args) },
    }).logOut({ isOnline: false });

    // Then
    expect(JSON.stringify(warnings)).not.toContain('refresh-a');
  });

  it('서버 응답을 기다리는 사이 세션이 끝났으면 토큰을 지우지 않고 다시 로그인했는지로 판정한다', async () => {
    // Given
    const stub = createStubServices();
    const { sessionEpoch } = stub;
    const authApi = {
      logout: async () => {
        sessionEpoch.advance();
        return ok(undefined);
      },
    };
    const getRefreshToken = jest
      .fn<Promise<string | null>, []>()
      .mockResolvedValueOnce('refresh-a')
      .mockResolvedValueOnce('refresh-b');

    // When
    const outcome = await new LogOutDeviceService({
      ...stub,
      authApi,
      tokenStore: { ...stub.tokenStore, getRefreshToken },
      logger: createAppLoggerStub(),
    }).logOut({ isOnline: true });

    // Then
    expect(outcome).toBe('superseded');
    expect(stub.calls.tokenClears).toBe(0);
    expect(stub.calls.pushReleaseRequests).toBe(0);
  });

  it('세션이 끝났고 새 토큰도 없으면 사용자가 나간 것으로 끝낸다', async () => {
    // Given
    const stub = createStubServices();
    const { sessionEpoch } = stub;
    const authApi = {
      logout: async () => {
        sessionEpoch.advance();
        return ok(undefined);
      },
    };
    const getRefreshToken = jest
      .fn<Promise<string | null>, []>()
      .mockResolvedValueOnce('refresh-a')
      .mockResolvedValueOnce(null);

    // When
    const outcome = await new LogOutDeviceService({
      ...stub,
      authApi,
      tokenStore: { ...stub.tokenStore, getRefreshToken },
      logger: createAppLoggerStub(),
    }).logOut({ isOnline: true });

    // Then
    expect(outcome).toBe('ended');
    expect(stub.calls.tokenClears).toBe(0);
  });

  it('토큰을 지우지 못해도 세션은 끝낸 것으로 판정한다', async () => {
    // Given
    const stub = createStubServices();
    const tokenStore = {
      ...stub.tokenStore,
      clear: async () => {
        throw new Error('keychain delete failed');
      },
    };

    // When
    const outcome = await new LogOutDeviceService({
      ...stub,
      tokenStore,
      logger: createAppLoggerStub(),
    }).logOut({ isOnline: false });

    // Then
    expect(outcome).toBe('ended');
  });
  it('오프라인 로그아웃은 서버에 알리지 못해 연결되면 기기 id와 토큰으로 푸시를 풀도록 요청한다', async () => {
    // Given
    const stub = createStubServices();

    // When
    await new LogOutDeviceService({ ...stub, logger: createAppLoggerStub() }).logOut({
      isOnline: false,
    });

    // Then
    expect(stub.calls.pushReleaseRequests).toBe(1);
  });

  it('온라인 로그아웃은 인증한 해제가 성공하면 공개 해제를 따로 요청하지 않는다', async () => {
    // Given
    const stub = createStubServices();

    // When
    await new LogOutDeviceService({ ...stub, logger: createAppLoggerStub() }).logOut({
      isOnline: true,
    });

    // Then
    expect(stub.calls.pushReleaseRequests).toBe(0);
  });

  it.each([
    ['서버가 거절', async () => err(new ApiError(ErrorCode.SESSION_0701, '세션 없음', 401))],
    [
      '연결 실패',
      async (): Promise<Result<void, ApiError>> => {
        throw new NetworkError();
      },
    ],
  ])(
    '온라인 로그아웃이라도 인증한 해제가 %s하면 공개 해제를 요청한다',
    async (_name, unregister) => {
      // Given
      const stub = createStubServices({ unregister });

      // When
      await new LogOutDeviceService({ ...stub, logger: createAppLoggerStub() }).logOut({
        isOnline: true,
      });

      // Then
      expect(stub.calls.pushReleaseRequests).toBe(1);
    },
  );
});
