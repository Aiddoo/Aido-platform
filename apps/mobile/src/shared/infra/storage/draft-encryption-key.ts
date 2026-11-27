import { toHex } from '@src/shared/utils/to-hex';

export const DRAFT_ENCRYPTION_KEY_BYTE_LENGTH = 16;
const HEX_CHARS_PER_BYTE = 2;
const DRAFT_ENCRYPTION_KEY_PATTERN = new RegExp(
  `^[0-9a-f]{${DRAFT_ENCRYPTION_KEY_BYTE_LENGTH * HEX_CHARS_PER_BYTE}}$`,
);

/** MMKV AES-256 키는 32바이트이므로 16바이트(128비트) 난수를 hex 32자로 표현한다. */
export function createDraftEncryptionKey(randomBytes: Uint8Array) {
  return toHex(randomBytes);
}

export function isDraftEncryptionKey(value: unknown): value is string {
  return typeof value === 'string' && DRAFT_ENCRYPTION_KEY_PATTERN.test(value);
}
