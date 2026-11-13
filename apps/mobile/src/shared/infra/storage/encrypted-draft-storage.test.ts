import { createMemoryKeyValueStorage } from '@src/testing/fakes/memory-key-value-storage.fake';
import { type createMMKV, deleteMMKV, existsMMKV } from 'react-native-mmkv';

import { openEncryptedStorage } from './encrypted-draft-storage';

type MmkvConfig = Parameters<typeof createMMKV>[0];

const mockCreateMMKV = jest.fn<FakeMmkv, [MmkvConfig]>();

// 모듈 mock은 실제 MMKV 타입을 요구하지 않으므로 어댑터가 쓰는 메서드만 가진 fake를 돌려준다.
jest.mock('react-native-mmkv', () => ({
  createMMKV: (config: MmkvConfig) => mockCreateMMKV(config),
  deleteMMKV: jest.fn(),
  existsMMKV: jest.fn(),
}));

jest.mock('expo-crypto', () => ({
  getRandomBytes: (length: number) => new Uint8Array(length).fill(171),
}));

const GENERATED_KEY = 'ab'.repeat(16);

type FakeMmkv = ReturnType<typeof createFakeMmkv>;

function createFakeMmkv(entries: Record<string, string> = {}) {
  const values = new Map(Object.entries(entries));

  return {
    getString: (key: string) => values.get(key),
    set: (key: string, value: string) => values.set(key, value),
    remove: (key: string) => values.delete(key),
    getAllKeys: () => [...values.keys()],
    clearAll: () => values.clear(),
    trim: jest.fn(),
  };
}

describe('openEncryptedStorage', () => {
  beforeEach(() => {
    jest.mocked(existsMMKV).mockReturnValue(false);
    mockCreateMMKV.mockImplementation(() => createFakeMmkv());
  });

  it('처음에는 난수 키를 만들어 보안 저장소에 보관하고 초안·조회 캐시 AES-256 인스턴스를 연다', async () => {
    // Given
    const secureStorage = createMemoryKeyValueStorage();
    secureStorage.get.mockResolvedValue(null);

    // When
    const result = await openEncryptedStorage(secureStorage, null);

    // Then
    expect(result.failure).toBeUndefined();
    expect(result.queryCacheStorage).not.toBeNull();
    expect(secureStorage.set).toHaveBeenCalledWith('aido_draft_encryption_key', GENERATED_KEY);
    expect(deleteMMKV).toHaveBeenCalledWith('aido.drafts.encrypted');
    expect(deleteMMKV).toHaveBeenCalledWith('aido.query-cache.encrypted');
    for (const id of ['aido.drafts.encrypted', 'aido.query-cache.encrypted']) {
      expect(mockCreateMMKV).toHaveBeenCalledWith({
        id,
        encryptionKey: GENERATED_KEY,
        encryptionType: 'AES-256',
      });
    }
  });

  it('보관된 키가 있으면 그대로 쓰고 기존 암호화 파일을 지우지 않는다', async () => {
    // Given
    const secureStorage = createMemoryKeyValueStorage();
    secureStorage.get.mockResolvedValue('cd'.repeat(16));

    // When
    await openEncryptedStorage(secureStorage, null);

    // Then
    expect(secureStorage.set).not.toHaveBeenCalled();
    expect(deleteMMKV).not.toHaveBeenCalled();
    expect(mockCreateMMKV).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'aido.query-cache.encrypted', encryptionKey: 'cd'.repeat(16) }),
    );
  });

  it('평문 초안은 암호화 저장소로 옮기고 평문 파일을 삭제한다', async () => {
    // Given
    const secureStorage = createMemoryKeyValueStorage();
    secureStorage.get.mockResolvedValue('cd'.repeat(16));
    jest.mocked(existsMMKV).mockReturnValue(true);
    mockCreateMMKV.mockImplementation((config) =>
      createFakeMmkv(
        config?.id === 'aido.drafts' ? { 'aido_draft_v1:user-1:memo:create': '{"v":1}' } : {},
      ),
    );

    // When
    const { draftStorage } = await openEncryptedStorage(secureStorage, null);

    // Then
    expect(draftStorage.get('aido_draft_v1:user-1:memo:create')).toBe('{"v":1}');
    expect(deleteMMKV).toHaveBeenCalledWith('aido.drafts');
  });

  it('키를 읽거나 저장하지 못하면 초안은 이번 실행 동안 메모리에만 두고 조회 캐시는 남기지 않는다', async () => {
    // Given
    const secureStorage = createMemoryKeyValueStorage();
    const failure = new Error('keychain unavailable');
    secureStorage.get.mockRejectedValue(failure);
    const result = await openEncryptedStorage(secureStorage, null);
    const listener = jest.fn();
    result.draftStorage.subscribe('aido_draft_v1:user-1:memo:create', listener);

    // When
    result.draftStorage.set('aido_draft_v1:user-1:memo:create', '{"v":1}');

    // Then
    expect(result.draftStorage.get('aido_draft_v1:user-1:memo:create')).toBe('{"v":1}');
    expect(listener).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ queryCacheStorage: null, failure });
    expect(mockCreateMMKV).not.toHaveBeenCalled();
  });

  it.each([
    [
      '로그아웃',
      { queryCache: true, drafts: true },
      ['aido.drafts.encrypted', 'aido.query-cache.encrypted'],
    ],
    ['세션 만료', { queryCache: true, drafts: false }, ['aido.query-cache.encrypted']],
  ])(
    '저장소를 열지 못한 실행의 %s 뒤 다시 열면 그 세션 값을 열기 전에 인스턴스째 지운다',
    async (_reason, discarded, deletedIds) => {
      // Given
      const secureStorage = createMemoryKeyValueStorage();
      secureStorage.get.mockResolvedValue('cd'.repeat(16));

      // When
      await openEncryptedStorage(secureStorage, discarded);

      // Then
      expect(jest.mocked(deleteMMKV).mock.calls).toEqual(deletedIds.map((id) => [id]));
      const firstOpenOrder = mockCreateMMKV.mock.invocationCallOrder[0] ?? 0;
      for (const order of jest.mocked(deleteMMKV).mock.invocationCallOrder) {
        expect(order).toBeLessThan(firstOpenOrder);
      }
    },
  );

  it('비우면 값을 모두 지우고 파일을 줄여 지운 값이 디스크에 남지 않는다', async () => {
    // Given
    const secureStorage = createMemoryKeyValueStorage();
    secureStorage.get.mockResolvedValue('cd'.repeat(16));
    const instances: FakeMmkv[] = [];
    mockCreateMMKV.mockImplementation(() => {
      const instance = createFakeMmkv({ 'aido.query-cache:user-1': '{}' });
      instances.push(instance);
      return instance;
    });
    const { queryCacheStorage } = await openEncryptedStorage(secureStorage, null);

    // When
    queryCacheStorage?.clear();

    // Then
    const queryCacheInstance = instances.at(-1);
    expect(queryCacheInstance?.getAllKeys()).toEqual([]);
    expect(queryCacheInstance?.trim).toHaveBeenCalledTimes(1);
  });
});
