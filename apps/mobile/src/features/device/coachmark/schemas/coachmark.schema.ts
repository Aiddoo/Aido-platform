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
export type CoachmarkDisplay = z.infer<typeof coachmarkDisplaySchema>;
