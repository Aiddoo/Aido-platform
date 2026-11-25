import { range } from 'es-toolkit';

import { getPersonalHintWords, type SpeechHint, SpeechHintPolicy } from './speech-hint.model';

describe('getPersonalHintWords', () => {
  it('카테고리 이름을 먼저 두고 중복과 빈 글자를 뺀다', () => {
    // Given
    const source = {
      categoryNames: ['회사', ' 개인 ', ''],
      todoTitles: ['개인', '기획팀 회의', '  '],
    };

    // When
    const strings = getPersonalHintWords(source);

    // Then
    expect(strings).toEqual(['회사', '개인', '기획팀 회의']);
  });

  it('너무 긴 제목은 힌트로 쓰지 않고 전체는 100개를 넘기지 않는다', () => {
    // Given
    const source = {
      categoryNames: range(120).map((index) => `카테고리${index}`),
      todoTitles: ['가'.repeat(31)],
    };

    // When
    const strings = getPersonalHintWords(source);

    // Then
    expect(strings).toHaveLength(100);
    expect(strings).not.toContain('가'.repeat(31));
  });
});

describe('SpeechHintPolicy', () => {
  describe('getHintWords', () => {
    const commonHints = ['분기', '결재'];
    const baseHint: SpeechHint = {
      personalWords: ['기획팀', '민지'],
      commonWords: commonHints,
      isOnDevice: false,
    };

    it('네트워크 인식이면 내 카테고리·할 일 이름은 빼고 흔한 단어만 준다', () => {
      // Given
      const hint = { ...baseHint, isOnDevice: false };

      // When
      const hintWords = SpeechHintPolicy.getHintWords(hint);

      // Then
      expect(hintWords).toEqual(commonHints);
      expect(hintWords).not.toContain('기획팀');
    });

    it('기기 안 인식이면 내 카테고리·할 일 이름을 앞에 두고 겹치는 단어는 한 번만 준다', () => {
      // Given
      const hint = { ...baseHint, isOnDevice: true, personalWords: ['기획팀', '분기'] };

      // When
      const hintWords = SpeechHintPolicy.getHintWords(hint);

      // Then
      expect(hintWords.slice(0, 2)).toEqual(['기획팀', '분기']);
      expect(hintWords.filter((hintWord) => hintWord === '분기')).toHaveLength(1);
    });
  });
});
