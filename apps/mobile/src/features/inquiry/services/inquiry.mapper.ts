import type { CreateInquiryResponse } from '@aido/api';

import type { InquiryResult } from '../models/inquiry.model';

export const toInquiryResult = (dto: CreateInquiryResponse): InquiryResult => ({
  message: dto.message,
});
