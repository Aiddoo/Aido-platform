import { nudgeInteractionResponseSchema } from '@aido/api/contracts/nudge/v1';
import { defineFixture } from '@src/testing/fixture';

import {
  nudgeInteractionSchema,
  nudgeThanksPreviewSchema,
} from '../domains/nudge-interaction.model';
import { createSendNudgeResponseDto } from './todo-nudge.fixtures';

export const createNudgeInteractionDto = defineFixture(nudgeInteractionResponseSchema, {
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
});

export const createNudgeInteraction = defineFixture(nudgeInteractionSchema, {
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
  createdAt: '2026-03-01T00:00:00.000Z',
  isAvailable: true,
});

export const createNudgeThanksPreview = defineFixture(nudgeThanksPreviewSchema, {
  todoId: 1,
  throughNudgeId: 1,
  totalRecipients: 0,
  nextCursor: null,
  items: [],
  thankedRecipientCount: 0,
  lastThankedAt: null,
});
