import type { SpeechStartOptions } from '@src/core/ports/speech-recognizer';
import { range } from 'es-toolkit';

import { COMMON_SPEECH_HINTS } from '../constants/speech-hints';
import { getRecognizerStartOptions, getSpeechContextStrings } from './speech-context';

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
      categoryNames: range(120).map((index) => `카테고리${index}`),
      todoTitles: ['가'.repeat(31)],
    };

    // When
    const strings = getSpeechContextStrings(source);

    // Then
    expect(strings).toHaveLength(100);
    expect(strings).not.toContain('가'.repeat(31));
  });
});

describe('getRecognizerStartOptions', () => {
  const baseOptions: SpeechStartOptions = {
    locale: 'ko-KR',
    mode: 'quick',
    hintWords: ['기획팀', '민지'],
    isOnDevice: false,
    recordingDirectory: null,
  };

  it('네트워크 인식이면 내 카테고리·할 일 이름은 빼고 흔한 단어만 준다', () => {
    // Given
    const options = { ...baseOptions, isOnDevice: false };

    // When
    const result = getRecognizerStartOptions(options);

    // Then
    expect(result.hintWords).toEqual(COMMON_SPEECH_HINTS['ko-KR']);
    expect(result.hintWords).not.toContain('기획팀');
  });

  it('기기 안 인식이면 내 카테고리·할 일 이름을 앞에 두고 겹치는 단어는 한 번만 준다', () => {
    // Given
    const options = { ...baseOptions, isOnDevice: true, hintWords: ['기획팀', '분기'] };

    // When
    const result = getRecognizerStartOptions(options);

    // Then
    expect(result.hintWords.slice(0, 2)).toEqual(['기획팀', '분기']);
    expect(result.hintWords.filter((hint) => hint === '분기')).toHaveLength(1);
  });
});
