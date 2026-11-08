import { toHex } from './to-hex';

describe('toHex', () => {
  it('바이트마다 두 자리 소문자 hex로 이어 붙인다', () => {
    // When
    const hex = toHex(new Uint8Array([0, 9, 171, 255]));

    // Then
    expect(hex).toBe('0009abff');
  });
});
