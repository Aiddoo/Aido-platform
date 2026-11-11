import { KeychainLockedError } from '@src/shared/errors';
import {
  disabledDraftStorage,
  type EncryptedStorageBootstrap,
} from '@src/shared/infra/storage/encrypted-draft-storage';
import {
  createErrorReporterStub,
  createMemorySyncStorage,
  createTestPorts,
  createTestQueryClient,
} from '@src/testing/core';

import { createCompositionRoot } from './create-composition-root';

function opened(): EncryptedStorageBootstrap {
  return { draftStorage: createMemorySyncStorage(), queryCacheStorage: null };
}

function failed(failure: unknown = new Error('keychain read failed')): EncryptedStorageBootstrap {
  return { draftStorage: disabledDraftStorage, queryCacheStorage: null, failure };
}

/** 저장소 열기는 `results`를 차례로 돌려주고 마지막 것을 되풀이한다 */
function createRoot(results: EncryptedStorageBootstrap[]) {
  const errorReporter = createErrorReporterStub();
  const created = { devicePorts: 0, queryClients: 0, storageOpens: 0 };
  const root = createCompositionRoot({
    createDevicePorts: () => {
      created.devicePorts += 1;
      return createTestPorts({ errorReporter });
    },
    openEncryptedStorage: async () => {
      const result = results[Math.min(created.storageOpens, results.length - 1)];
      if (result == null) {
        throw new Error('저장소 열기 결과를 정하지 않았습니다');
      }
      created.storageOpens += 1;
      return result;
    },
    createQueryClient: () => {
      created.queryClients += 1;
      return createTestQueryClient();
    },
  });
  return { root, created, errorReporter };
}

describe('createCompositionRoot', () => {
  it('연 뒤에는 같은 포트를 돌려주고 기기 포트·QueryClient·저장소를 다시 만들지 않는다', async () => {
    // Given
    const { root, created } = createRoot([opened()]);
    const first = await root.openPorts();

    // When
    const second = await root.openPorts();

    // Then
    expect(second).toBe(first);
    expect(root.getOpenedPorts()).toBe(first);
    expect(created).toEqual({ devicePorts: 1, queryClients: 1, storageOpens: 1 });
  });

  it('StrictMode처럼 동시에 두 번 열어도 저장소 키를 한 번만 읽는다', async () => {
    // Given
    const { root, created } = createRoot([opened()]);

    // When
    const [first, second] = await Promise.all([root.openPorts(), root.openPorts()]);

    // Then
    expect(second).toBe(first);
    expect(created.storageOpens).toBe(1);
  });

  it('저장소를 열지 못하면 저장을 끈 포트로 열고 다음에 다시 열며 같은 실패는 한 번만 보고한다', async () => {
    // Given
    const storage = opened();
    const { root, created, errorReporter } = createRoot([failed(), failed(), storage]);
    const withoutStorage = await root.openPorts();
    expect(root.getOpenedPorts()).toBeNull();
    await root.openPorts();

    // When
    const reopened = await root.openPorts();

    // Then
    expect(withoutStorage.draftStorage).toBe(disabledDraftStorage);
    expect(reopened.draftStorage).toBe(storage.draftStorage);
    expect(root.getOpenedPorts()).toBe(reopened);
    expect(reopened.tokenStore).toBe(withoutStorage.tokenStore);
    expect(reopened.queryClient).toBe(withoutStorage.queryClient);
    expect(created).toEqual({ devicePorts: 1, queryClients: 1, storageOpens: 3 });
    expect(errorReporter.captureException).toHaveBeenCalledTimes(1);
  });

  it('키체인이 잠겨 열지 못한 것은 예상된 상태라 보고하지 않는다', async () => {
    // Given
    const { root, errorReporter } = createRoot([
      failed(new KeychainLockedError(new Error('locked'))),
    ]);

    // When
    await root.openPorts();

    // Then
    expect(errorReporter.captureException).not.toHaveBeenCalled();
  });
});
