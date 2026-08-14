import { KeychainLockedError } from '@src/shared/errors';
import * as ExpoSecureStore from 'expo-secure-store';

import { SecureStorage } from './secure-storage';

// 네이티브 모듈 경계 — 여기서만 jest.mock을 쓴다.
jest.mock('expo-secure-store', () => ({
  AFTER_FIRST_UNLOCK: 'afterFirstUnlock',
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

const getItemAsync = ExpoSecureStore.getItemAsync as jest.MockedFunction<
  typeof ExpoSecureStore.getItemAsync
>;

describe('SecureStorage — 벤더 에러 분류', () => {
  let storage: SecureStorage;

  beforeEach(() => {
    jest.clearAllMocks();
    storage = new SecureStorage();
  });

  it('값이 있으면 파싱해서 돌려준다', async () => {
    // Given
    getItemAsync.mockResolvedValue(JSON.stringify('token-value'));

    // When & Then
    await expect(storage.get<string>('key')).resolves.toBe('token-value');
  });

  it('항목이 없으면 null을 돌려준다', async () => {
    // Given — errSecItemNotFound는 throw가 아니라 null이다
    getItemAsync.mockResolvedValue(null);

    // When & Then
    await expect(storage.get('key')).resolves.toBeNull();
  });

  it('기기 잠금 오류는 KeychainLockedError로 승격한다', async () => {
    // Given — iOS errSecInteractionNotAllowed. expo-secure-store는 OSStatus를 메시지로만 노출한다.
    getItemAsync.mockRejectedValue(new Error('User interaction is not allowed.'));

    // When & Then — "지금 못 읽는다"는 "토큰이 없다"와 다르다
    await expect(storage.get('key')).rejects.toBeInstanceOf(KeychainLockedError);
  });

  it('Error가 아닌 값으로 던져져도 잠금을 판별한다', async () => {
    // Given — RN 네이티브 브릿지가 { message } 객체를 던지는 경우.
    // instanceof Error를 관문으로 두면 판별에 실패해 잠긴 키체인이 곧 로그아웃이 된다.
    getItemAsync.mockRejectedValue({ message: 'User interaction is not allowed.' });

    // When & Then
    await expect(storage.get('key')).rejects.toBeInstanceOf(KeychainLockedError);
  });

  it('잠금 오류를 승격할 때 원본을 cause로 보존한다', async () => {
    // Given
    const original = new Error('User interaction is not allowed.');
    getItemAsync.mockRejectedValue(original);

    // When
    const error = await storage.get('key').catch((caught: unknown) => caught);

    // Then — 관측 시 원본 OSStatus 메시지를 잃지 않는다
    expect((error as KeychainLockedError).cause).toBe(original);
  });

  it.each([
    ['Android 키체인 손상', 'Could not decrypt the value for key'],
    ['알 수 없는 encoding scheme', 'has an unknown encoding scheme'],
    ['entitlement 오설정', 'A required entitlement is not present.'],
    ['키스토어 접근 실패', 'An error occurred when accessing the keystore'],
  ])('영구 오류(%s)는 잠김으로 뭉개지 않고 원본을 그대로 던진다', async (_label, message) => {
    // Given — 이걸 locked로 승격하면 재판정도 계속 실패해 앱이 조용히 무한 로딩에 갇힌다
    const original = new Error(message);
    getItemAsync.mockRejectedValue(original);

    // When & Then
    await expect(storage.get('key')).rejects.toBe(original);
    await expect(storage.get('key')).rejects.not.toBeInstanceOf(KeychainLockedError);
  });

  it('저장된 값이 손상돼 파싱에 실패하면 null로 취급한다 (throw하지 않는다)', async () => {
    // Given — 손상된 항목 하나가 부팅을 막아선 안 된다
    getItemAsync.mockResolvedValue('{not-json');

    // When & Then
    await expect(storage.get('key')).resolves.toBeNull();
  });
});
