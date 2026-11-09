import { z } from "zod";

/** 형식이 틀린 웹훅도 어떤 이벤트였는지는 로그에 남긴다. */
export const revenueCatEventTypeSchema = z.looseObject({
  event: z.looseObject({ type: z.string() }),
});

const optionalText = z.string().min(1).optional().catch(undefined);
const attributeText = z
  .looseObject({ value: z.string().min(1) })
  .transform((attribute) => attribute.value)
  .optional()
  .catch(undefined);

/** 운영 알림에만 보여 주는 부가 정보. 형식이 다르면 그 필드만 버리고 처리는 막지 않는다. */
export const revenueCatEventDetailsSchema = z.looseObject({
  country_code: optionalText,
  subscriber_attributes: z
    .looseObject({ appVersion: attributeText, deviceModel: attributeText })
    .optional()
    .catch(undefined),
});

/** Test Store 구매는 실제 결제가 없다. 형식이 틀려도 Test Store면 처리하지 않을 수 있게 store만 먼저 본다. */
export const revenueCatTestStoreEventSchema = z.looseObject({
  event: z.looseObject({
    store: z.literal("TEST_STORE"),
    type: optionalText,
    id: optionalText,
  }),
});
