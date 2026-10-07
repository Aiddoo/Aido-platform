import type {
  NudgeInteractionResponse,
  NudgeInteractionsResponse,
  NudgeThanksPreviewResponse,
} from '@aido/api';

import type {
  NudgeInteraction,
  NudgeInteractionPage,
  NudgeThanksPreview,
} from '../models/nudge-interaction.model';

export const toNudgeInteraction = (dto: NudgeInteractionResponse): NudgeInteraction => ({
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
  thankedAt: dto.thankedAt === null ? null : new Date(dto.thankedAt),
  createdAt: new Date(dto.createdAt),
  isAvailable: dto.isAvailable,
});

export const toNudgeInteractionPage = (dto: NudgeInteractionsResponse): NudgeInteractionPage => ({
  items: dto.items.map(toNudgeInteraction),
  nextCursor: dto.pagination.nextCursor,
  hasNext: dto.pagination.hasNext,
});

export const toNudgeThanksPreview = (dto: NudgeThanksPreviewResponse): NudgeThanksPreview => ({
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
});
