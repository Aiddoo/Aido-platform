import { z } from "zod";

/** 한국천문연구원 지역별 출몰시각. 시각은 "HHmm" 문자열이다. */
export const kasiSunTimeSchema = z.looseObject({
  response: z
    .looseObject({
      header: z.looseObject({ resultCode: z.string().optional() }).optional(),
      body: z
        .looseObject({
          items: z
            .looseObject({
              item: z
                .looseObject({ sunrise: z.string().optional(), sunset: z.string().optional() })
                .nullish(),
            })
            .optional()
            .catch(undefined),
        })
        .optional(),
    })
    .optional(),
});
