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

/** 화면에 뜬 안내. 언제 열렸는지(에포크 밀리초)만 안다 */
const coachmarkDisplaySchema = z.object({ openedAtMs: z.number() });
type CoachmarkDisplay = z.infer<typeof coachmarkDisplaySchema>;

/** 자동으로 뜬 안내를 읽었다고 볼 수 있는 시간. 이보다 빨리 대상을 옮기면 아직 보지 못한 것으로 둔다 */
const COACHMARK_MIN_READ_MS = 2_000;

function isReadLongEnough(display: CoachmarkDisplay, nowMs: number): boolean {
  return nowMs - display.openedAtMs >= COACHMARK_MIN_READ_MS;
}

export const CoachmarkPolicy = { isReadLongEnough } as const;
