import { useLocalSearchParams } from 'expo-router';

import { inquiryScreenParamsSchema } from '../schemas/inquiry-params.schema';

/** 다른 화면에서 넘긴 분류·내용으로 문의 폼을 미리 채운다. 없거나 잘못되면 기본값이다 */
export function useInquiryParams() {
  return inquiryScreenParamsSchema.parse(useLocalSearchParams());
}
