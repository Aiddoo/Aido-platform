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
  thankedAt: z.date().nullable(),
  createdAt: z.date(),
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

export function getNudgeInteractionStatusFromFlags(
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
  lastThankedAt: z.date().nullable(),
});
export type NudgeThanksPreview = z.infer<typeof nudgeThanksPreviewSchema>;

const nudgeThanksSummaryStateSchema = z.enum(['NONE', 'PENDING', 'SENT', 'SENT_WITH_PENDING']);
type NudgeThanksSummaryState = z.infer<typeof nudgeThanksSummaryStateSchema>;

interface NudgeThanksSummary {
  state: NudgeThanksSummaryState;
  pendingRecipientCount: number;
}

function getNudgeInteractionStatus(
  nudge: Pick<NudgeInteraction, 'isAvailable' | 'isTodoCompleted' | 'replyKind' | 'thankedAt'>,
): NudgeInteractionStatus {
  return getNudgeInteractionStatusFromFlags(
    nudge.isAvailable,
    nudge.isTodoCompleted,
    nudge.replyKind != null,
    nudge.thankedAt != null,
  );
}

function isThankableTodo(
  todo: { completed: boolean; visibility: TodoVisibility },
  { isOwner }: { isOwner: boolean },
): boolean {
  return isOwner && todo.completed && todo.visibility === 'PUBLIC';
}

function isReceivedBy(nudge: Pick<NudgeInteraction, 'receiverId'>, userId: string): boolean {
  return nudge.receiverId === userId;
}

function isReplyable(
  nudge: Pick<NudgeInteraction, 'receiverId' | 'isAvailable'>,
  userId: string,
): boolean {
  return isReceivedBy(nudge, userId) && nudge.isAvailable;
}

function isThankable(preview: Pick<NudgeThanksPreview, 'throughNudgeId' | 'recipients'>): boolean {
  return preview.throughNudgeId != null && preview.recipients.length > 0;
}

function getThanksSummary(
  preview: Pick<
    NudgeThanksPreview,
    'throughNudgeId' | 'recipients' | 'totalRecipients' | 'thankedRecipientCount'
  >,
): NudgeThanksSummary {
  const pendingRecipientCount = isThankable(preview) ? preview.totalRecipients : 0;
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

export type NudgeResponseStage = 'unavailable' | 'reply' | 'thanksPrompt' | 'thanked' | 'status';

/**
 * 상세 화면이 응답 자리에 보일 단계. 받은 사람이 아직 끝나지 않은 할 일에 답할 수 있으면 답장이 먼저고,
 * 완료된 뒤에는 고맙다고 했는지로 가른다
 */
function getResponseStage(
  nudge: Pick<
    NudgeInteraction,
    'receiverId' | 'isAvailable' | 'isTodoCompleted' | 'replyKind' | 'thankedAt'
  >,
  userId: string,
): NudgeResponseStage {
  const status = getNudgeInteractionStatus(nudge);
  if (status === 'UNAVAILABLE') {
    return 'unavailable';
  }
  const isReceived = isReceivedBy(nudge, userId);
  if (isReceived && !nudge.isTodoCompleted && isReplyable(nudge, userId)) {
    return 'reply';
  }
  if (isReceived && nudge.isTodoCompleted) {
    return status === 'THANKED' ? 'thanked' : 'thanksPrompt';
  }

  return status === 'THANKED' ? 'thanked' : 'status';
}

export const NudgeInteractionPolicy = {
  getNudgeInteractionStatus,
  getResponseStage,
  isReceivedBy,
  isThankableTodo,
  isReplyable,
  isThankable,
  getThanksSummary,
} as const;
