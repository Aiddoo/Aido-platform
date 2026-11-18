import { z } from "zod";

// 공공데이터포털 결과 코드. 00은 정상, 03(NODATA_ERROR)은 측정값 없음이고 그 밖(한도 초과·키 오류 등)은 호출 실패다
export const AIRKOREA_ANSWERED_RESULT_CODES: readonly string[] = ["00", "03"];

const headerSchema = z
  .looseObject({ resultCode: z.string().optional() })
  .optional()
  .catch(undefined);

/** 에어코리아 근접 측정소 목록. `items`가 깨져도 응답 전체를 버리지 않고 비어 있는 것으로 본다. */
export const airkoreaNearbyStationSchema = z.looseObject({
  response: z
    .looseObject({
      header: headerSchema,
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
      header: headerSchema,
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
