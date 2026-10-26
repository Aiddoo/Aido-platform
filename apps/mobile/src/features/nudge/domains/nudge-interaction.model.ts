import {
  getNudgeInteractionsQuerySchema,
  nudgeReplyKindSchema,
  nudgeThanksPreviewResponseSchema,
  type TodoVisibility,
} from '@aido/api';
import { match } from 'ts-pattern';
import { z } from 'zod';

export const nudgeDirectionSchema = getNudgeInteractionsQuerySchema.shape.direction;
export type NudgeDirection = z.infer<typeof nudgeDirectionSchema>;

export const nudgeInteractionSchema = z.object({
  id: z.number(),
  senderId: z.string(),
  senderName: z.string(),
  senderProfileImage: z.string().nullable(),
  receiverId: z.string(),
  receiverName: z.string(),
  receiverProfileImage: z.string().nullable(),
  todoId: z.number(),
  todoTitle: z.string().nullable(),
  isTodoCompleted: z.boolean(),
  message: z.string().nullable(),
  replyKind: nudgeReplyKindSchema.nullable(),
  thankedAt: z.date().nullable(),
  createdAt: z.date(),
  isAvailable: z.boolean(),
});
export type NudgeInteraction = z.infer<typeof nudgeInteractionSchema>;

export const nudgeInteractionPageSchema = z.object({
  items: z.array(nudgeInteractionSchema),
  nextCursor: z.number().nullable(),
  hasNext: z.boolean(),
});
export type NudgeInteractionPage = z.infer<typeof nudgeInteractionPageSchema>;

export const nudgeInteractionStatusSchema = z.enum([
  'UNAVAILABLE',
  'THANKED',
  'COMPLETED',
  'REPLIED',
  'WAITING',
]);
export type NudgeInteractionStatus = z.infer<typeof nudgeInteractionStatusSchema>;

export function getNudgeInteractionStatus(
  isAvailable: boolean,
  isTodoCompleted: boolean,
  hasReply: boolean,
  isThanked: boolean,
): NudgeInteractionStatus {
  return match({ isAvailable, isTodoCompleted, hasReply, isThanked })
    .returnType<NudgeInteractionStatus>()
    .with({ isAvailable: false }, () => 'UNAVAILABLE')
    .with({ isThanked: true }, () => 'THANKED')
    .with({ isTodoCompleted: true }, () => 'COMPLETED')
    .with({ hasReply: true }, () => 'REPLIED')
    .with({ hasReply: false }, () => 'WAITING')
    .exhaustive();
}

export const nudgeThanksPreviewSchema = z.object({
  todoId: z.number(),
  throughNudgeId: z.number().nullable(),
  totalRecipients: z.number().int().nonnegative(),
  nextCursor: z.number().nullable(),
  hasNext: z.boolean(),
  recipients: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      profileImage: z.string().nullable(),
    }),
  ),
  thankedRecipientCount: nudgeThanksPreviewResponseSchema.shape.thankedRecipientCount.unwrap(),
  lastThankedAt: z.date().nullable(),
});
export type NudgeThanksPreview = z.infer<typeof nudgeThanksPreviewSchema>;

export const nudgeThanksSummaryStateSchema = z.enum([
  'NONE',
  'PENDING',
  'SENT',
  'SENT_WITH_PENDING',
]);
export type NudgeThanksSummaryState = z.infer<typeof nudgeThanksSummaryStateSchema>;

export interface NudgeThanksSummary {
  state: NudgeThanksSummaryState;
  pendingRecipientCount: number;
}

export function getNudgeInteractionStatusOf(
  nudge: Pick<NudgeInteraction, 'isAvailable' | 'isTodoCompleted' | 'replyKind' | 'thankedAt'>,
): NudgeInteractionStatus {
  return getNudgeInteractionStatus(
    nudge.isAvailable,
    nudge.isTodoCompleted,
    nudge.replyKind != null,
    nudge.thankedAt != null,
  );
}

export function isThankableTodo(
  todo: { completed: boolean; visibility: TodoVisibility },
  { isOwner }: { isOwner: boolean },
): boolean {
  return isOwner && todo.completed && todo.visibility === 'PUBLIC';
}

export function isReplyableNudge(
  nudge: Pick<NudgeInteraction, 'receiverId' | 'isAvailable'>,
  currentUserId: string,
): boolean {
  return nudge.receiverId === currentUserId && nudge.isAvailable;
}

export function isThankablePreview(
  preview: Pick<NudgeThanksPreview, 'throughNudgeId' | 'recipients'>,
): boolean {
  return preview.throughNudgeId != null && preview.recipients.length > 0;
}

export function getNudgeThanksSummary(
  preview: Pick<
    NudgeThanksPreview,
    'throughNudgeId' | 'recipients' | 'totalRecipients' | 'thankedRecipientCount'
  >,
): NudgeThanksSummary {
  const pendingRecipientCount = isThankablePreview(preview) ? preview.totalRecipients : 0;
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
}

export const NudgeInteractionPolicy = {
  getStatus: getNudgeInteractionStatusOf,
  isThankableTodo,
  isReplyable: isReplyableNudge,
  isThankable: isThankablePreview,
  getThanksSummary: getNudgeThanksSummary,
} as const;
