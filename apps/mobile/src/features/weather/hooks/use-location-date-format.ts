import type { DateFormatContext } from '@src/shared/date/date-format';
import { hasSameWallClock, type Instant } from '@src/shared/date/instant';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useTranslation } from '@src/shared/i18n';

export function useLocationDateFormat(timeZone: string): DateFormatContext {
  return { ...useDateFormatContext(), timeZone };
}

/** 위치 벽시계가 기기와 다를 때만 시각 앞에 '현지'를 붙인다 */
export function useFormatLocalTime(timeZone: string, now: Instant): (time: string) => string {
  const { t } = useTranslation('weather');
  const { timeZone: deviceTimeZone } = useDateFormatContext();
  const isDifferent = !hasSameWallClock(now, timeZone, deviceTimeZone);
  return (time) => (isDifferent ? t('localTime', { time }) : time);
}
