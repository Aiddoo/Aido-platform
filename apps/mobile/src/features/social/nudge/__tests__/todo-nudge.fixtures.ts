import { createNudgeResponseSchema, nudgeCooldownInfoSchema } from '@aido/api/contracts/nudge/v1';
import type { ErrorCodeType } from '@aido/api/errors';
import { createApiError } from '@src/testing/api-error';
import { defineFixture } from '@src/testing/fixture';

export const createNudgeCooldownInfoDto = defineFixture(nudgeCooldownInfoSchema, {
  canNudge: true,
  cooldownEndsAt: null,
  remainingSeconds: null,
});

export const createSendNudgeResponseDto = defineFixture(createNudgeResponseSchema, {
  message: '콕 찔렀어요!',
  nudge: {
    id: 1,
    senderId: 'clz7x5p8k0001qz0z8z8z8z8z',
    receiverId: 'clz7x5p8k0005qz0z8z8z8z8z',
    todoId: 1,
    message: '힘내!',
    createdAt: '2026-03-08T10:00:00.000Z',
    readAt: null,
  },
});

export function createNudgeApiError(
  overrides?: Partial<{ code: ErrorCodeType; message: string; status: number }>,
) {
  return createApiError(overrides?.code ?? 'NUDGE_1101', {
    message: overrides?.message ?? '일일 콕 찌르기 횟수를 초과했어요',
    status: overrides?.status ?? 400,
  });
}
