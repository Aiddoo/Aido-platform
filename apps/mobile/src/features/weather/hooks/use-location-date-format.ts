import { type DateFormatContext } from '@src/shared/date/format/date-format';
import { type Instant } from '@src/shared/date/instant';
import { hasSameWallClock } from '@src/shared/date/zoned';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useTranslation } from '@src/shared/i18n';

/** 날씨 시각은 예보 위치 시간대로 읽고, 글자 모양만 앱 표시 언어를 따른다. */
export function useLocationDateFormat(timeZone: string): DateFormatContext {
  return { ...useDateFormatContext(), timeZone };
}

/** 위치 벽시계가 기기와 다를 때만 '현지'를 붙인다. 오프셋이 같으면(서울·도쿄) 붙이지 않는다 */
export function useFormatLocalTime(timeZone: string, now: Instant): (time: string) => string {
  const { t } = useTranslation('weather');
  const { timeZone: deviceTimeZone } = useDateFormatContext();
  const isDifferent = !hasSameWallClock(now, timeZone, deviceTimeZone);
  return (time) => (isDifferent ? t('localTime', { time }) : time);
}
