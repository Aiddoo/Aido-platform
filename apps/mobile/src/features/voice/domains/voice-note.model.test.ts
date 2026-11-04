import {
  createVoiceNoteDigest,
  createVoiceNoteFixture,
  createVoiceNoteKeyPoint,
  createVoiceNoteSentence,
} from '../__tests__/voice-note.factories';
import { VoiceNotePolicy, voiceNoteSchema, withDigest } from './voice-note.model';

describe('VoiceNotePolicy.canDigest', () => {
  test('글자가 있고 아직 정리하지 않았으면 정리할 수 있다', () => {
    // Given
    const note = createVoiceNoteFixture();

    // When
    const result = VoiceNotePolicy.canDigest(note);

    // Then
    expect(result).toBe(true);
  });

  test('공백뿐인 문장만 있으면 정리할 수 없다', () => {
    // Given
    const note = createVoiceNoteFixture({ sentences: [createVoiceNoteSentence({ text: '  ' })] });

    // When
    const result = VoiceNotePolicy.canDigest(note);

    // Then
    expect(result).toBe(false);
  });

  test('이미 정리한 노트는 다시 정리할 수 없다', () => {
    // Given
    const note = withDigest(createVoiceNoteFixture(), createVoiceNoteDigest());

    // When
    const result = VoiceNotePolicy.canDigest(note);

    // Then
    expect(result).toBe(false);
  });
});

describe('VoiceNotePolicy.canPlayRecording', () => {
  test('녹음 파일이 없으면 다시 들을 수 없다', () => {
    // Given
    const note = createVoiceNoteFixture({ recordingFileName: null });

    // When
    const result = VoiceNotePolicy.canPlayRecording(note);

    // Then
    expect(result).toBe(false);
  });

  test('녹음 파일과 길이가 있으면 다시 들을 수 있다', () => {
    // Given
    const note = createVoiceNoteFixture();

    // When
    const result = VoiceNotePolicy.canPlayRecording(note);

    // Then
    expect(result).toBe(true);
  });
});

describe('VoiceNotePolicy.findKeyPointAt', () => {
  const note = withDigest(createVoiceNoteFixture(), createVoiceNoteDigest());

  test('첫 핵심 포인트 전에는 아무 포인트도 아니다', () => {
    // Given
    const positionMs = 11_999;

    // When
    const keyPoint = VoiceNotePolicy.findKeyPointAt(note, positionMs);

    // Then
    expect(keyPoint).toBeUndefined();
  });

  test('시작 시각 정각에는 그 포인트로 넘어간다', () => {
    // Given
    const positionMs = 41_000;

    // When
    const keyPoint = VoiceNotePolicy.findKeyPointAt(note, positionMs);

    // Then
    expect(keyPoint?.id).toBe('key-point-2');
  });

  test('다음 포인트 전까지는 직전 포인트로 본다', () => {
    // Given
    const positionMs = 116_999;

    // When
    const keyPoint = VoiceNotePolicy.findKeyPointAt(note, positionMs);

    // Then
    expect(keyPoint?.id).toBe('key-point-2');
  });

  test('순서가 섞여 있어도 가장 가까운 시작 시각을 고른다', () => {
    // Given
    const unordered = withDigest(
      createVoiceNoteFixture(),
      createVoiceNoteDigest({
        keyPoints: [
          createVoiceNoteKeyPoint({ id: 'late', startMs: 90_000 }),
          createVoiceNoteKeyPoint({ id: 'early', startMs: 10_000 }),
        ],
      }),
    );

    // When
    const keyPoint = VoiceNotePolicy.findKeyPointAt(unordered, 95_000);

    // Then
    expect(keyPoint?.id).toBe('late');
  });

  test('정리 전 노트에는 핵심 포인트가 없다', () => {
    // Given
    const undigested = createVoiceNoteFixture();

    // When
    const keyPoint = VoiceNotePolicy.findKeyPointAt(undigested, 60_000);

    // Then
    expect(keyPoint).toBeUndefined();
  });
});

describe('VoiceNotePolicy.isExpired', () => {
  const note = createVoiceNoteFixture({ createdAt: new Date('2026-11-01T00:00:00.000Z') });

  test('만든 지 30일이 되기 직전까지는 만료되지 않는다', () => {
    // Given
    const now = new Date('2026-11-30T23:59:59.999Z');

    // When
    const result = VoiceNotePolicy.isExpired(note, now);

    // Then
    expect(result).toBe(false);
  });

  test('만든 지 30일이 되는 순간 만료된다', () => {
    // Given
    const now = new Date('2026-12-01T00:00:00.000Z');

    // When
    const result = VoiceNotePolicy.isExpired(note, now);

    // Then
    expect(result).toBe(true);
  });
});

describe('VoiceNotePolicy.isRecordingFileExpired', () => {
  test('수정 시각을 모르는 파일은 기한이 지난 것으로 본다', () => {
    // Given
    const now = new Date('2026-11-05T00:00:00.000Z');

    // When
    const result = VoiceNotePolicy.isRecordingFileExpired(null, now);

    // Then
    expect(result).toBe(true);
  });
});

describe('voiceNoteSchema', () => {
  test('저장한 순간은 ISO 문자열로 남고 읽으면 Date로 돌아온다', () => {
    // Given
    const note = withDigest(createVoiceNoteFixture(), createVoiceNoteDigest());

    // When
    const stored = voiceNoteSchema.encode(note);
    const restored = voiceNoteSchema.decode(JSON.parse(JSON.stringify(stored)));

    // Then
    expect(stored.createdAt).toBe('2026-11-01T00:00:00.000Z');
    expect(restored).toEqual(note);
  });
});
