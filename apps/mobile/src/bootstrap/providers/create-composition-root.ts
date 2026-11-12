import type { KeyValueStorage } from '@src/core/ports/key-value-storage';
import { getErrorMessage, isKeychainLockedError, toError } from '@src/shared/errors';
import type { EncryptedStorageBootstrap } from '@src/shared/infra/storage/encrypted-draft-storage';
import type { QueryClient } from '@tanstack/react-query';

import { QUERY_CACHE_LOG_EVENT } from '../query/query-cache-log-events';
import { createQueryCacheStorage } from '../query/query-cache-persistence';
import type { AppContainerPorts } from './create-app-container';
import type { DevicePorts } from './create-device-ports';

interface CompositionRootPorts {
  createDevicePorts: () => DevicePorts;
  /** SecureStore의 키로 초안·조회 캐시 저장소를 연다. 실패해도 reject하지 않고 `failure`를 돌려준다 */
  openEncryptedStorage: (secureStorage: KeyValueStorage) => Promise<EncryptedStorageBootstrap>;
  createQueryClient: () => QueryClient;
}

export interface CompositionRoot {
  /** 이미 연 포트. 아직 열지 않았거나 저장소를 열지 못했으면 null */
  getOpenedPorts(): AppContainerPorts | null;
  openPorts(): Promise<AppContainerPorts>;
}

/**
 * 프로세스 수명 객체를 한 번만 만들고 다시 쓴다. 기기 포트와 QueryClient는 처음 열 때 만들고,
 * 저장소는 연 결과만 기억해 열지 못했으면 다음 `openPorts`(루트 "다시 시도")가 다시 연다
 */
export function createCompositionRoot({
  createDevicePorts,
  openEncryptedStorage,
  createQueryClient,
}: CompositionRootPorts): CompositionRoot {
  let devicePorts: DevicePorts | null = null;
  let queryClient: QueryClient | null = null;
  let openedPorts: AppContainerPorts | null = null;
  let opening: Promise<AppContainerPorts> | null = null;
  let hasReportedStorageFailure = false;

  const reportStorageFailure = (failure: unknown, { logger, errorReporter }: DevicePorts) => {
    // 이번 실행은 초안·조회 캐시를 기기에 남기지 않는다. 앱은 서버 값만으로 동작한다
    logger.warn(QUERY_CACHE_LOG_EVENT.ENCRYPTED_STORAGE_UNAVAILABLE, {
      error: getErrorMessage(failure),
    });
    // 키체인 잠김은 예상된 상태라 올리지 않고, 다시 열어 또 실패한 것은 같은 원인이라 한 번만 올린다
    if (hasReportedStorageFailure || isKeychainLockedError(failure)) {
      return;
    }
    hasReportedStorageFailure = true;
    errorReporter.captureException(toError(failure), { feature: 'draft' });
  };

  const open = async (): Promise<AppContainerPorts> => {
    devicePorts ??= createDevicePorts();
    queryClient ??= createQueryClient();
    const storage = await openEncryptedStorage(devicePorts.storage);
    const ports: AppContainerPorts = {
      ...devicePorts,
      draftStorage: storage.draftStorage,
      queryCacheStorage:
        storage.queryCacheStorage == null
          ? null
          : createQueryCacheStorage(storage.queryCacheStorage),
      queryClient,
    };
    if (storage.failure == null) {
      openedPorts = ports;
    } else {
      reportStorageFailure(storage.failure, devicePorts);
    }
    return ports;
  };

  return {
    getOpenedPorts: () => openedPorts,
    openPorts: () => {
      if (openedPorts != null) {
        return Promise.resolve(openedPorts);
      }
      // StrictMode가 effect를 두 번 돌려도 키를 한 번만 읽고 만든다
      opening ??= open().finally(() => {
        opening = null;
      });
      return opening;
    },
  };
}
