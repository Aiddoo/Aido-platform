import {
  createNudgeResponseSchema,
  nudgeCooldownInfoSchema,
  nudgeLimitInfoSchema,
  type CreateNudgeResponse,
  type NudgeCooldownInfo,
  type NudgeLimitInfo,
} from '@aido/api';
import { ApiError } from '@src/core/errors/api-error';

function generateNudgeLimitInfoDto(): NudgeLimitInfo {
  return {
    dailyLimit: 5,
    usedToday: 2,
    remainingToday: 3,
    isUnlimited: false,
  };
}

export function createNudgeLimitInfoDto(overrides?: Partial<NudgeLimitInfo>): NudgeLimitInfo {
  return nudgeLimitInfoSchema.parse({ ...generateNudgeLimitInfoDto(), ...overrides });
}

function generateNudgeCooldownInfoDto(): NudgeCooldownInfo {
  return {
    canNudge: true,
    cooldownEndsAt: null,
    remainingSeconds: null,
  };
}

export function createNudgeCooldownInfoDto(
  overrides?: Partial<NudgeCooldownInfo>,
): NudgeCooldownInfo {
  return nudgeCooldownInfoSchema.parse({ ...generateNudgeCooldownInfoDto(), ...overrides });
}

function generateSendNudgeResponseDto(): CreateNudgeResponse {
  return {
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
  };
}

export function createSendNudgeResponseDto(
  overrides?: Partial<CreateNudgeResponse>,
): CreateNudgeResponse {
  return createNudgeResponseSchema.parse({ ...generateSendNudgeResponseDto(), ...overrides });
}

export function createNudgeApiError(
  overrides?: Partial<{ code: string; message: string; status: number }>,
) {
  return new ApiError(
    overrides?.code ?? 'NUDGE_1101',
    overrides?.message ?? '일일 콕 찌르기 횟수를 초과했어요',
    overrides?.status ?? 400,
  );
}

export const INVALID_DTO = { invalid: 'data' };
