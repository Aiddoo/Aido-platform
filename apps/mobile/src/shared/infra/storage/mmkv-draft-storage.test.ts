import { createMockStorage } from '@src/shared/__tests__';
import { createMMKV, deleteMMKV, existsMMKV } from 'react-native-mmkv';

import { disabledDraftStorage, openMmkvDraftStorage } from './mmkv-draft-storage';

jest.mock('react-native-mmkv', () => ({
  createMMKV: jest.fn(),
  deleteMMKV: jest.fn(),
  existsMMKV: jest.fn(),
}));

jest.mock('expo-crypto', () => ({
  getRandomBytes: (length: number) => new Uint8Array(length).fill(171),
}));

const GENERATED_KEY = 'ab'.repeat(16);

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

describe('openMmkvDraftStorage', () => {
  beforeEach(() => {
    jest.mocked(existsMMKV).mockReturnValue(false);
    jest.mocked(createMMKV).mockImplementation(() => createFakeMmkv() as never);
  });

  it('처음에는 난수 키를 만들어 보안 저장소에 보관하고 AES-256 인스턴스를 연다', async () => {
    const secureStorage = createMockStorage();
    secureStorage.get.mockResolvedValue(null);

    const result = await openMmkvDraftStorage(secureStorage);

    expect(result.failure).toBeUndefined();
    expect(secureStorage.set).toHaveBeenCalledWith('aido_draft_encryption_key', GENERATED_KEY);
    expect(deleteMMKV).toHaveBeenCalledWith('aido.drafts.encrypted');
    expect(createMMKV).toHaveBeenCalledWith({
      id: 'aido.drafts.encrypted',
      encryptionKey: GENERATED_KEY,
      encryptionType: 'AES-256',
    });
  });

  it('보관된 키가 있으면 그대로 쓰고 기존 암호화 파일을 지우지 않는다', async () => {
    const secureStorage = createMockStorage();
    secureStorage.get.mockResolvedValue('cd'.repeat(16));

    await openMmkvDraftStorage(secureStorage);

    expect(secureStorage.set).not.toHaveBeenCalled();
    expect(deleteMMKV).not.toHaveBeenCalled();
    expect(createMMKV).toHaveBeenCalledWith(
      expect.objectContaining({ encryptionKey: 'cd'.repeat(16) }),
    );
  });

  it('평문 초안은 암호화 저장소로 옮기고 평문 파일을 삭제한다', async () => {
    const secureStorage = createMockStorage();
    secureStorage.get.mockResolvedValue('cd'.repeat(16));
    jest.mocked(existsMMKV).mockReturnValue(true);
    jest
      .mocked(createMMKV)
      .mockImplementation(
        (config) =>
          createFakeMmkv(
            config?.id === 'aido.drafts' ? { 'aido_draft_v1:user-1:memo:create': '{"v":1}' } : {},
          ) as never,
      );

    const { storage } = await openMmkvDraftStorage(secureStorage);

    expect(storage.getString('aido_draft_v1:user-1:memo:create')).toBe('{"v":1}');
    expect(deleteMMKV).toHaveBeenCalledWith('aido.drafts');
  });

  it('키를 읽거나 저장하지 못하면 초안 기능만 끄고 사유를 돌려준다', async () => {
    const secureStorage = createMockStorage();
    const failure = new Error('keychain unavailable');
    secureStorage.get.mockRejectedValue(failure);

    const result = await openMmkvDraftStorage(secureStorage);

    expect(result).toEqual({ storage: disabledDraftStorage, failure });
    expect(result.storage.getAllKeys()).toEqual([]);
  });
});
