import {
  createVoiceNote,
  type VoiceNote,
  type VoiceNoteDigest,
  type VoiceNoteKeyPoint,
  type VoiceNoteSentence,
} from '../domains/voice-note.model';

export const createVoiceNoteSentence = (
  overrides: Partial<VoiceNoteSentence> = {},
): VoiceNoteSentence => ({
  text: '이번 주 목표는 온보딩 이탈을 줄이는 거예요.',
  startMs: 12_000,
  endMs: 16_000,
  isBookmarked: false,
  ...overrides,
});

export const createVoiceNoteKeyPoint = (
  overrides: Partial<VoiceNoteKeyPoint> = {},
): VoiceNoteKeyPoint => ({
  id: 'key-point-1',
  text: '목표는 온보딩 이탈 줄이기',
  startMs: 12_000,
  isBookmarked: false,
  ...overrides,
});

export const createVoiceNoteDigest = (
  overrides: Partial<VoiceNoteDigest> = {},
): VoiceNoteDigest => ({
  title: '온보딩 개선 주간 회의',
  summary: '온보딩 이탈을 줄이는 게 이번 주 목표예요.',
  keyPoints: [
    createVoiceNoteKeyPoint({ id: 'key-point-1', startMs: 12_000 }),
    createVoiceNoteKeyPoint({ id: 'key-point-2', text: '디자인 시안 2개', startMs: 41_000 }),
    createVoiceNoteKeyPoint({ id: 'key-point-3', text: 'A/B 실험 시작', startMs: 117_000 }),
  ],
  ...overrides,
});

type VoiceNoteOverrides = Partial<Omit<VoiceNote, 'draftId'>> & { draftId?: string };

export const createVoiceNoteFixture = ({
  draftId = 'draft-1',
  ...overrides
}: VoiceNoteOverrides = {}): VoiceNote => ({
  ...createVoiceNote({
    draftId,
    locale: 'ko-KR',
    createdAt: new Date('2026-11-01T00:00:00.000Z'),
  }),
  durationMs: 178_000,
  sentences: [createVoiceNoteSentence()],
  recordingFileName: `${draftId}.wav`,
  ...overrides,
});
