import { createTranscript } from '../__tests__/voice.factories';
import { VoiceTranscriptPolicy } from './voice-transcript.model';

describe('VoiceTranscriptPolicy', () => {
  describe('Android처럼 문장마다 final이 올 때', () => {
    it('final은 문장으로 쌓고 다음 interim은 꼬리로 보여준다', () => {
      // Given
      let transcript = createTranscript();

      // When
      transcript = VoiceTranscriptPolicy.applyResult(transcript, {
        transcript: '매일 아침 8시에 영양제',
        isFinal: true,
      });
      transcript = VoiceTranscriptPolicy.applyResult(transcript, {
        transcript: '월수금',
        isFinal: false,
      });

      // Then
      expect(VoiceTranscriptPolicy.getFinalText(transcript)).toBe('매일 아침 8시에 영양제');
      expect(VoiceTranscriptPolicy.getInterimText(transcript)).toBe('월수금');
      expect(VoiceTranscriptPolicy.getTranscriptText(transcript)).toBe(
        '매일 아침 8시에 영양제 월수금',
      );
    });
  });

  describe('iOS처럼 interim이 누적될 때', () => {
    it('interim은 꼬리를 통째로 바꾸고 마지막 final 하나로 확정한다', () => {
      // Given
      let transcript = createTranscript();

      // When
      for (const text of ['내일', '내일 회의', '내일 회의 준비']) {
        transcript = VoiceTranscriptPolicy.applyResult(transcript, {
          transcript: text,
          isFinal: false,
        });
      }
      transcript = VoiceTranscriptPolicy.applyResult(transcript, {
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
    const result = VoiceTranscriptPolicy.appendFinalResult(transcript, ' 장보기 ');

    // Then
    expect(result.sentences).toEqual(['장보기']);
  });

  it('빈 final은 꼬리만 비우고 문장을 늘리지 않는다', () => {
    // Given
    const transcript = createTranscript({ sentences: ['장보기'], interim: '우유' });

    // When
    const result = VoiceTranscriptPolicy.appendFinalResult(transcript, '  ');

    // Then
    expect(result).toEqual({ sentences: ['장보기'], interim: '' });
  });

  it('멈출 때 남은 꼬리를 문장으로 확정해 잃지 않는다', () => {
    // Given
    const transcript = createTranscript({ sentences: ['장보기'], interim: '우유 계란' });

    // When
    const result = VoiceTranscriptPolicy.withInterimFinalized(transcript);

    // Then
    expect(result.sentences).toEqual(['장보기', '우유 계란']);
  });

  it('글자가 없으면 비어 있다고 판단한다', () => {
    // When
    const isEmpty = VoiceTranscriptPolicy.isTranscriptEmpty(createTranscript());

    // Then
    expect(isEmpty).toBe(true);
  });
});
