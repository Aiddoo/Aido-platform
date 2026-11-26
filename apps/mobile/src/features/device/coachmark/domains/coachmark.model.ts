import { z } from 'zod';

export const coachmarkKindSchema = z.enum([
  'todo-reorder',
  'category-reorder',
  'comment-double-tap',
  'voice-quick-start',
  'voice-note-start',
  'voice-note-mark',
  'voice-key-point',
  'repeat-horizon',
  'ai-consent-renewal',
  'friend-strip',
  'ai-feature-update',
  'todo-import-destination',
]);

export type CoachmarkKind = z.infer<typeof coachmarkKindSchema>;

const coachmarkInputSchema = z.object({
  accountId: z.string(),
  kind: coachmarkKindSchema,
});

export type CoachmarkInput = z.infer<typeof coachmarkInputSchema>;

/** 계정이 안내 하나를 끝낸 기록. 끝낸 시각 원문만 안다 */
const coachmarkSchema = z.object({
  kind: coachmarkKindSchema,
  completedAt: z.string().nullable(),
});
export type Coachmark = z.infer<typeof coachmarkSchema>;

export const CoachmarkPolicy = {
  /** 한 번 끝낸 안내는 다시 띄우지 않는다. 재정렬·AI 동의 갱신은 보인 순간(claim), 나머지는 쓰거나 닫은 순간(complete)에 끝난다 */
  shouldShow(coachmark: Coachmark): boolean {
    return coachmark.completedAt == null;
  },
};
