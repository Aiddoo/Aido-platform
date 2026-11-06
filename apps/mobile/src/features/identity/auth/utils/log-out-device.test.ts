import type { RequestConfig } from '@src/core/ports/http';
import type { Logger } from '@src/core/ports/logger';
import { ok, TimeoutError } from '@src/shared/errors';

import { LOGOUT_REQUEST_TIMEOUT_MS, logOutDevice } from './log-out-device';

const silentLogger: Logger = { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} };

type TimeoutConfig = Pick<RequestConfig, 'timeout'> | undefined;

const createStubServices = ({ logout = async () => ok(undefined) } = {}) => {
  const calls: { unregister: TimeoutConfig[]; logout: TimeoutConfig[]; clearLocalSession: number } =
    { unregister: [], logout: [], clearLocalSession: 0 };
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
});
