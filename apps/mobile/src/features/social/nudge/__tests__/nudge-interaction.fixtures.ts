import {
  nudgeInteractionResponseSchema,
  nudgeThanksPreviewResponseSchema,
} from '@aido/api/contracts/nudge/v1';
import { defineFixture } from '@src/testing/fixture';

import { nudgeInteractionSchema } from '../domains/nudge-interaction.model';
import { nudgeThanksPreviewSchema } from '../domains/nudge-thanks-preview.model';
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
  senderUserTag: 'SENDER01',
  senderProfileImage: null,
  receiverId: 'clz7x5p8k0005qz0z8z8z8z8z',
  receiverName: '시작냥',
  receiverUserTag: 'RECV0001',
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

/** 고마움을 전할 친구가 없고 전한 적도 없는 감사 현황. 친구는 `createNudgeThanksRecipientDtos`로 채운다 */
export const createNudgeThanksPreviewDto = defineFixture(nudgeThanksPreviewResponseSchema, {
  todoId: 1,
  throughNudgeId: null,
  recipients: [],
  totalRecipients: 0,
  nextCursor: null,
  hasNext: false,
  thankedRecipientCount: 0,
  lastThankedAt: null,
});

export function createNudgeThanksRecipientDtos(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `clz7x5p8k001${index}qz0z8z8z8z8z`,
    userTag: `THANK00${index}`,
    name: `고마운친구${index}`,
    profileImage: null,
  }));
}

export const createNudgeThanksPreview = defineFixture(nudgeThanksPreviewSchema, {
  todoId: 1,
  throughNudgeId: 1,
  totalRecipients: 0,
  nextCursor: null,
  items: [],
  thankedRecipientCount: 0,
  lastThankedAt: null,
});
