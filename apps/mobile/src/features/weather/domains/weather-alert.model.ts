import { WEATHER_ALERT_SEVERITIES } from '@aido/api/vocabulary';
import { type Instant, instantSchema, toEpochMs } from '@src/shared/date/instant';
import { z } from 'zod';

/** 기상 특보 한 건. 발효 전에 받을 수도 있다 */
export const weatherAlertSchema = z.object({
  id: z.string(),
  title: z.string(),
  severity: z.enum(WEATHER_ALERT_SEVERITIES),
  source: z.string(),
  areaName: z.string().nullable(),
  effectiveAt: instantSchema,
  expiresAt: instantSchema,
  detailsUrl: z.string(),
});
export type WeatherAlert = z.infer<typeof weatherAlertSchema>;

export const WeatherAlertPolicy = {
  isInEffect(alert: WeatherAlert, now: Instant) {
    return toEpochMs(alert.effectiveAt) <= toEpochMs(now);
  },

  /** 서버가 심각도 순으로 보내므로 순서는 두고 만료된 특보만 뺀다. 발효 전 특보는 미리 알도록 남긴다 */
  getActive(alerts: readonly WeatherAlert[], now: Instant) {
    return alerts.filter((alert) => toEpochMs(now) < toEpochMs(alert.expiresAt));
  },
};
