import { INQUIRY_CATEGORY } from '@aido/api';
import { createHttpClientStub } from '@src/testing/core';

import {
  createInquiryApiError,
  createInquiryResponseDto,
  INVALID_DTO,
} from '../__tests__/inquiry.fixtures';
import { InquiryService } from './inquiry.service';

describe('InquiryService', () => {
  let httpClient: ReturnType<typeof createHttpClientStub>;
  let service: InquiryService;

  beforeEach(() => {
    httpClient = createHttpClientStub();
    service = new InquiryService(httpClient);
  });

  const input = {
    category: INQUIRY_CATEGORY.BUG_REPORT,
    content: '앱에서 할 일 추가 시 오류가 발생합니다.',
  } as const;

  describe('createInquiry', () => {
    it('서버 응답이 성공하면 InquiryResult 반환', async () => {
      // Given
      const dto = createInquiryResponseDto();
      httpClient.post.mockResolvedValue({ ok: true, value: dto });

      // When
      const result = await service.createInquiry(input);

      // Then
      expect(httpClient.post).toHaveBeenCalledWith('v1/inquiries', input);
      expect(result).toEqual({
        ok: true,
        value: { message: dto.message },
      });
    });

    it('HTTP 에러 → Result.err 반환', async () => {
      // Given
      const apiError = createInquiryApiError();
      httpClient.post.mockResolvedValue({ ok: false, error: apiError });

      // When
      const result = await service.createInquiry(input);

      // Then
      expect(result).toEqual({ ok: false, error: apiError });
    });

    it('Zod 검증 실패 → ParseError throw', async () => {
      // Given
      httpClient.post.mockResolvedValue({ ok: true, value: INVALID_DTO });

      // When
      const result = service.createInquiry(input);

      // Then
      await expect(result).rejects.toThrow('Invalid createInquiry response');
    });
  });
});
