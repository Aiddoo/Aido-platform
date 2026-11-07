import { useLocalSearchParams } from 'expo-router';

import { inquiryParamsSchema } from '../schemas/inquiry-params.schema';

/** 다른 화면에서 넘긴 분류·내용을 읽는다. 쓰는 곳이 없어 세터를 두지 않는다. 없거나 잘못되면 기본값이다 */
export function useInquiryParams() {
  return inquiryParamsSchema.parse(useLocalSearchParams());
}
