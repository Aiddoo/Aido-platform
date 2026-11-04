import { getSpeechContextStrings } from './speech-context';

describe('getSpeechContextStrings', () => {
  it('카테고리 이름을 먼저 두고 중복과 빈 글자를 뺀다', () => {
    // Given
    const source = {
      categoryNames: ['회사', ' 개인 ', ''],
      todoTitles: ['개인', '기획팀 회의', '  '],
    };

    // When
    const strings = getSpeechContextStrings(source);

    // Then
    expect(strings).toEqual(['회사', '개인', '기획팀 회의']);
  });

  it('너무 긴 제목은 힌트로 쓰지 않고 전체는 100개를 넘기지 않는다', () => {
    // Given
    const source = {
      categoryNames: Array.from({ length: 120 }, (_, index) => `카테고리${index}`),
      todoTitles: ['가'.repeat(31)],
    };

    // When
    const strings = getSpeechContextStrings(source);

    // Then
    expect(strings).toHaveLength(100);
    expect(strings).not.toContain('가'.repeat(31));
  });
});
