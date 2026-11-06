import { router, useLocalSearchParams } from 'expo-router';

import { inquiryScreenParamsSchema } from '../schemas/inquiry-params.schema';

/** 다른 화면에서 넘긴 분류·내용을 `[values, setValues]`로 읽는다. 없거나 잘못되면 기본값이다 */
export function useInquiryParams() {
  const values = inquiryScreenParamsSchema.parse(useLocalSearchParams());

  return [values, (next: Partial<typeof values>) => router.setParams(next)] as const;
}
