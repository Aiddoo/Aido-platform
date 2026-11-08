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

const coachmarkDisplaySchema = z.object({ openedAtMs: z.number() });
export type CoachmarkDisplay = z.infer<typeof coachmarkDisplaySchema>;

const COACHMARK_MIN_READ_MS = 2_000;

function isReadLongEnough(display: Pick<CoachmarkDisplay, 'openedAtMs'>, nowMs: number): boolean {
  return nowMs - display.openedAtMs >= COACHMARK_MIN_READ_MS;
}

export const CoachmarkPolicy = { isReadLongEnough } as const;
