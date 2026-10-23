export const DRAFT_ENCRYPTION_KEY_BYTE_LENGTH = 16;

/** MMKV AES-256 키는 32바이트이므로 16바이트(128비트) 난수를 hex 32자로 표현한다. */
export function createDraftEncryptionKey(randomBytes: Uint8Array) {
  return Array.from(randomBytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function isDraftEncryptionKey(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{32}$/.test(value);
}
