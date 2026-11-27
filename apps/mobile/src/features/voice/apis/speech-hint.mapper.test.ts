import type { SpeechStartOptions } from '@src/core/ports/speech-recognizer';

import { toSpeechStartOptions } from './speech-hint.mapper';

describe('toSpeechStartOptions', () => {
  const commonWords = ['분기', '결재'];
  const baseOptions: SpeechStartOptions = {
    locale: 'ko-KR',
    mode: 'note',
    hintWords: [],
    isOnDevice: false,
    recordingDirectory: 'file:///documents/voice-notes/user-1',
  };

  it.each([
    {
      scenario: '서버 인식에 개인 단어가 있으면 개인 단어를 빼고',
      isOnDevice: false,
      hintWords: ['기획팀', '분기'],
      expected: ['분기', '결재'],
    },
    {
      scenario: '서버 인식에 개인 단어가 없으면',
      isOnDevice: false,
      hintWords: [],
      expected: ['분기', '결재'],
    },
    {
      scenario: '기기 안 인식에 개인 단어가 있으면 개인 단어를 앞에 두고 겹침 없이',
      isOnDevice: true,
      hintWords: ['기획팀', '분기'],
      expected: ['기획팀', '분기', '결재'],
    },
    {
      scenario: '기기 안 인식에 개인 단어가 없으면',
      isOnDevice: true,
      hintWords: [],
      expected: ['분기', '결재'],
    },
  ])(
    '$scenario 흔한 단어를 주고 나머지 옵션은 그대로 싣는다',
    ({ isOnDevice, hintWords, expected }) => {
      // Given
      const options = { ...baseOptions, isOnDevice, hintWords };

      // When
      const result = toSpeechStartOptions(options, commonWords);

      // Then
      expect(result).toEqual({ ...options, hintWords: expected });
    },
  );
});
