import {
  applyCaptionResult,
  commitProvisional,
  createCaptionsFromNote,
  createVoiceNoteCaptions,
  createVoiceNoteFromTranscript,
  getCaptionInterimText,
  getCaptionSentences,
  splitIntoSentences,
  withBookmark,
} from './voice-note-caption.model';

const clock = (nowMs: number, segmentStartMs = 0) => ({ nowMs, segmentStartMs });
const interim = (transcript: string) => ({ transcript, isFinal: false, segments: [] });
const final = (
  transcript: string,
  segments: { text: string; startMs: number; endMs: number; confidence: number }[] = [],
) => ({ transcript, isFinal: true, segments });

describe('splitIntoSentences', () => {
  test('문장부호에서 나눈다', () => {
    // Given
    const text = '목표는 이탈 줄이기예요. 시안은 언제까지죠? 수요일이요.';

    // When
    const sentences = splitIntoSentences(text);

    // Then
    expect(sentences).toEqual(['목표는 이탈 줄이기예요.', '시안은 언제까지죠?', '수요일이요.']);
  });

  test('문장부호가 없는 긴 말은 띄어쓰기에서 끊어 카드가 끝없이 길어지지 않게 한다', () => {
    // Given
    const text = Array.from({ length: 40 }, () => '가나다라').join(' ');

    // When
    const sentences = splitIntoSentences(text, 30);

    // Then
    expect(sentences.every((sentence) => sentence.length <= 30)).toBe(true);
    expect(sentences.join(' ')).toBe(text);
  });
});

describe('applyCaptionResult', () => {
  test('Android처럼 문장마다 final이 오면 문장을 차례로 쌓는다', () => {
    // Given
    const heard = applyCaptionResult(createVoiceNoteCaptions(), interim('첫 문장'), clock(1_000));

    // When
    const first = applyCaptionResult(heard, final('첫 문장.'), clock(3_000));
    const second = applyCaptionResult(first, final('둘째 문장.'), clock(6_000));

    // Then
    expect(getCaptionSentences(second, 6_000).map(({ text }) => text)).toEqual([
      '첫 문장.',
      '둘째 문장.',
    ]);
    expect(getCaptionSentences(second, 6_000)[0]).toMatchObject({ startMs: 1_000, endMs: 3_000 });
  });

  test('iOS처럼 interim만 쌓여도 앞 문장은 카드가 되고 마지막만 인식 중으로 남는다', () => {
    // Given
    const captions = createVoiceNoteCaptions();

    // When
    const heard = applyCaptionResult(
      applyCaptionResult(captions, interim('첫 문장.'), clock(1_000)),
      interim('첫 문장. 둘째 문장'),
      clock(4_000),
    );

    // Then
    expect(heard.provisional).toEqual([
      { text: '첫 문장.', startMs: 1_000 },
      { text: '둘째 문장', startMs: 4_000 },
    ]);
    expect(getCaptionInterimText(heard)).toBe('둘째 문장');
  });

  test('final이 나오기 전에 저장해도 인식 중인 글자까지 남는다', () => {
    // Given
    const heard = applyCaptionResult(
      createVoiceNoteCaptions(),
      interim('아직 확정 안 된 말'),
      clock(1_000),
    );

    // When
    const sentences = getCaptionSentences(heard, 5_000);

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

  test('interim이 처음부터 다시 쌓이면 앞 글자를 확정해 잃지 않는다', () => {
    // Given
    const long = '오늘 회의에서 정한 내용을 길게 말하고 있어요';
    const heard = applyCaptionResult(createVoiceNoteCaptions(), interim(long), clock(1_000));

    // When
    const restarted = applyCaptionResult(heard, interim('새 말'), clock(9_000));

    // Then
    expect(restarted.sentences.map(({ text }) => text)).toEqual([long]);
    expect(getCaptionInterimText(restarted)).toBe('새 말');
  });

  test('단어 구간이 있으면 구간 시작 시각을 더해 문장 시각을 찾는다', () => {
    // Given
    const captions = createVoiceNoteCaptions();

    // When
    const next = applyCaptionResult(
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

  test('끝난 뒤 같은 문장을 다시 줘도 한 번만 남긴다', () => {
    // Given
    const heard = applyCaptionResult(createVoiceNoteCaptions(), final('같은 문장.'), clock(1_000));

    // When
    const next = applyCaptionResult(heard, final('같은 문장.'), clock(2_000));

    // Then
    expect(next.sentences).toHaveLength(1);
  });
});

describe('commitProvisional', () => {
  test('인식 구간이 끝나면 꼬리를 문장으로 확정한다', () => {
    // Given
    const heard = applyCaptionResult(createVoiceNoteCaptions(), interim('들은 말'), clock(1_000));

    // When
    const next = commitProvisional(heard, 2_000);

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

describe('withBookmark', () => {
  test('깃발은 그 시각에 말하던 문장에 붙고, 말이 없던 때면 직전 문장에 붙는다', () => {
    // Given
    const first = applyCaptionResult(createVoiceNoteCaptions(), final('첫 문장.'), clock(2_000));
    const second = applyCaptionResult(first, final('둘째 문장.'), clock(8_000));

    // When
    const marked = withBookmark(second, 8_500);

    // Then
    expect(getCaptionSentences(marked, 9_000).map(({ isBookmarked }) => isBookmarked)).toEqual([
      false,
      true,
    ]);
  });
});

describe('신뢰도 낮은 단어', () => {
  test('final의 단어 신뢰도가 낮으면 그 단어가 속한 문장에만 표시한다', () => {
    // Given
    const segments = [
      { text: '첫', startMs: 0, endMs: 100, confidence: 0.9 },
      { text: '문장.', startMs: 100, endMs: 200, confidence: 0.2 },
      { text: '둘째', startMs: 300, endMs: 400, confidence: 0.3 },
      { text: '문장.', startMs: 400, endMs: 500, confidence: 0.9 },
    ];

    // When
    const next = applyCaptionResult(
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

  test('Android처럼 신뢰도가 -1이면 아무것도 표시하지 않는다', () => {
    // Given
    const segments = [{ text: '첫', startMs: 0, endMs: 100, confidence: -1 }];

    // When
    const next = applyCaptionResult(createVoiceNoteCaptions(), final('첫', segments), clock(100));

    // Then
    expect(next.sentences[0]?.lowConfidenceWords).toEqual([]);
  });

  test('단어 구간이 없는 인식기는 아무것도 표시하지 않는다', () => {
    // Given
    const captions = createVoiceNoteCaptions();

    // When
    const next = applyCaptionResult(captions, final('첫 문장.'), clock(100));

    // Then
    expect(next.sentences[0]?.lowConfidenceWords).toEqual([]);
  });
});

describe('createVoiceNoteFromTranscript', () => {
  const input = {
    draftId: 'draft-1',
    locale: 'ko-KR',
    createdAt: new Date('2026-11-05T00:00:00.000Z'),
  } as const;

  test('확정 문장과 인식 중 꼬리까지 글자를 잃지 않고 들은 시간에 나눠 담는다', () => {
    // Given
    const transcript = { sentences: ['첫 문장.', '둘째 문장.'], interim: '셋째 말' };

    // When
    const note = createVoiceNoteFromTranscript({ ...input, transcript, durationMs: 90_000 });

    // Then
    expect(note.sentences.map(({ text }) => text)).toEqual(['첫 문장.', '둘째 문장.', '셋째 말']);
    expect(note.durationMs).toBe(90_000);
    expect(note.sentences[0]?.startMs).toBe(0);
    expect(note.sentences.at(-1)?.endMs).toBe(90_000);
  });

  test('들은 글자가 없으면 문장이 없는 초안이다', () => {
    // Given
    const transcript = { sentences: [], interim: '' };

    // When
    const note = createVoiceNoteFromTranscript({ ...input, transcript, durationMs: 90_000 });

    // Then
    expect(note.sentences).toEqual([]);
  });

  test('저장된 초안에서 이어 가면 문장과 깃발이 그대로다', () => {
    // Given
    const note = createVoiceNoteFromTranscript({
      ...input,
      transcript: { sentences: ['첫 문장.'], interim: '' },
      durationMs: 1_000,
    });

    // When
    const captions = createCaptionsFromNote(note);

    // Then
    expect(captions.sentences).toEqual(note.sentences);
    expect(captions.provisional).toEqual([]);
  });
});
