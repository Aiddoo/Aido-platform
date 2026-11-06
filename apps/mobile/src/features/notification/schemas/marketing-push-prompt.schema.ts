import { z } from 'zod';

/**
 * 마케팅 푸시 옵트인 배너의 도배 방지 상태. 출시된 앱이 쓰던 JSON 모양 그대로다.
 * 날짜로 읽을 수 없는 값은 null로 바꿔 다시 보이게 한다(Invalid Date는 던지지 않고 NaN이라 정책이 조용히 틀린다)
 */
export const marketingPushPromptStateSchema = z.object({
  count: z.number(),
  lastPromptedAt: z
    .string()
    .nullable()
    .transform((value) =>
      value != null && !Number.isNaN(new Date(value).getTime()) ? value : null,
    ),
});
export type MarketingPushPromptState = z.infer<typeof marketingPushPromptStateSchema>;
