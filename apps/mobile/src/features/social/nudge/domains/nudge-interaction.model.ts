import { NUDGE_REPLY_KINDS } from '@aido/api/vocabulary';
import type { Todo } from '@src/features/planning/todo/domains/todo.model';
import { instantSchema } from '@src/shared/date/instant';
import { cursorPageSchema } from '@src/shared/domains/cursor-page.model';
import { match } from 'ts-pattern';
import { z } from 'zod';

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
  replyKind: z.enum(NUDGE_REPLY_KINDS).nullable(),
  thankedAt: instantSchema.nullable(),
  createdAt: instantSchema,
  isAvailable: z.boolean(),
});
export type NudgeInteraction = z.infer<typeof nudgeInteractionSchema>;

const nudgeInteractionPageSchema = cursorPageSchema(nudgeInteractionSchema, z.number());
export type NudgeInteractionPage = z.infer<typeof nudgeInteractionPageSchema>;

const nudgeInteractionStatusSchema = z.enum([
  'UNAVAILABLE',
  'THANKED',
  'COMPLETED',
  'REPLIED',
  'WAITING',
]);
export type NudgeInteractionStatus = z.infer<typeof nudgeInteractionStatusSchema>;

const nudgeThanksRecipientSchema = z.object({
  id: z.string(),
  name: z.string(),
  profileImage: z.string().nullable(),
});
export type NudgeThanksRecipient = z.infer<typeof nudgeThanksRecipientSchema>;

const nudgeThanksCursorSchema = z.object({ cursor: z.number(), throughNudgeId: z.number() });
export type NudgeThanksCursor = z.infer<typeof nudgeThanksCursorSchema>;

export const nudgeThanksPreviewSchema = cursorPageSchema(
  nudgeThanksRecipientSchema,
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

export function getNudgeInteractionStatus(nudge: NudgeInteraction): NudgeInteractionStatus {
  return match({
    isAvailable: nudge.isAvailable,
    isTodoCompleted: nudge.isTodoCompleted,
    hasReply: nudge.replyKind != null,
    isThanked: nudge.thankedAt != null,
  })
    .returnType<NudgeInteractionStatus>()
    .with({ isAvailable: false }, () => 'UNAVAILABLE')
    .with({ isThanked: true }, () => 'THANKED')
    .with({ isTodoCompleted: true }, () => 'COMPLETED')
    .with({ hasReply: true }, () => 'REPLIED')
    .with({ hasReply: false }, () => 'WAITING')
    .exhaustive();
}

// 완료한 공개 할 일의 주인만 인사를 받는다. 할 일은 주인만 고칠 수 있어 수정 권한으로 주인을 안다
export function canThankTodo(todo: Todo, { canEditTodo }: { canEditTodo: boolean }): boolean {
  return canEditTodo && todo.completed && todo.visibility === 'PUBLIC';
}

export function isReceivedBy(nudge: NudgeInteraction, userId: string): boolean {
  return nudge.receiverId === userId;
}

export function hasThankableRecipients(preview: NudgeThanksPreview): boolean {
  return preview.throughNudgeId != null && preview.items.length > 0;
}

export function getThanksSummary(preview: NudgeThanksPreview): NudgeThanksSummary {
  const pendingRecipientCount = hasThankableRecipients(preview) ? preview.totalRecipients : 0;
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

type NudgeResponseStage = 'unavailable' | 'reply' | 'thanksPrompt' | 'thanked' | 'status';

// 받은 사람은 끝나지 않은 할 일이면 답장이 먼저고, 완료된 뒤에는 고맙다고 했는지로 가른다
export function getResponseStage(nudge: NudgeInteraction, userId: string): NudgeResponseStage {
  const status = getNudgeInteractionStatus(nudge);
  if (status === 'UNAVAILABLE') {
    return 'unavailable';
  }
  const isReceived = isReceivedBy(nudge, userId);
  if (isReceived && !nudge.isTodoCompleted) {
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
} as const;

export const NudgeThanksPreviewPolicy = {
  hasThankableRecipients,
  getThanksSummary,
} as const;

export const TodoThanksPolicy = {
  canThankTodo,
} as const;
