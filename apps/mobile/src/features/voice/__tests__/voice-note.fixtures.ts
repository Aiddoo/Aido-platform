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

const PENDING_NOTE_ID = '3f2c9a4e-8b1d-4c6f-9e2a-5d7b1c0e4f68';
const APPLIED_NOTE_ID = 'a8e1d2c3-4b5f-4a6e-8d7c-9f0b1e2d3c4a';

/**
 * 1.15.1(origin/main 7531d9914)의 `createVoiceNoteDraftSchema`가 기기에 쓴 말로 메모 초안 원문.
 * 출시 앱이 남긴 계약이라 지금 모델에 맞춰 고치지 않는다. 모양을 바꾸면 이 원문을 읽는 이주를 더한다
 */
export const RELEASED_VOICE_NOTE_DRAFTS = {
  /** 카드를 고쳐 적용과 메모 저장을 보낸 채 앱이 꺼진 노트. 멈췄다 이어 들어 녹음이 두 조각이다 */
  pending: {
    draftId: PENDING_NOTE_ID,
    locale: 'ko-KR',
    createdAt: '2026-11-28T09:12:30.000Z',
    durationMs: 184_250,
    sentences: [
      {
        text: '내일 오전에 분기 보고서 초안 마무리하기',
        startMs: 0,
        endMs: 4_200,
        isBookmarked: true,
        lowConfidenceWords: ['분기'],
      },
      {
        text: '금요일마다 팀 회의 준비',
        startMs: 4_800,
        endMs: 8_100,
        isBookmarked: false,
        lowConfidenceWords: [],
      },
      {
        text: '이건 메모로 남겨 둘게',
        startMs: 120_400,
        endMs: 123_900,
        isBookmarked: false,
        lowConfidenceWords: [],
      },
    ],
    recordings: [
      { fileName: `${PENDING_NOTE_ID}-0.wav`, startMs: 0 },
      { fileName: `${PENDING_NOTE_ID}-1.wav`, startMs: 120_000 },
    ],
    digest: {
      title: '보고서와 회의 준비',
      summary: '내일 보고서 초안을 끝내고 금요일마다 팀 회의를 준비해요.',
      keyPoints: [
        { id: 'kp-1', text: '분기 보고서 초안 마무리', startMs: 0, isBookmarked: true },
        { id: 'kp-2', text: '팀 회의 준비', startMs: null, isBookmarked: false },
      ],
    },
    digestRequest: { idempotencyKey: 'c1d2e3f4-digest' },
    planDraft: {
      omittedTodoCount: 1,
      form: {
        actions: [
          {
            type: 'create-todo',
            actionId: 'action-1',
            title: '분기 보고서 초안 마무리',
            startDate: '2026-11-29',
            endDate: null,
            scheduledTime: '10:00',
            repeat: null,
            visibility: 'PRIVATE',
            items: [{ title: '표 정리' }],
            categoryId: 3,
            duplicateOfTodoId: null,
            isSelected: true,
          },
          {
            type: 'create-todo',
            actionId: 'action-2',
            title: '팀 회의 준비',
            startDate: '2026-12-04',
            endDate: null,
            scheduledTime: null,
            repeat: {
              frequency: 'WEEKLY',
              interval: 1,
              weekdays: ['FRI'],
              end: { type: 'COUNT', count: 10 },
            },
            visibility: null,
            items: [],
            categoryId: null,
            duplicateOfTodoId: 42,
            isSelected: false,
          },
          {
            type: 'create-memo',
            actionId: 'action-3',
            title: '메모',
            content: '이건 메모로 남겨 둘게',
            isSelected: true,
          },
        ],
      },
    },
    planApplyRequest: { idempotencyKey: 'c1d2e3f4-apply', fingerprint: 'action-1|action-3' },
    appliedAt: null,
    appliedTodoCount: null,
    memoSaveRequest: { idempotencyKey: 'c1d2e3f4-memo' },
    memoSavedAt: null,
  },
  /** 할 일을 적용하고 메모로도 저장한 영어 노트. 적용하면 카드와 적용 요청은 지운다 */
  applied: {
    draftId: APPLIED_NOTE_ID,
    locale: 'en-US',
    createdAt: '2026-11-30T22:40:00.000Z',
    durationMs: 61_000,
    sentences: [
      {
        text: 'Call the dentist on Monday',
        startMs: 0,
        endMs: 2_600,
        isBookmarked: false,
        lowConfidenceWords: ['dentist'],
      },
    ],
    recordings: [{ fileName: `${APPLIED_NOTE_ID}-0.wav`, startMs: 0 }],
    digest: {
      title: 'Dentist',
      summary: 'Call the dentist on Monday.',
      keyPoints: [{ id: 'kp-1', text: 'Call the dentist', startMs: 0, isBookmarked: false }],
    },
    digestRequest: null,
    planDraft: null,
    planApplyRequest: null,
    appliedAt: '2026-11-30T22:45:12.000Z',
    appliedTodoCount: 1,
    memoSaveRequest: null,
    memoSavedAt: '2026-11-30T22:46:03.000Z',
  },
} as const;
