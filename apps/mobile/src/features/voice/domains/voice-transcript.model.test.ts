import { createTranscript } from '../__tests__/voice.fixtures';
import { createVoiceTranscript, VoiceTranscriptPolicy } from './voice-transcript.model';

describe('applyResult', () => {
  it('Android처럼 문장마다 final이 오면 문장으로 쌓고 다음 interim은 꼬리로 보여준다', () => {
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
    expect(transcript.interim).toBe('월수금');
    expect(VoiceTranscriptPolicy.getTranscriptText(transcript)).toBe(
      '매일 아침 8시에 영양제 월수금',
    );
  });

  it('iOS처럼 interim이 누적되면 꼬리를 통째로 바꾸고 마지막 final 하나로 확정한다', () => {
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

describe('appendFinalResult', () => {
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
});

describe('withInterimFinalized', () => {
  it('멈출 때 남은 꼬리를 문장으로 확정해 잃지 않는다', () => {
    // Given
    const transcript = createTranscript({ sentences: ['장보기'], interim: '우유 계란' });

    // When
    const result = VoiceTranscriptPolicy.withInterimFinalized(transcript);

    // Then
    expect(result.sentences).toEqual(['장보기', '우유 계란']);
  });
});

describe('isTranscriptEmpty', () => {
  it('글자가 없으면 비어 있다고 판단한다', () => {
    // When
    const isEmpty = VoiceTranscriptPolicy.isTranscriptEmpty(createTranscript());

    // Then
    expect(isEmpty).toBe(true);
  });
});

describe('getLowConfidenceWords', () => {
  const segment = (text: string, confidence: number) => ({
    text,
    startMs: 0,
    endMs: 1,
    confidence,
  });

  it('기준보다 낮은 단어만 고른다', () => {
    // Given
    const segments = [segment('높음', 0.9), segment('낮음', 0.2), segment('경계', 0.5)];

    // When
    const words = VoiceTranscriptPolicy.getLowConfidenceWords(segments);

    // Then
    expect(words).toEqual(['낮음']);
  });

  it.each([-1, 0])('신뢰도 %d은 값이 없는 것이라 고르지 않는다', (confidence) => {
    // Given
    const segments = [segment('단어', confidence)];

    // When
    const words = VoiceTranscriptPolicy.getLowConfidenceWords(segments);

    // Then
    expect(words).toEqual([]);
  });
});

describe('mergeHeardTextIntoTitle', () => {
  it.each([
    ['칸이 비었으면 들은 글자', '', '치과 가기', '치과 가기'],
    ['칸이 공백뿐이면 들은 글자', '   ', '치과 가기', '치과 가기'],
    ['친 글자가 있으면 그 뒤에 공백으로', '장보기', '치과 가기', '장보기 치과 가기'],
    ['친 글자 끝의 공백은 겹치지 않게', '장보기  ', ' 치과 가기 ', '장보기 치과 가기'],
    ['들은 글자가 비었으면 그대로', '장보기 ', '', '장보기 '],
    ['들은 글자가 공백뿐이면 그대로', '장보기', '  ', '장보기'],
    ['둘 다 비었으면 그대로', '', '', ''],
    ['이미 옮긴 글자와 같으면 그대로', '치과 가기', '치과 가기', '치과 가기'],
    ['칸에 이미 들어 있으면 그대로', '장보기 치과 가기', '치과 가기', '장보기 치과 가기'],
    [
      '옮긴 뒤 이어 말해 늘어났으면 늘어난 글자로',
      '치과 가기',
      '치과 가기 약국 가기',
      '치과 가기 약국 가기',
    ],
  ])('%s', (_name, title, heardText, expected) => {
    // Given
    const transcript = createVoiceTranscript({ interim: heardText });

    // When
    const merged = VoiceTranscriptPolicy.mergeHeardTextIntoTitle(transcript, title);

    // Then
    expect(merged).toBe(expected);
  });

  it('확정된 문장과 듣던 글자를 이어 붙인 글자를 합친다', () => {
    // Given
    const transcript = createVoiceTranscript({
      sentences: ['치과 가기'],
      interim: '약국 가기',
    });

    // When
    const merged = VoiceTranscriptPolicy.mergeHeardTextIntoTitle(transcript, '장보기');

    // Then
    expect(merged).toBe('장보기 치과 가기 약국 가기');
  });
});
