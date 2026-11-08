import type {
  NudgeInteractionResponse,
  NudgeInteractionsResponse,
  NudgeThanksPreviewResponse,
} from '@aido/api';
import { toInstant, toNullableInstant } from '@src/shared/date/instant';

import type {
  NudgeInteraction,
  NudgeInteractionPage,
  NudgeThanksPreview,
} from '../domains/nudge-interaction.model';

export function toNudgeInteraction(dto: NudgeInteractionResponse): NudgeInteraction {
  return {
    id: dto.id,
    senderId: dto.sender.id,
    senderName: dto.sender.name ?? dto.sender.userTag,
    senderProfileImage: dto.sender.profileImage,
    receiverId: dto.receiver.id,
    receiverName: dto.receiver.name ?? dto.receiver.userTag,
    receiverProfileImage: dto.receiver.profileImage,
    todoId: dto.todoId,
    todoTitle: dto.todo?.title ?? null,
    isTodoCompleted: dto.todo?.completed ?? false,
    message: dto.message,
    replyKind: dto.replyKind,
    thankedAt: toNullableInstant(dto.thankedAt),
    createdAt: toInstant(dto.createdAt),
    isAvailable: dto.isAvailable,
  };
}

export function toNudgeInteractionPage(dto: NudgeInteractionsResponse): NudgeInteractionPage {
  return {
    items: dto.items.map(toNudgeInteraction),
    nextCursor: dto.pagination.nextCursor,
    hasNext: dto.pagination.hasNext,
  };
}

export function toNudgeThanksPreview(dto: NudgeThanksPreviewResponse): NudgeThanksPreview {
  return {
    todoId: dto.todoId,
    throughNudgeId: dto.throughNudgeId,
    totalRecipients: dto.totalRecipients ?? dto.recipients.length,
    nextCursor: dto.nextCursor ?? null,
    hasNext: dto.hasNext ?? false,
    recipients: dto.recipients.map((recipient) => ({
      id: recipient.id,
      name: recipient.name ?? recipient.userTag,
      profileImage: recipient.profileImage,
    })),
    thankedRecipientCount: dto.thankedRecipientCount ?? 0,
    lastThankedAt: toNullableInstant(dto.lastThankedAt ?? null),
  };
}
