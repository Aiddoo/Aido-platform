import {
  createDraftEncryptionKey,
  DRAFT_ENCRYPTION_KEY_BYTE_LENGTH,
  isDraftEncryptionKey,
} from './draft-encryption-key';

describe('createDraftEncryptionKey', () => {
  it('난수 바이트를 MMKV AES-256 키 길이(32바이트)의 hex 문자열로 바꾼다', () => {
    const randomBytes = Uint8Array.from(
      { length: DRAFT_ENCRYPTION_KEY_BYTE_LENGTH },
      (_, index) => index * 17,
    );

    const key = createDraftEncryptionKey(randomBytes);

    expect(key).toBe('00112233445566778899aabbccddeeff');
    expect(isDraftEncryptionKey(key)).toBe(true);
  });
});

describe('isDraftEncryptionKey', () => {
  it.each([null, undefined, 123, '', 'short', 'g'.repeat(32), 'a'.repeat(33)])(
    '%p는 유효한 키가 아니다',
    (value) => {
      expect(isDraftEncryptionKey(value)).toBe(false);
    },
  );
});
