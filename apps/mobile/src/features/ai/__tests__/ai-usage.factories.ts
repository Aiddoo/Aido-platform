import type { AiUsageResponse } from '@aido/api';
import { ApiError } from '@src/shared/errors/api-error';

const generateAiUsageResponseDto = (): AiUsageResponse => ({
  success: true,
  data: {
    used: 3,
    limit: 10,
    resetsAt: '2026-03-09T00:00:00.000Z',
  },
});

export const createAiUsageResponseDto = (
  overrides?: Partial<AiUsageResponse>,
): AiUsageResponse => ({
  ...generateAiUsageResponseDto(),
  ...overrides,
});

export const createAiApiError = (
  overrides?: Partial<{ code: string; message: string; status: number }>,
) =>
  new ApiError(
    overrides?.code ?? 'AI_1303',
    overrides?.message ?? 'AI 사용량을 모두 사용했어요',
    overrides?.status ?? 403,
  );
