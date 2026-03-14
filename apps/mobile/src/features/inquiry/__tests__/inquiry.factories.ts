import type { CreateInquiryResponse } from '@aido/validators';
import { ApiError } from '@src/shared/errors/api-error';

const generateCreateInquiryResponseDto = (): CreateInquiryResponse => ({
  message: '문의가 접수되었습니다.',
});

export const createInquiryResponseDto = (
  overrides?: Partial<CreateInquiryResponse>,
): CreateInquiryResponse => ({
  ...generateCreateInquiryResponseDto(),
  ...overrides,
});

export const createInquiryApiError = (
  overrides?: Partial<{ code: string; message: string; status: number }>,
) =>
  new ApiError(
    overrides?.code ?? 'INQUIRY_FAILED',
    overrides?.message ?? '문의 접수에 실패했습니다',
    overrides?.status ?? 500,
  );

export const INVALID_DTO = { invalid: 'data' };
