import { memoize } from 'es-toolkit';
import { z } from 'zod';

import type { PlanReviewDraft } from '../domains/plan-review-draft.model';
import { voiceNoteSchema } from '../domains/voice-note.model';
import { createPlanReviewDraftSchema } from './plan-review-form.schema';

// 고친 카드를 통째로 읽지 못하면 글자와 요약은 살리고 이 칸만 비워 화면이 알리게 한다
function createStoredPlanDraftSchema(timezone: string) {
  const planReviewDraftSchema = createPlanReviewDraftSchema(timezone);

  return z.codec(z.unknown(), z.custom<PlanReviewDraft | null>(), {
    decode: (raw) => planReviewDraftSchema.safeParse(raw).data ?? null,
    encode: (draft) => draft,
  });
}

// 기기에 남긴 초안. 칸이 생기기 전에 저장한 초안도 읽도록 새 칸은 기본값을 둔다. 기본값은 2026-12-11 이후 지운다(compatibility.md)
function buildVoiceNoteDraftSchema(timezone: string) {
  const { shape } = voiceNoteSchema;
  return voiceNoteSchema.extend({
    sentences: z.array(
      shape.sentences.element.extend({ lowConfidenceWords: z.array(z.string()).default([]) }),
    ),
    planDraft: createStoredPlanDraftSchema(timezone),
    planApplyRequest: shape.planApplyRequest.default(null),
    appliedTodoCount: shape.appliedTodoCount.default(null),
    memoSaveRequest: shape.memoSaveRequest.default(null),
  });
}

// 녹음 중 저장과 목록 복원마다 부르므로 시간대별로 한 번만 만든다
export const createVoiceNoteDraftSchema = memoize(buildVoiceNoteDraftSchema);
