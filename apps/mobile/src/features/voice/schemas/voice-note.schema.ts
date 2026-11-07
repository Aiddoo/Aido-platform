import { instantSchema } from '@src/shared/date/instant';
import { memoize } from 'es-toolkit';
import { z } from 'zod';

import { createPlanReviewDraftSchema, type PlanReviewDraft } from './plan-review-form.schema';
import { speechLocaleSchema } from './speech-locale.schema';

export const voiceNoteDraftIdSchema = z.string().min(1).brand<'VoiceNoteDraftId'>();
/** 확정된 문장 하나. 녹음 시작부터의 구간이라 다시 듣기와 같은 시계를 쓴다 */
const voiceNoteSentenceSchema = z.object({
  text: z.string(),
  startMs: z.int().nonnegative(),
  endMs: z.int().nonnegative(),
  isBookmarked: z.boolean(),
  /** 잘못 들었을 수 있는 단어(문장 안 순서대로). 신뢰도를 주지 않는 기기는 비어 있다 */
  lowConfidenceWords: z.array(z.string()).default([]),
});
export type VoiceNoteSentence = z.infer<typeof voiceNoteSentenceSchema>;

const voiceNoteKeyPointSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  /** 말한 시각을 찾지 못한 포인트는 null이라 그 지점으로 갈 수 없다 */
  startMs: z.int().nonnegative().nullable(),
  isBookmarked: z.boolean(),
});
export type VoiceNoteKeyPoint = z.infer<typeof voiceNoteKeyPointSchema>;

const voiceNoteDigestSchema = z.object({
  title: z.string(),
  summary: z.string(),
  keyPoints: z.array(voiceNoteKeyPointSchema),
});
export type VoiceNoteDigest = z.infer<typeof voiceNoteDigestSchema>;

/** 멈췄다 이어 들으면 인식기가 파일을 새로 쓴다. 한 조각은 노트 시계의 어디서 시작하는지 함께 든다 */
const voiceNoteRecordingSchema = z.object({
  fileName: z.string().min(1),
  startMs: z.int().nonnegative(),
});
export type VoiceNoteRecording = z.infer<typeof voiceNoteRecordingSchema>;

/** 정리를 다시 보낼 때 차감이 겹치지 않도록 앱을 다시 켜도 같은 멱등 키를 쓴다 */
const voiceNoteDigestRequestSchema = z.object({
  idempotencyKey: z.string().min(1),
});
export type VoiceNoteDigestRequest = z.infer<typeof voiceNoteDigestRequestSchema>;

/**
 * 카드 저장 요청. 저장 응답을 받기 전에 화면을 떠나도 다시 눌렀을 때 같은 키를 써 두 번 저장되지 않게 초안에 남긴다.
 * 카드를 고쳐서 보내면 새 키를 쓰도록 내용 지문을 함께 든다.
 */
const voiceNotePlanApplyRequestSchema = z.object({
  idempotencyKey: z.string().min(1),
  fingerprint: z.string(),
});
export type VoiceNotePlanApplyRequest = z.infer<typeof voiceNotePlanApplyRequestSchema>;

/** 메모로 저장 요청. 내용이 정리 결과로 정해져 있어 키만 남긴다 */
const voiceNoteMemoSaveRequestSchema = z.object({
  idempotencyKey: z.string().min(1),
});
export type VoiceNoteMemoSaveRequest = z.infer<typeof voiceNoteMemoSaveRequestSchema>;

/** 고친 카드까지 든 검토 초안. 통째로 읽지 못하면 글자와 요약은 살리고 이 칸만 비워 화면이 알리게 한다 */
function createStoredPlanDraftSchema(timeZone: string) {
  const planReviewDraftSchema = createPlanReviewDraftSchema(timeZone);

  return z.codec(z.unknown(), z.custom<PlanReviewDraft | null>(), {
    decode: (raw) => planReviewDraftSchema.safeParse(raw).data ?? null,
    encode: (draft) => draft,
  });
}

/** 기기 안 초안. 녹음 파일은 폴더를 바꿔도 찾도록 파일 이름만 가진다 */
function buildVoiceNoteSchema(timeZone: string) {
  return z.object({
    draftId: voiceNoteDraftIdSchema,
    locale: speechLocaleSchema,
    createdAt: instantSchema,
    durationMs: z.int().nonnegative(),
    sentences: z.array(voiceNoteSentenceSchema),
    recordings: z.array(voiceNoteRecordingSchema),
    digest: voiceNoteDigestSchema.nullable(),
    digestRequest: voiceNoteDigestRequestSchema.nullable(),
    planDraft: createStoredPlanDraftSchema(timeZone),
    planApplyRequest: voiceNotePlanApplyRequestSchema.nullable().default(null),
    appliedAt: instantSchema.nullable(),
    /** 고른 카드로 저장한 할 일 수. 이 칸이 생기기 전에 저장한 초안은 null이다 */
    appliedTodoCount: z.int().nonnegative().nullable().default(null),
    memoSaveRequest: voiceNoteMemoSaveRequestSchema.nullable().default(null),
    memoSavedAt: instantSchema.nullable(),
  });
}

/** 녹음 중 저장과 목록 복원마다 부르므로 시간대별로 한 번만 만든다 */
export const createVoiceNoteSchema = memoize(buildVoiceNoteSchema);
export type VoiceNote = z.infer<ReturnType<typeof buildVoiceNoteSchema>>;
