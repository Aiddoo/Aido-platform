import { getEmailDomainSuggestions } from './get-email-domain-suggestions';

describe('getEmailDomainSuggestions', () => {
  it('@를 입력하기 전이나 아이디가 없으면 추천을 표시하지 않는다', () => {
    // Given
    const inputs = ['', 'matthew', '@g'];

    // When
    const suggestions = inputs.map(getEmailDomainSuggestions);

    // Then
    expect(suggestions).toEqual([[], [], []]);
  });

  it('대문자로 입력한 도메인도 대소문자 없이 추천하고 아이디는 보존한다', () => {
    // Given
    const email = 'Matthew@G';

    // When
    const suggestions = getEmailDomainSuggestions(email);

    // Then
    expect(suggestions).toEqual([{ domain: 'gmail.com', value: 'Matthew@gmail.com' }]);
  });

  it('완성된 도메인에는 추천을 표시하지 않는다', () => {
    // Given
    const email = 'matthew@GMAIL.COM';

    // When
    const suggestions = getEmailDomainSuggestions(email);

    // Then
    expect(suggestions).toEqual([]);
  });

  it('도메인을 아직 입력하지 않았으면 최대 세 개를 추천한다', () => {
    // Given
    const email = 'matthew@';

    // When
    const suggestions = getEmailDomainSuggestions(email);

    // Then
    expect(suggestions).toEqual([
      { domain: 'gmail.com', value: 'matthew@gmail.com' },
      { domain: 'naver.com', value: 'matthew@naver.com' },
      { domain: 'daum.net', value: 'matthew@daum.net' },
    ]);
  });
});
