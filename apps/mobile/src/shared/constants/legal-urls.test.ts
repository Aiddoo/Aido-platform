import { getLegalUrl, type LegalDocument } from './legal-urls';

describe('getLegalUrl', () => {
  it.each<{ document: LegalDocument; language: 'ko' | 'en'; expected: string }>([
    { document: 'terms', language: 'ko', expected: 'https://aido.kr/ko/terms' },
    { document: 'privacy', language: 'ko', expected: 'https://aido.kr/ko/privacy' },
    { document: 'terms', language: 'en', expected: 'https://aido.kr/en/terms' },
    { document: 'privacy', language: 'en', expected: 'https://aido.kr/en/privacy' },
  ])(
    '$language 앱 언어에서 $document 문서는 $expected 로 연결한다',
    ({ document, language, expected }) => {
      // When
      const url = getLegalUrl(document, language);

      // Then
      // 랜딩의 언어별 주소(www 없음)가 나온다
      expect(url).toBe(expected);
    },
  );

  it.each([
    { language: 'ko', expected: 'https://aido.kr/ko/privacy#overseas-transfer' },
    { language: 'en', expected: 'https://aido.kr/en/privacy#overseas-transfer' },
  ] as const)('$language 국외 이전 조항은 $expected 로 바로 연결한다', ({ language, expected }) => {
    // When
    const url = getLegalUrl('privacy', language, 'overseas-transfer');

    // Then
    expect(url).toBe(expected);
  });
});
