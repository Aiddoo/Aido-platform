import type {
  NudgeInteractionResponse,
  NudgeInteractionsResponse,
} from '@aido/api/contracts/nudge/v1';
import { toInstant, toNullableInstant } from '@src/shared/date/instant';
import { pick } from 'es-toolkit';

import type { NudgeInteraction, NudgeInteractionPage } from '../domains/nudge-interaction.model';
import type { NudgeThanksCursor, NudgeThanksPreview } from '../domains/nudge-thanks-preview.model';
import type { NudgeThanksPreviewEnvelope } from '../schemas/nudge-response.schema';

export function toNudgeInteraction(dto: NudgeInteractionResponse): NudgeInteraction {
  return {
    id: dto.id,
    senderId: dto.sender.id,
    senderName: dto.sender.name,
    senderUserTag: dto.sender.userTag,
    senderProfileImage: dto.sender.profileImage,
    receiverId: dto.receiver.id,
    receiverName: dto.receiver.name,
    receiverUserTag: dto.receiver.userTag,
    receiverProfileImage: dto.receiver.profileImage,
    todoId: dto.todoId,
    todoTitle: dto.todo?.title ?? null,
    isTodoCompleted: dto.todo?.completed ?? null,
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
    nextCursor: dto.pagination.hasNext ? dto.pagination.nextCursor : null,
  };
}

function toNudgeThanksCursor({
  hasNext,
  nextCursor,
  throughNudgeId,
}: NudgeThanksPreviewEnvelope): NudgeThanksCursor | null {
  if (!hasNext || nextCursor == null || throughNudgeId == null) {
    return null;
  }
  return { cursor: nextCursor, throughNudgeId };
}

export function toNudgeThanksPreview(dto: NudgeThanksPreviewEnvelope): NudgeThanksPreview {
  return {
    todoId: dto.todoId,
    throughNudgeId: dto.throughNudgeId,
    totalRecipients: dto.totalRecipients ?? dto.recipients.length,
    nextCursor: toNudgeThanksCursor(dto),
    items: dto.recipients.map((recipient) =>
      pick(recipient, ['id', 'name', 'userTag', 'profileImage']),
    ),
    thankedRecipientCount: dto.thankedRecipientCount,
    lastThankedAt: toNullableInstant(dto.lastThankedAt),
  };
}
