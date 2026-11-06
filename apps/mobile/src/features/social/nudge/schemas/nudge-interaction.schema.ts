import {
  getNudgeInteractionsQuerySchema,
  nudgeReplyKindSchema,
  nudgeThanksPreviewResponseSchema,
} from '@aido/api';
import { instantSchema } from '@src/shared/date/instant';
import { z } from 'zod';

export const nudgeDirectionSchema = getNudgeInteractionsQuerySchema.shape.direction;
export type NudgeDirection = z.infer<typeof nudgeDirectionSchema>;

const nudgeInteractionSchema = z.object({
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
  thankedAt: instantSchema.nullable(),
  createdAt: instantSchema,
  isAvailable: z.boolean(),
});
export type NudgeInteraction = z.infer<typeof nudgeInteractionSchema>;

const nudgeInteractionPageSchema = z.object({
  items: z.array(nudgeInteractionSchema),
  nextCursor: z.number().nullable(),
  hasNext: z.boolean(),
});
export type NudgeInteractionPage = z.infer<typeof nudgeInteractionPageSchema>;

const nudgeInteractionStatusSchema = z.enum([
  'UNAVAILABLE',
  'THANKED',
  'COMPLETED',
  'REPLIED',
  'WAITING',
]);
export type NudgeInteractionStatus = z.infer<typeof nudgeInteractionStatusSchema>;

const nudgeThanksPreviewSchema = z.object({
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
  lastThankedAt: instantSchema.nullable(),
});
export type NudgeThanksPreview = z.infer<typeof nudgeThanksPreviewSchema>;

const nudgeThanksSummaryStateSchema = z.enum(['NONE', 'PENDING', 'SENT', 'SENT_WITH_PENDING']);
export type NudgeThanksSummaryState = z.infer<typeof nudgeThanksSummaryStateSchema>;
