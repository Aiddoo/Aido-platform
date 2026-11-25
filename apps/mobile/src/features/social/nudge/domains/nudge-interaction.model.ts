import { NUDGE_REPLY_KINDS } from '@aido/api/vocabulary';
import { instantSchema } from '@src/shared/date/instant';
import { cursorPageSchema } from '@src/shared/domains/cursor-page.model';
import { match } from 'ts-pattern';
import { z } from 'zod';

export const nudgeInteractionSchema = z.object({
  id: z.number(),
  senderId: z.string(),
  senderName: z.string().nullable(),
  senderUserTag: z.string(),
  senderProfileImage: z.string().nullable(),
  receiverId: z.string(),
  receiverName: z.string().nullable(),
  receiverUserTag: z.string(),
  receiverProfileImage: z.string().nullable(),
  todoId: z.number(),
  // 비공개 등으로 할 일에 접근할 수 없으면 제목·완료 여부 둘 다 null이다
  todoTitle: z.string().nullable(),
  isTodoCompleted: z.boolean().nullable(),
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

type NudgeResponseStage = 'unavailable' | 'reply' | 'thanksPrompt' | 'thanked' | 'status';

export const NudgeInteractionPolicy = {
  getNudgeInteractionStatus(nudge: NudgeInteraction): NudgeInteractionStatus {
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
  },

  isReceivedBy(nudge: NudgeInteraction, userId: string): boolean {
    return nudge.receiverId === userId;
  },

  // 받은 사람은 끝나지 않은 할 일이면 답장이 먼저고, 완료된 뒤에는 고맙다고 했는지로 가른다
  getResponseStage(nudge: NudgeInteraction, userId: string): NudgeResponseStage {
    const status = this.getNudgeInteractionStatus(nudge);
    if (status === 'UNAVAILABLE') {
      return 'unavailable';
    }
    const isReceived = this.isReceivedBy(nudge, userId);
    if (isReceived && !nudge.isTodoCompleted) {
      return 'reply';
    }
    if (isReceived && nudge.isTodoCompleted) {
      return status === 'THANKED' ? 'thanked' : 'thanksPrompt';
    }

    return status === 'THANKED' ? 'thanked' : 'status';
  },
};
