import { formatUserHashtag } from './user-hashtag';

describe('formatUserHashtag', () => {
  it('원본 사용자 태그에 해시 기호를 한 번만 붙인다', () => {
    expect(formatUserHashtag('MATT2025')).toBe('#MATT2025');
    expect(formatUserHashtag('#MATT2025')).toBe('#MATT2025');
  });
});
