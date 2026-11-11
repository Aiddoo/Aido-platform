import { createMemoryStorage } from '@src/testing/fakes/memory-storage.fake';
import { type createMMKV, deleteMMKV, existsMMKV } from 'react-native-mmkv';

import { disabledDraftStorage, openEncryptedStorage } from './encrypted-draft-storage';

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
  };
}

describe('openEncryptedStorage', () => {
  beforeEach(() => {
    jest.mocked(existsMMKV).mockReturnValue(false);
    mockCreateMMKV.mockImplementation(() => createFakeMmkv());
  });

  it('처음에는 난수 키를 만들어 보안 저장소에 보관하고 초안·조회 캐시 AES-256 인스턴스를 연다', async () => {
    // Given
    const secureStorage = createMemoryStorage();
    secureStorage.get.mockResolvedValue(null);

    // When
    const result = await openEncryptedStorage(secureStorage);

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
    const secureStorage = createMemoryStorage();
    secureStorage.get.mockResolvedValue('cd'.repeat(16));

    // When
    await openEncryptedStorage(secureStorage);

    // Then
    expect(secureStorage.set).not.toHaveBeenCalled();
    expect(deleteMMKV).not.toHaveBeenCalled();
    expect(mockCreateMMKV).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'aido.query-cache.encrypted', encryptionKey: 'cd'.repeat(16) }),
    );
  });

  it('평문 초안은 암호화 저장소로 옮기고 평문 파일을 삭제한다', async () => {
    // Given
    const secureStorage = createMemoryStorage();
    secureStorage.get.mockResolvedValue('cd'.repeat(16));
    jest.mocked(existsMMKV).mockReturnValue(true);
    mockCreateMMKV.mockImplementation((config) =>
      createFakeMmkv(
        config?.id === 'aido.drafts' ? { 'aido_draft_v1:user-1:memo:create': '{"v":1}' } : {},
      ),
    );

    // When
    const { draftStorage } = await openEncryptedStorage(secureStorage);

    // Then
    expect(draftStorage.get('aido_draft_v1:user-1:memo:create')).toBe('{"v":1}');
    expect(deleteMMKV).toHaveBeenCalledWith('aido.drafts');
  });

  it('키를 읽거나 저장하지 못하면 초안과 조회 캐시 저장을 끄고 사유를 돌려준다', async () => {
    // Given
    const secureStorage = createMemoryStorage();
    const failure = new Error('keychain unavailable');
    secureStorage.get.mockRejectedValue(failure);

    // When
    const result = await openEncryptedStorage(secureStorage);

    // Then
    expect(result).toEqual({
      draftStorage: disabledDraftStorage,
      queryCacheStorage: null,
      failure,
    });
    expect(mockCreateMMKV).not.toHaveBeenCalled();
  });
});
