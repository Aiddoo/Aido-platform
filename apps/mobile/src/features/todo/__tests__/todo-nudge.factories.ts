import type { CreateNudgeResponse, NudgeCooldownInfo, NudgeLimitInfo } from '@aido/validators';
import { ApiError } from '@src/shared/errors/api-error';

const generateNudgeLimitInfoDto = (): NudgeLimitInfo => ({
  dailyLimit: 5,
  usedToday: 2,
  remainingToday: 3,
  isUnlimited: false,
});

export const createNudgeLimitInfoDto = (overrides?: Partial<NudgeLimitInfo>): NudgeLimitInfo => ({
  ...generateNudgeLimitInfoDto(),
  ...overrides,
});

const generateNudgeCooldownInfoDto = (): NudgeCooldownInfo => ({
  canNudge: true,
  cooldownEndsAt: null,
  remainingSeconds: null,
});

export const createNudgeCooldownInfoDto = (
  overrides?: Partial<NudgeCooldownInfo>,
): NudgeCooldownInfo => ({
  ...generateNudgeCooldownInfoDto(),
  ...overrides,
});

const generateSendNudgeResponseDto = (): CreateNudgeResponse => ({
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

export const createSendNudgeResponseDto = (
  overrides?: Partial<CreateNudgeResponse>,
): CreateNudgeResponse => ({
  ...generateSendNudgeResponseDto(),
  ...overrides,
});

export const createNudgeApiError = (
  overrides?: Partial<{ code: string; message: string; status: number }>,
) =>
  new ApiError(
    overrides?.code ?? 'NUDGE_1101',
    overrides?.message ?? '일일 콕 찌르기 횟수를 초과했어요',
    overrides?.status ?? 400,
  );

export const INVALID_DTO = { invalid: 'data' };
