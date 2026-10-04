import { getNudgeInteractionsQuerySchema, nudgeReplyKindSchema } from '@aido/validators';
import { match } from 'ts-pattern';
import { z } from 'zod';

import type { TodoItem } from './todo.model';

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
  recipients: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      profileImage: z.string().nullable(),
    }),
  ),
});
export type NudgeThanksPreview = z.infer<typeof nudgeThanksPreviewSchema>;

export const NudgeInteractionPolicy = {
  getStatus: (
    nudge: Pick<NudgeInteraction, 'isAvailable' | 'isTodoCompleted' | 'replyKind' | 'thankedAt'>,
  ): NudgeInteractionStatus =>
    getNudgeInteractionStatus(
      nudge.isAvailable,
      nudge.isTodoCompleted,
      nudge.replyKind !== null,
      nudge.thankedAt !== null,
    ),
  isThankableTodo: (
    todo: Pick<TodoItem, 'completed' | 'visibility'>,
    { isOwner }: { isOwner: boolean },
  ): boolean => isOwner && todo.completed && todo.visibility === 'PUBLIC',
  isReplyable: (
    nudge: Pick<NudgeInteraction, 'receiverId' | 'isAvailable'>,
    currentUserId: string,
  ): boolean => nudge.receiverId === currentUserId && nudge.isAvailable,
  isThankable: (preview: Pick<NudgeThanksPreview, 'throughNudgeId' | 'recipients'>): boolean =>
    preview.throughNudgeId !== null && preview.recipients.length > 0,
};
