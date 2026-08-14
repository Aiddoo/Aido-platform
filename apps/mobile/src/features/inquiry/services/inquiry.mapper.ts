import type { CreateInquiryResponse } from '@aido/validators';

import type { InquiryResult } from '../models/inquiry.model';

export const toInquiryResult = (dto: CreateInquiryResponse): InquiryResult => ({
  message: dto.message,
});
