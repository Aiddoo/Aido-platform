/** 바이트열을 바이트마다 두 자리 소문자 hex로 이어 붙인다 (`[0, 171]` → `"00ab"`). */
export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}
