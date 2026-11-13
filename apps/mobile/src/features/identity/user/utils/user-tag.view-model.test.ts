import { formatUserHashtag } from './user-tag.view-model';

describe('formatUserHashtag', () => {
  it('원본 사용자 태그에 해시 기호를 한 번만 붙인다', () => {
    // When
    const fromRaw = formatUserHashtag('MATT2025');
    const fromHashtagged = formatUserHashtag('#MATT2025');

    // Then
    expect(fromRaw).toBe('#MATT2025');
    expect(fromHashtagged).toBe('#MATT2025');
  });
});
