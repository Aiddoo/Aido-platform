import { createTranscript } from '../__tests__/voice.factories';
import {
  appendFinalResult,
  applyResult,
  getFinalText,
  getInterimText,
  getLowConfidenceWords,
  getTranscriptText,
  isTranscriptEmpty,
  withInterimFinalized,
} from './voice-transcript.model';

describe('voice-transcript.model', () => {
  describe('Android처럼 문장마다 final이 올 때', () => {
    it('final은 문장으로 쌓고 다음 interim은 꼬리로 보여준다', () => {
      // Given
      let transcript = createTranscript();

      // When
      transcript = applyResult(transcript, {
        transcript: '매일 아침 8시에 영양제',
        isFinal: true,
      });
      transcript = applyResult(transcript, {
        transcript: '월수금',
        isFinal: false,
      });

      // Then
      expect(getFinalText(transcript)).toBe('매일 아침 8시에 영양제');
      expect(getInterimText(transcript)).toBe('월수금');
      expect(getTranscriptText(transcript)).toBe('매일 아침 8시에 영양제 월수금');
    });
  });

  describe('iOS처럼 interim이 누적될 때', () => {
    it('interim은 꼬리를 통째로 바꾸고 마지막 final 하나로 확정한다', () => {
      // Given
      let transcript = createTranscript();

      // When
      for (const text of ['내일', '내일 회의', '내일 회의 준비']) {
        transcript = applyResult(transcript, {
          transcript: text,
          isFinal: false,
        });
      }
      transcript = applyResult(transcript, {
        transcript: '내일 회의 준비',
        isFinal: true,
      });

      // Then
      expect(transcript.sentences).toEqual(['내일 회의 준비']);
      expect(transcript.interim).toBe('');
    });
  });

  it('같은 문장이 final로 두 번 오면 한 번만 쌓는다', () => {
    // Given
    const transcript = createTranscript({ sentences: ['장보기'] });

    // When
    const result = appendFinalResult(transcript, ' 장보기 ');

    // Then
    expect(result.sentences).toEqual(['장보기']);
  });

  it('빈 final은 꼬리만 비우고 문장을 늘리지 않는다', () => {
    // Given
    const transcript = createTranscript({ sentences: ['장보기'], interim: '우유' });

    // When
    const result = appendFinalResult(transcript, '  ');

    // Then
    expect(result).toEqual({ sentences: ['장보기'], interim: '' });
  });

  it('멈출 때 남은 꼬리를 문장으로 확정해 잃지 않는다', () => {
    // Given
    const transcript = createTranscript({ sentences: ['장보기'], interim: '우유 계란' });

    // When
    const result = withInterimFinalized(transcript);

    // Then
    expect(result.sentences).toEqual(['장보기', '우유 계란']);
  });

  it('글자가 없으면 비어 있다고 판단한다', () => {
    // When
    const isEmpty = isTranscriptEmpty(createTranscript());

    // Then
    expect(isEmpty).toBe(true);
  });

  describe('getLowConfidenceWords', () => {
    const segment = (text: string, confidence: number) => ({
      text,
      startMs: 0,
      endMs: 1,
      confidence,
    });

    test('기준보다 낮은 단어만 고른다', () => {
      // Given
      const segments = [segment('높음', 0.9), segment('낮음', 0.2), segment('경계', 0.5)];

      // When
      const words = getLowConfidenceWords(segments);

      // Then
      expect(words).toEqual(['낮음']);
    });

    test.each([-1, 0])('신뢰도 %d은 값이 없는 것이라 고르지 않는다', (confidence) => {
      // Given
      const segments = [segment('단어', confidence)];

      // When
      const words = getLowConfidenceWords(segments);

      // Then
      expect(words).toEqual([]);
    });
  });
});
