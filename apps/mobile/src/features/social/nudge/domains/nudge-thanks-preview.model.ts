import { instantSchema } from '@src/shared/date/instant';
import { cursorPageSchema } from '@src/shared/domains/cursor-page.model';
import { userSummarySchema } from '@src/shared/domains/user-summary.model';
import { match } from 'ts-pattern';
import { z } from 'zod';

// 이름을 정하지 않은 친구는 화면이 태그로 부른다
export type NudgeThanksRecipient = z.infer<typeof userSummarySchema>;

const nudgeThanksCursorSchema = z.object({ cursor: z.number(), throughNudgeId: z.number() });
export type NudgeThanksCursor = z.infer<typeof nudgeThanksCursorSchema>;

export const nudgeThanksPreviewSchema = cursorPageSchema(
  userSummarySchema,
  nudgeThanksCursorSchema,
).extend({
  todoId: z.number(),
  throughNudgeId: z.number().nullable(),
  totalRecipients: z.int().nonnegative(),
  thankedRecipientCount: z.int().nonnegative(),
  lastThankedAt: instantSchema.nullable(),
});
export type NudgeThanksPreview = z.infer<typeof nudgeThanksPreviewSchema>;

const nudgeThanksSummaryStateSchema = z.enum(['NONE', 'PENDING', 'SENT', 'SENT_WITH_PENDING']);
type NudgeThanksSummaryState = z.infer<typeof nudgeThanksSummaryStateSchema>;

interface NudgeThanksSummary {
  state: NudgeThanksSummaryState;
  pendingRecipientCount: number;
}

export const NudgeThanksPreviewPolicy = {
  hasThankableRecipients(preview: NudgeThanksPreview): boolean {
    return preview.throughNudgeId != null && preview.items.length > 0;
  },

  getThanksSummary(preview: NudgeThanksPreview): NudgeThanksSummary {
    const pendingRecipientCount = this.hasThankableRecipients(preview)
      ? preview.totalRecipients
      : 0;
    const state = match({
      hasPending: pendingRecipientCount > 0,
      hasThanked: preview.thankedRecipientCount > 0,
    })
      .returnType<NudgeThanksSummaryState>()
      .with({ hasPending: true, hasThanked: true }, () => 'SENT_WITH_PENDING')
      .with({ hasPending: true, hasThanked: false }, () => 'PENDING')
      .with({ hasPending: false, hasThanked: true }, () => 'SENT')
      .with({ hasPending: false, hasThanked: false }, () => 'NONE')
      .exhaustive();
    return { state, pendingRecipientCount };
  },
};
