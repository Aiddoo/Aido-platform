import { toInstant } from '@src/shared/date/instant';

import {
  VoiceNoteCaptionPolicy,
  createVoiceNoteCaptions,
  createTranscribedVoiceNote,
} from './voice-note-caption.model';

const clock = (nowMs: number, segmentStartMs = 0) => ({ nowMs, segmentStartMs });
const interim = (transcript: string) => ({ transcript, isFinal: false, segments: [] });
const final = (
  transcript: string,
  segments: { text: string; startMs: number; endMs: number; confidence: number }[] = [],
) => ({ transcript, isFinal: true, segments });

describe('applyCaptionResult', () => {
  it('Android처럼 문장마다 final이 오면 문장을 차례로 쌓는다', () => {
    // Given
    const heard = VoiceNoteCaptionPolicy.applyCaptionResult(
      createVoiceNoteCaptions(),
      interim('첫 문장'),
      clock(1_000),
    );

    // When
    const first = VoiceNoteCaptionPolicy.applyCaptionResult(heard, final('첫 문장.'), clock(3_000));
    const second = VoiceNoteCaptionPolicy.applyCaptionResult(
      first,
      final('둘째 문장.'),
      clock(6_000),
    );

    // Then
    expect(
      VoiceNoteCaptionPolicy.getCaptionSentences(second, 6_000).map(({ text }) => text),
    ).toEqual(['첫 문장.', '둘째 문장.']);
    expect(VoiceNoteCaptionPolicy.getCaptionSentences(second, 6_000)[0]).toMatchObject({
      startMs: 1_000,
      endMs: 3_000,
    });
  });

  it('iOS처럼 interim만 쌓여도 앞 문장은 카드가 되고 마지막만 인식 중으로 남는다', () => {
    // Given
    const captions = createVoiceNoteCaptions();

    // When
    const heard = VoiceNoteCaptionPolicy.applyCaptionResult(
      VoiceNoteCaptionPolicy.applyCaptionResult(captions, interim('첫 문장.'), clock(1_000)),
      interim('첫 문장. 둘째 문장'),
      clock(4_000),
    );

    // Then
    expect(heard.provisional).toEqual([
      { text: '첫 문장.', startMs: 1_000 },
      { text: '둘째 문장', startMs: 4_000 },
    ]);
    expect(VoiceNoteCaptionPolicy.getCaptionInterimText(heard)).toBe('둘째 문장');
  });

  it('final이 나오기 전에 저장해도 인식 중인 글자까지 남는다', () => {
    // Given
    const heard = VoiceNoteCaptionPolicy.applyCaptionResult(
      createVoiceNoteCaptions(),
      interim('아직 확정 안 된 말'),
      clock(1_000),
    );

    // When
    const sentences = VoiceNoteCaptionPolicy.getCaptionSentences(heard, 5_000);

    // Then
    expect(sentences).toEqual([
      {
        text: '아직 확정 안 된 말',
        startMs: 1_000,
        endMs: 5_000,
        isBookmarked: false,
        lowConfidenceWords: [],
      },
    ]);
  });

  it('interim이 처음부터 다시 쌓이면 앞 글자를 확정해 잃지 않는다', () => {
    // Given
    const long = '오늘 회의에서 정한 내용을 길게 말하고 있어요';
    const heard = VoiceNoteCaptionPolicy.applyCaptionResult(
      createVoiceNoteCaptions(),
      interim(long),
      clock(1_000),
    );

    // When
    const restarted = VoiceNoteCaptionPolicy.applyCaptionResult(
      heard,
      interim('새 말'),
      clock(9_000),
    );

    // Then
    expect(restarted.sentences.map(({ text }) => text)).toEqual([long]);
    expect(VoiceNoteCaptionPolicy.getCaptionInterimText(restarted)).toBe('새 말');
  });

  it('단어 구간이 있으면 구간 시작 시각을 더해 문장 시각을 찾는다', () => {
    // Given
    const captions = createVoiceNoteCaptions();

    // When
    const next = VoiceNoteCaptionPolicy.applyCaptionResult(
      captions,
      final('첫 문장. 둘째 문장.', [
        { text: '첫', startMs: 100, endMs: 200, confidence: 1 },
        { text: '문장.', startMs: 300, endMs: 500, confidence: 1 },
        { text: '둘째', startMs: 2_000, endMs: 2_200, confidence: 1 },
        { text: '문장.', startMs: 2_300, endMs: 2_500, confidence: 1 },
      ]),
      clock(63_000, 60_000),
    );

    // Then
    expect(next.sentences.map(({ startMs }) => startMs)).toEqual([60_100, 62_000]);
  });

  it('끝난 뒤 같은 문장을 다시 줘도 한 번만 남긴다', () => {
    // Given
    const heard = VoiceNoteCaptionPolicy.applyCaptionResult(
      createVoiceNoteCaptions(),
      final('같은 문장.'),
      clock(1_000),
    );

    // When
    const next = VoiceNoteCaptionPolicy.applyCaptionResult(
      heard,
      final('같은 문장.'),
      clock(2_000),
    );

    // Then
    expect(next.sentences).toHaveLength(1);
  });

  it('iOS처럼 끝난 뒤 여러 문장을 통째로 다시 줘도 한 번만 남긴다', () => {
    // Given
    const heard = VoiceNoteCaptionPolicy.applyCaptionResult(
      createVoiceNoteCaptions(),
      final('안녕하세요. 저는 바보입니다.'),
      clock(1_000),
    );

    // When
    const next = VoiceNoteCaptionPolicy.applyCaptionResult(
      heard,
      final(' 안녕하세요. 저는 바보입니다.'),
      clock(2_000),
    );

    // Then
    expect(next.sentences.map(({ text }) => text)).toEqual(['안녕하세요.', '저는 바보입니다.']);
  });

  it('다시 준 문장 뒤에 새 문장이 이어지면 새 문장만 더한다', () => {
    // Given
    const heard = VoiceNoteCaptionPolicy.applyCaptionResult(
      createVoiceNoteCaptions(),
      final('안녕하세요. 저는 바보입니다.'),
      clock(1_000),
    );

    // When
    const next = VoiceNoteCaptionPolicy.applyCaptionResult(
      heard,
      final('저는 바보입니다. 오늘 장 보기.'),
      clock(2_000),
    );

    // Then
    expect(next.sentences.map(({ text }) => text)).toEqual([
      '안녕하세요.',
      '저는 바보입니다.',
      '오늘 장 보기.',
    ]);
  });

  it('final의 단어 신뢰도가 낮으면 그 단어가 속한 문장에만 표시한다', () => {
    // Given
    const segments = [
      { text: '첫', startMs: 0, endMs: 100, confidence: 0.9 },
      { text: '문장.', startMs: 100, endMs: 200, confidence: 0.2 },
      { text: '둘째', startMs: 300, endMs: 400, confidence: 0.3 },
      { text: '문장.', startMs: 400, endMs: 500, confidence: 0.9 },
    ];

    // When
    const next = VoiceNoteCaptionPolicy.applyCaptionResult(
      createVoiceNoteCaptions(),
      final('첫 문장. 둘째 문장.', segments),
      clock(1_000),
    );

    // Then
    expect(next.sentences.map(({ lowConfidenceWords }) => lowConfidenceWords)).toEqual([
      ['문장.'],
      ['둘째'],
    ]);
  });

  it('Android처럼 신뢰도가 -1이면 아무것도 표시하지 않는다', () => {
    // Given
    const segments = [{ text: '첫', startMs: 0, endMs: 100, confidence: -1 }];

    // When
    const next = VoiceNoteCaptionPolicy.applyCaptionResult(
      createVoiceNoteCaptions(),
      final('첫', segments),
      clock(100),
    );

    // Then
    expect(next.sentences[0]?.lowConfidenceWords).toEqual([]);
  });

  it('단어 구간이 없는 인식기는 아무것도 표시하지 않는다', () => {
    // Given
    const captions = createVoiceNoteCaptions();

    // When
    const next = VoiceNoteCaptionPolicy.applyCaptionResult(captions, final('첫 문장.'), clock(100));

    // Then
    expect(next.sentences[0]?.lowConfidenceWords).toEqual([]);
  });
});

describe('commitProvisional', () => {
  it('인식 구간이 끝나면 꼬리를 문장으로 확정한다', () => {
    // Given
    const heard = VoiceNoteCaptionPolicy.applyCaptionResult(
      createVoiceNoteCaptions(),
      interim('들은 말'),
      clock(1_000),
    );

    // When
    const next = VoiceNoteCaptionPolicy.commitProvisional(heard, 2_000);

    // Then
    expect(next.provisional).toEqual([]);
    expect(next.sentences).toEqual([
      {
        text: '들은 말',
        startMs: 1_000,
        endMs: 2_000,
        isBookmarked: false,
        lowConfidenceWords: [],
      },
    ]);
  });
});

describe('getSettledSentences', () => {
  it('아직 바뀔 수 있는 마지막 문장은 빼고 앞 문장은 다음 문장이 시작할 때 끝난다', () => {
    // Given
    const heard = VoiceNoteCaptionPolicy.applyCaptionResult(
      createVoiceNoteCaptions(),
      interim('첫 문장. 둘째 문장'),
      clock(1_000),
    );
    const next = VoiceNoteCaptionPolicy.applyCaptionResult(
      heard,
      interim('첫 문장. 둘째 문장. 셋째'),
      clock(4_000),
    );

    // When
    const sentences = VoiceNoteCaptionPolicy.getSettledSentences(next);

    // Then
    expect(sentences.map(({ text, endMs }) => ({ text, endMs }))).toEqual([
      { text: '첫 문장.', endMs: 1_000 },
      { text: '둘째 문장.', endMs: 4_000 },
    ]);
  });
});

describe('withBookmark', () => {
  it('깃발은 그 시각에 말하던 문장에 붙고, 말이 없던 때면 직전 문장에 붙는다', () => {
    // Given
    const first = VoiceNoteCaptionPolicy.applyCaptionResult(
      createVoiceNoteCaptions(),
      final('첫 문장.'),
      clock(2_000),
    );
    const second = VoiceNoteCaptionPolicy.applyCaptionResult(
      first,
      final('둘째 문장.'),
      clock(8_000),
    );

    // When
    const marked = VoiceNoteCaptionPolicy.withBookmark(second, 8_500);

    // Then
    expect(
      VoiceNoteCaptionPolicy.getCaptionSentences(marked, 9_000).map(
        ({ isBookmarked }) => isBookmarked,
      ),
    ).toEqual([false, true]);
  });
});

describe('getMarkedSentenceCount', () => {
  it('아무것도 누르지 않았으면 0개다', () => {
    // Given
    const captions = VoiceNoteCaptionPolicy.applyCaptionResult(
      createVoiceNoteCaptions(),
      final('첫 문장.'),
      clock(2_000),
    );

    // When
    const count = VoiceNoteCaptionPolicy.getMarkedSentenceCount(captions);

    // Then
    expect(count).toBe(0);
  });

  it('같은 문장을 여러 번 눌러도 한 문장으로 센다', () => {
    // Given
    const captions = VoiceNoteCaptionPolicy.applyCaptionResult(
      createVoiceNoteCaptions(),
      final('첫 문장.'),
      clock(2_000),
    );

    // When
    const count = VoiceNoteCaptionPolicy.getMarkedSentenceCount(
      VoiceNoteCaptionPolicy.withBookmark(
        VoiceNoteCaptionPolicy.withBookmark(captions, 2_500),
        3_000,
      ),
    );

    // Then
    expect(count).toBe(1);
  });

  it('다른 문장을 누르면 문장마다 하나씩 센다', () => {
    // Given
    const first = VoiceNoteCaptionPolicy.applyCaptionResult(
      createVoiceNoteCaptions(),
      final('첫 문장.'),
      clock(2_000),
    );
    const second = VoiceNoteCaptionPolicy.applyCaptionResult(
      VoiceNoteCaptionPolicy.withBookmark(first, 2_500),
      final('둘째 문장.'),
      clock(8_000),
    );

    // When
    const count = VoiceNoteCaptionPolicy.getMarkedSentenceCount(
      VoiceNoteCaptionPolicy.withBookmark(second, 8_500),
    );

    // Then
    expect(count).toBe(2);
  });

  it('문장이 나오기 전에 누르면 곧 나올 첫 문장 하나로 센다', () => {
    // Given
    const pressed = VoiceNoteCaptionPolicy.withBookmark(
      VoiceNoteCaptionPolicy.withBookmark(createVoiceNoteCaptions(), 300),
      600,
    );

    // When
    const beforeSpeech = VoiceNoteCaptionPolicy.getMarkedSentenceCount(pressed);
    const afterSpeech = VoiceNoteCaptionPolicy.applyCaptionResult(
      pressed,
      final('첫 문장.'),
      clock(2_000),
    );

    // Then
    expect(beforeSpeech).toBe(1);
    expect(VoiceNoteCaptionPolicy.getCaptionSentences(afterSpeech, 2_000)[0]?.isBookmarked).toBe(
      true,
    );
  });
});

describe('createTranscribedVoiceNote', () => {
  const input = {
    draftId: 'draft-1',
    locale: 'ko-KR',
    createdAt: toInstant('2026-11-05T00:00:00.000Z'),
  } as const;

  it('확정 문장과 인식 중 꼬리까지 글자를 잃지 않고 들은 시간에 나눠 담는다', () => {
    // Given
    const transcript = { sentences: ['첫 문장.', '둘째 문장.'], interim: '셋째 말' };

    // When
    const note = createTranscribedVoiceNote({
      ...input,
      transcript,
      durationMs: 90_000,
    });

    // Then
    expect(note.sentences.map(({ text }) => text)).toEqual(['첫 문장.', '둘째 문장.', '셋째 말']);
    expect(note.durationMs).toBe(90_000);
    expect(note.sentences[0]?.startMs).toBe(0);
    expect(note.sentences.at(-1)?.endMs).toBe(90_000);
  });

  it('들은 글자가 없으면 문장이 없는 초안이다', () => {
    // Given
    const transcript = { sentences: [], interim: '' };

    // When
    const note = createTranscribedVoiceNote({
      ...input,
      transcript,
      durationMs: 90_000,
    });

    // Then
    expect(note.sentences).toEqual([]);
  });
});

describe('toVoiceNoteCaptions', () => {
  const input = {
    draftId: 'draft-1',
    locale: 'ko-KR',
    createdAt: toInstant('2026-11-05T00:00:00.000Z'),
  } as const;

  it('저장된 초안에서 이어 가면 문장과 깃발이 그대로다', () => {
    // Given
    const note = createTranscribedVoiceNote({
      ...input,
      transcript: { sentences: ['첫 문장.'], interim: '' },
      durationMs: 1_000,
    });

    // When
    const captions = VoiceNoteCaptionPolicy.toVoiceNoteCaptions(note);

    // Then
    expect(captions.sentences).toEqual(note.sentences);
    expect(captions.provisional).toEqual([]);
  });
});

describe('hasCaptionText', () => {
  it('글자가 하나도 없으면 지울 때 묻지 않는다', () => {
    // Given
    const captions = createVoiceNoteCaptions();

    // When
    const result = VoiceNoteCaptionPolicy.hasCaptionText(captions);

    // Then
    expect(result).toBe(false);
  });

  it('아직 확정되지 않은 꼬리만 있어도 들은 글자다', () => {
    // Given
    const captions = VoiceNoteCaptionPolicy.applyCaptionResult(
      createVoiceNoteCaptions(),
      interim('첫 문장'),
      clock(1_000),
    );

    // When
    const result = VoiceNoteCaptionPolicy.hasCaptionText(captions);

    // Then
    expect(captions.provisional).toHaveLength(1);
    expect(result).toBe(true);
  });

  it('확정된 문장이 있으면 들은 글자다', () => {
    // Given
    const captions = VoiceNoteCaptionPolicy.applyCaptionResult(
      createVoiceNoteCaptions(),
      final('첫 문장.'),
      clock(1_000),
    );

    // When
    const result = VoiceNoteCaptionPolicy.hasCaptionText(captions);

    // Then
    expect(captions.sentences).toHaveLength(1);
    expect(result).toBe(true);
  });
});
