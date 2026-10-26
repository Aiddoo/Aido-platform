import { type LegalDocument, legalUrl } from './legal-urls';

describe('legalUrl', () => {
  it.each<{ document: LegalDocument; language: 'ko' | 'en'; expected: string }>([
    { document: 'terms', language: 'ko', expected: 'https://aido.kr/ko/terms' },
    { document: 'privacy', language: 'ko', expected: 'https://aido.kr/ko/privacy' },
    { document: 'terms', language: 'en', expected: 'https://aido.kr/en/terms' },
    { document: 'privacy', language: 'en', expected: 'https://aido.kr/en/privacy' },
  ])(
    '$language 앱 언어에서 $document 문서는 $expected 로 연결한다',
    ({ document, language, expected }) => {
      // Given: 앱 언어와 열려는 문서
      // When: 주소를 만들면
      const url = legalUrl(document, language);

      // Then: 랜딩의 언어별 주소(www 없음)가 나온다
      expect(url).toBe(expected);
    },
  );
});
