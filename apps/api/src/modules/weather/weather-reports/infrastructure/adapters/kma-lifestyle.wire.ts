import { z } from "zod";

/** 기상청 생활기상지수(자외선) 응답. `h0`은 요청 시각의 지수 문자열이다. */
export const kmaUvIndexSchema = z.looseObject({
  response: z
    .looseObject({
      header: z.looseObject({ resultCode: z.string().optional() }).optional(),
      body: z
        .looseObject({
          items: z
            .looseObject({ item: z.array(z.looseObject({ h0: z.string().nullish() })).optional() })
            .optional()
            .catch(undefined),
        })
        .optional(),
    })
    .optional(),
});
