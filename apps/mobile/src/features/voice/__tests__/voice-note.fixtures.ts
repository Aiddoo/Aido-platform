import { toInstant } from '@src/shared/date/instant';

import {
  type VoiceNote,
  type VoiceNoteDigest,
  voiceNoteDigestSchema,
  type VoiceNoteKeyPoint,
  voiceNoteKeyPointSchema,
  voiceNoteSchema,
  type VoiceNoteSentence,
  voiceNoteSentenceSchema,
  createVoiceNote,
} from '../domains/voice-note.model';

export function createVoiceNoteSentence(
  overrides: Partial<VoiceNoteSentence> = {},
): VoiceNoteSentence {
  return voiceNoteSentenceSchema.parse({
    text: '이번 주 목표는 온보딩 이탈을 줄이는 거예요.',
    startMs: 12_000,
    endMs: 16_000,
    isBookmarked: false,
    lowConfidenceWords: [],
    ...overrides,
  });
}

export function createVoiceNoteKeyPoint(
  overrides: Partial<VoiceNoteKeyPoint> = {},
): VoiceNoteKeyPoint {
  return voiceNoteKeyPointSchema.parse({
    id: 'key-point-1',
    text: '목표는 온보딩 이탈 줄이기',
    startMs: 12_000,
    isBookmarked: false,
    ...overrides,
  });
}

export function createVoiceNoteDigest(overrides: Partial<VoiceNoteDigest> = {}): VoiceNoteDigest {
  return voiceNoteDigestSchema.parse({
    title: '온보딩 개선 주간 회의',
    summary: '온보딩 이탈을 줄이는 게 이번 주 목표예요.',
    keyPoints: [
      createVoiceNoteKeyPoint({ id: 'key-point-1', startMs: 12_000 }),
      createVoiceNoteKeyPoint({ id: 'key-point-2', text: '디자인 시안 2개', startMs: 41_000 }),
      createVoiceNoteKeyPoint({ id: 'key-point-3', text: 'A/B 실험 시작', startMs: 117_000 }),
    ],
    ...overrides,
  });
}

type VoiceNoteOverrides = Partial<Omit<VoiceNote, 'draftId'>> & { draftId?: string };

export function createSpokenVoiceNote({
  draftId = 'draft-1',
  ...overrides
}: VoiceNoteOverrides = {}): VoiceNote {
  return voiceNoteSchema.parse({
    ...createVoiceNote({
      draftId,
      locale: 'ko-KR',
      createdAt: toInstant('2026-11-01T00:00:00.000Z'),
    }),
    durationMs: 178_000,
    sentences: [createVoiceNoteSentence()],
    recordings: [{ fileName: `${draftId}-0.wav`, startMs: 0 }],
    ...overrides,
  });
}
