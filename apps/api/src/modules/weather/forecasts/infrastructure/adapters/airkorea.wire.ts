import { z } from "zod";

/** 에어코리아 근접 측정소 목록. `items`가 깨져도 응답 전체를 버리지 않고 비어 있는 것으로 본다. */
export const airkoreaNearbyStationSchema = z.looseObject({
  response: z
    .looseObject({
      body: z
        .looseObject({
          items: z
            .array(z.looseObject({ stationName: z.string().nullish() }))
            .optional()
            .catch(undefined),
        })
        .optional(),
    })
    .optional(),
});

/** 에어코리아 측정소별 실시간 측정값. 값은 문자열이며 측정 없음은 빈 값 또는 "-"로 온다. */
export const airkoreaAirQualitySchema = z.looseObject({
  response: z
    .looseObject({
      body: z
        .looseObject({
          items: z
            .array(
              z.looseObject({ pm10Value: z.string().nullish(), pm25Value: z.string().nullish() }),
            )
            .optional()
            .catch(undefined),
        })
        .optional(),
    })
    .optional(),
});
