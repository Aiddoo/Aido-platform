import { createInquiryResponseSchema } from '@aido/api/contracts/inquiry/v1';
import type { ErrorCodeType } from '@aido/api/errors';
import { createApiError } from '@src/testing/api-error';
import { defineFixture } from '@src/testing/fixture';

export const createInquiryResponseDto = defineFixture(createInquiryResponseSchema, {
  message: '문의가 접수되었습니다.',
});

export function createInquiryApiError(
  overrides?: Partial<{ code: ErrorCodeType; message: string; status: number }>,
) {
  return createApiError(overrides?.code ?? 'SYS_0001', {
    message: overrides?.message ?? '문의 접수에 실패했습니다',
    status: overrides?.status ?? 500,
  });
}
