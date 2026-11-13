import type { CreateInquiryResponse } from '@aido/api';
import type { ErrorCodeType } from '@aido/api/errors';
import { ApiError } from '@src/core/errors/api-error';

function generateCreateInquiryResponseDto(): CreateInquiryResponse {
  return {
    message: '문의가 접수되었습니다.',
  };
}

export function createInquiryResponseDto(
  overrides?: Partial<CreateInquiryResponse>,
): CreateInquiryResponse {
  return {
    ...generateCreateInquiryResponseDto(),
    ...overrides,
  };
}

export function createInquiryApiError(
  overrides?: Partial<{ code: ErrorCodeType; message: string; status: number }>,
) {
  return new ApiError(
    overrides?.code ?? 'SYS_0001',
    overrides?.message ?? '문의 접수에 실패했습니다',
    overrides?.status ?? 500,
  );
}
