import type { CreateInquiryResponse } from '@aido/api';

import type { InquiryResult } from '../schemas/inquiry.schema';

export function toInquiryResult(dto: CreateInquiryResponse): InquiryResult {
  return { message: dto.message };
}
