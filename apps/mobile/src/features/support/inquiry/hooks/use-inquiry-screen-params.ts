import { INQUIRY_CATEGORY, INQUIRY_CONTENT_LIMITS } from '@aido/api';
import { useLocalSearchParams } from 'expo-router';
import { z } from 'zod';

export const inquiryScreenParamsSchema = z.object({
  category: z.enum(INQUIRY_CATEGORY).catch(INQUIRY_CATEGORY.BUG_REPORT),
  content: z.string().max(INQUIRY_CONTENT_LIMITS.MAX_LENGTH).catch(''),
});

/** 다른 화면에서 넘긴 분류·내용으로 문의 폼을 미리 채운다. 없거나 잘못되면 기본값이다 */
export function useInquiryScreenParams() {
  return inquiryScreenParamsSchema.parse(useLocalSearchParams());
}
