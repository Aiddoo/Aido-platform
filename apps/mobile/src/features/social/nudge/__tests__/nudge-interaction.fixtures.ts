import { nudgeInteractionResponseSchema, type NudgeInteractionResponse } from '@aido/api';
import { toInstant } from '@src/shared/date/instant';

import {
  type NudgeInteraction,
  nudgeInteractionSchema,
  type NudgeThanksPreview,
  nudgeThanksPreviewSchema,
} from '../domains/nudge-interaction.model';
import { createSendNudgeResponseDto } from './todo-nudge.fixtures';

export function createNudgeInteractionDto(
  overrides: Partial<NudgeInteractionResponse> = {},
): NudgeInteractionResponse {
  return nudgeInteractionResponseSchema.parse({
    ...createSendNudgeResponseDto().nudge,
    sender: {
      id: 'clz7x5p8k0001qz0z8z8z8z8z',
      userTag: 'SENDER01',
      name: '응원냥',
      profileImage: null,
    },
    receiver: {
      id: 'clz7x5p8k0005qz0z8z8z8z8z',
      userTag: 'RECV0001',
      name: '시작냥',
      profileImage: null,
    },
    todo: { id: 1, title: '산책하기', completed: false },
    replyKind: null,
    repliedAt: null,
    replyUpdatedAt: null,
    thankedAt: null,
    isAvailable: true,
    ...overrides,
  });
}

export function createNudgeInteraction(
  overrides: Partial<NudgeInteraction> = {},
): NudgeInteraction {
  return nudgeInteractionSchema.parse({
    id: 1,
    senderId: 'clz7x5p8k0001qz0z8z8z8z8z',
    senderName: '응원냥',
    senderProfileImage: null,
    receiverId: 'clz7x5p8k0005qz0z8z8z8z8z',
    receiverName: '시작냥',
    receiverProfileImage: null,
    todoId: 1,
    todoTitle: '산책하기',
    isTodoCompleted: false,
    message: null,
    replyKind: null,
    thankedAt: null,
    createdAt: toInstant('2026-03-01T00:00:00.000Z'),
    isAvailable: true,
    ...overrides,
  });
}

export function createNudgeThanksPreview(
  overrides: Partial<NudgeThanksPreview> = {},
): NudgeThanksPreview {
  return nudgeThanksPreviewSchema.parse({
    todoId: 1,
    throughNudgeId: 1,
    totalRecipients: 0,
    nextCursor: null,
    hasNext: false,
    recipients: [],
    thankedRecipientCount: 0,
    lastThankedAt: null,
    ...overrides,
  });
}
