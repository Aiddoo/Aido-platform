import type { CreateInquiryResponse } from '@aido/api/contracts/inquiry/v1';

import type { InquiryResult } from '../domains/inquiry.model';

export function toInquiryResult(dto: CreateInquiryResponse): InquiryResult {
  return { message: dto.message };
}
