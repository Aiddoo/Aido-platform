import { WEATHER_AIR_QUALITY_SOURCES } from '@aido/api/vocabulary';
import { z } from 'zod';

/** 대기질(μg/m³). 그 물질을 재지 않는 지역은 값이 null이다 */
export const airQualitySchema = z.object({
  pm10: z.number().nullable(),
  pm25: z.number().nullable(),
  source: z.enum(WEATHER_AIR_QUALITY_SOURCES),
});
export type AirQuality = z.infer<typeof airQualitySchema>;

export type AirPollutant = 'pm10' | 'pm25';

export type AirQualityGrade = 'good' | 'moderate' | 'bad' | 'veryBad';

/** 좋음·보통·나쁨의 상한. 넘으면 매우 나쁨이다 */
type PollutantUpperBounds = readonly [good: number, moderate: number, bad: number];

/** 환경부 통합 예보 기준 (μg/m³). 각 값 이하가 해당 등급이다 */
const POLLUTANT_UPPER_BOUNDS = {
  pm10: [30, 80, 150],
  pm25: [15, 35, 75],
} as const satisfies Record<AirPollutant, PollutantUpperBounds>;

/** 등급을 나누는 경계. 대기질 막대 눈금도 같은 경계로 나눈다 */
export function getPollutantUpperBounds(pollutant: AirPollutant): PollutantUpperBounds {
  return POLLUTANT_UPPER_BOUNDS[pollutant];
}

export const AirQualityPolicy = {
  /** 오염 물질 하나의 등급. 그 물질의 값이 없으면 null이다. */
  findPollutantGrade(airQuality: AirQuality, pollutant: AirPollutant): AirQualityGrade | null {
    const value = airQuality[pollutant];
    if (value == null) {
      return null;
    }
    const [good, moderate, bad] = POLLUTANT_UPPER_BOUNDS[pollutant];
    if (value <= good) {
      return 'good';
    }
    if (value <= moderate) {
      return 'moderate';
    }
    return value <= bad ? 'bad' : 'veryBad';
  },
};
