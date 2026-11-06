import type { NudgeInteractionResponse } from '@aido/api';

import { createSendNudgeResponseDto } from './todo-nudge.factories';

export const createNudgeInteractionDto = (
  overrides: Partial<NudgeInteractionResponse> = {},
): NudgeInteractionResponse => ({
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
