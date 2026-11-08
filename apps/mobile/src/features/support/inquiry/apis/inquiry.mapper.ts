import type { CreateInquiryResponse } from '@aido/api';

import type { InquiryResult } from '../domains/inquiry.model';

export function toInquiryResult(dto: CreateInquiryResponse): InquiryResult {
  return { message: dto.message };
}
