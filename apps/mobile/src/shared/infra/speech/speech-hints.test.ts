import { getSpeechHints } from './speech-hints';

describe('getSpeechHints', () => {
  test('내 단어를 앞에 두고 겹치는 말은 한 번만 넣는다', () => {
    // Given
    const personalHints = ['기획팀', '분기'];

    // When
    const hints = getSpeechHints('ko-KR', personalHints);

    // Then
    expect(hints.slice(0, 2)).toEqual(['기획팀', '분기']);
    expect(hints.filter((hint) => hint === '분기')).toHaveLength(1);
  });

  test('내 단어가 많아도 Apple 권장 상한 100개를 넘지 않는다', () => {
    // Given
    const personalHints = Array.from({ length: 150 }, (_, index) => `단어${index}`);

    // When
    const hints = getSpeechHints('ko-KR', personalHints);

    // Then
    expect(hints).toHaveLength(100);
  });
});
