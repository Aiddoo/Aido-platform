import type { WeatherPrecipitationType } from '@aido/api/vocabulary';
import { formatClockTime, formatInstantHour, type TimeFormat } from '@src/shared/date/date-format';
import { type Instant } from '@src/shared/date/instant';
import { useTranslation } from '@src/shared/i18n';
import { match } from 'ts-pattern';

import { PRECIPITATION_SUBJECT_LABEL_KEYS } from '../constants/weather-labels';
import {
  type PrecipitationPrecision,
  type PrecipitationWindow,
  WeatherReportPolicy,
} from '../domains/weather-report.model';
import { useLocalTimeLabel, useLocationDateFormat } from './use-location-date-format';

export interface PrecipitationMessage {
  headline: string;
  detail: string | null;
}

/**
 * 강수 구간을 "17분 뒤 비가 시작돼요 / 7시쯤 그쳐요"처럼 위치 시간대의 문장으로 바꾼다.
 * 분 단위 예보에서 온 시각은 분까지, 시간별 예보에서 온 시각은 정시로 말한다.
 * 위치 벽시계가 기기와 다르면 시각에 '현지'를 붙인다.
 */
export function usePrecipitationMessage({
  timeZone,
  timeFormat,
  now,
}: {
  timeZone: string;
  timeFormat: TimeFormat;
  now: Date;
}) {
  const { t } = useTranslation('weather');
  const dateFormat = useLocationDateFormat(timeZone);
  const localTime = useLocalTimeLabel(timeZone, now);

  const formatMoment = (date: Instant, precision: PrecipitationPrecision) =>
    localTime(
      match(precision)
        .with('minute', () => formatClockTime(date, timeFormat, dateFormat))
        .with('hour', () => formatInstantHour(date, timeFormat, dateFormat))
        .exhaustive(),
    );

  /** 공급자가 형태 없이 강수라고만 알리면(null) 비와 눈을 함께 말한다. */
  const toSubject = (type: WeatherPrecipitationType | null) =>
    t(PRECIPITATION_SUBJECT_LABEL_KEYS[type ?? 'MIXED']);

  const describeEnd = (wet: Exclude<PrecipitationWindow, { kind: 'dry' }>) => {
    if (wet.endsAt == null) {
      return t('nextHour.continues');
    }
    const time = formatMoment(wet.endsAt, wet.endPrecision);
    return wet.endsOnLaterDay
      ? t('nextHour.endsAroundTomorrow', { time })
      : t('nextHour.endsAround', { time });
  };

  return (window: PrecipitationWindow): PrecipitationMessage =>
    match(window)
      .with({ kind: 'dry' }, () => ({ headline: t('nextHour.dry'), detail: null }))
      .with({ kind: 'ongoing' }, (wet) => ({
        headline: t('nextHour.ongoing', {
          subject: toSubject(wet.precipitationType),
        }),
        detail: describeEnd(wet),
      }))
      .with({ kind: 'upcoming', precision: 'minute' }, (wet) => ({
        headline: t('nextHour.startsInMinutes', {
          minutes: WeatherReportPolicy.getMinutesUntil(wet.startsAt, now),
          subject: toSubject(wet.precipitationType),
        }),
        detail: describeEnd(wet),
      }))
      .with({ kind: 'upcoming', precision: 'hour' }, (wet) => ({
        headline: t('nextHour.startsAround', {
          time: formatMoment(wet.startsAt, 'hour'),
          subject: toSubject(wet.precipitationType),
        }),
        detail: describeEnd(wet),
      }))
      .exhaustive();
}
