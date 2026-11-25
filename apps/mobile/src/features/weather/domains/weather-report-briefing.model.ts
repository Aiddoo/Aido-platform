import { WEATHER_RESCHEDULE_REASONS } from '@aido/api/vocabulary';
import { type Instant, instantSchema, toEpochMs } from '@src/shared/date/instant';
import { z } from 'zod';

/** 서버가 고른 옮길 시각 후보 한 칸 */
export const weatherRescheduleOptionSchema = z.object({
  startsAt: instantSchema,
  precipitationChance: z.number(),
  apparentTemperature: z.number(),
  isRecommended: z.boolean(),
});
export type WeatherRescheduleOption = z.infer<typeof weatherRescheduleOptionSchema>;

/** 서버가 판단한 영향받는 할 일(시각 순)과 할 일별 옮길 시각 후보(첫 항목이 추천). reason이 null이면 영향받는 할 일이 없다 */
export const weatherReportBriefingSchema = z.object({
  reason: z.enum(WEATHER_RESCHEDULE_REASONS).nullable(),
  affectedTodoIds: z.array(z.int()),
  rescheduleOptions: z.array(
    z.object({ todoId: z.int(), options: z.array(weatherRescheduleOptionSchema) }),
  ),
});
export type WeatherReportBriefing = z.infer<typeof weatherReportBriefingSchema>;

/** 아직 지나지 않은 후보인가. 리포트를 받은 뒤 정시를 넘기면 지난 후보가 빠진다 */
export function filterByUpcomingOption(option: WeatherRescheduleOption, now: Instant): boolean {
  return toEpochMs(now) < toEpochMs(option.startsAt);
}

export const WeatherReportBriefingPolicy = {
  /** 그 할 일의 후보(서버 순서). 서버가 후보 줄을 주지 않은 할 일은 옮길 시각이 없는 것과 같아 빈 목록이다 */
  getOptions(briefing: WeatherReportBriefing, todoId: number) {
    return briefing.rescheduleOptions.find((entry) => entry.todoId === todoId)?.options ?? [];
  },

  /** 시트를 연 채 지난 선택을 바꿀 다음 후보. 서버 후보가 모두 지났으면 null이다. */
  findNextOption(
    briefing: WeatherReportBriefing,
    todoId: number,
    now: Instant,
  ): WeatherRescheduleOption | null {
    return (
      this.getOptions(briefing, todoId).find((option) => filterByUpcomingOption(option, now)) ??
      null
    );
  },
};
