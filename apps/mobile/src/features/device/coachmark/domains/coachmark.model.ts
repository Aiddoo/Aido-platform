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
type Coachmark = z.infer<typeof coachmarkSchema>;

/** 화면에 뜬 안내. 언제 열렸는지(에포크 밀리초)만 안다 */
const coachmarkDisplaySchema = z.object({ openedAtMs: z.number() });
type CoachmarkDisplay = z.infer<typeof coachmarkDisplaySchema>;

/** 자동으로 뜬 안내를 읽었다고 볼 수 있는 시간. 이보다 빨리 대상을 옮기면 아직 보지 못한 것으로 둔다 */
const COACHMARK_MIN_READ_MS = 2_000;

/**
 * 한 번 끝낸 안내는 기간 없이 다시 띄우지 않는다. 끝나는 순간은 종류마다 다르다.
 * 재정렬·AI 동의 갱신은 보인 순간(claim), 나머지는 쓰거나 닫은 순간(complete)이다
 */
function shouldShow(coachmark: Coachmark): boolean {
  return coachmark.completedAt == null;
}

function isReadLongEnough(display: CoachmarkDisplay, nowMs: number): boolean {
  return nowMs - display.openedAtMs >= COACHMARK_MIN_READ_MS;
}

export const CoachmarkPolicy = { shouldShow, isReadLongEnough } as const;
