import { useGetPreferenceQueryOptions } from '@src/features/identity/preference/queries/preference.queries';
import { useTrack } from '@src/shared/analytics';
import { formatClockTime, type TimeFormat } from '@src/shared/date/format/date-format';
import { type Instant } from '@src/shared/date/instant';
import { useFontScaleRatio } from '@src/shared/hooks/use-font-scale-ratio';
import { useMinuteNow } from '@src/shared/hooks/use-minute-now';
import { useOpenInAppBrowser } from '@src/shared/hooks/use-open-in-app-browser';
import { useTranslation } from '@src/shared/i18n';
import { ArrowRightIcon, Box, HStack, Text, VStack } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { useSuspenseQueries } from '@tanstack/react-query';
import { PressableFeedback } from 'heroui-native';

import { ALERT_GLYPH_BACKGROUND_CLASS } from '../constants/weather-colors.constants';
import { WeatherReportPolicy } from '../domains/weather-report.model';
import type { WeatherAlert } from '../domains/weather-report.model';
import { useFormatLocalTime, useLocationDateFormat } from '../hooks/use-location-date-format';
import { useGetWeatherReportQueryOptions, WeatherReportSelect } from '../queries/weather.queries';
import { WeatherCard } from './weather-card';
import { WeatherIcon } from './weather-icon';

const GLYPH_SIZE = 18;
const CHEVRON_SIZE = 14;

/** 서버가 심각도 순으로 보내므로 가장 심각한 특보 하나만 카드로 보이고 나머지는 개수로 알린다 */
export function WeatherAlerts() {
  const [{ data: weather }, { data: preference }] = useSuspenseQueries({
    queries: [
      { ...useGetWeatherReportQueryOptions(), select: WeatherReportSelect.alerts },
      useGetPreferenceQueryOptions(),
    ],
  });
  const now = useMinuteNow();
  const [mostSevere, ...rest] = WeatherReportPolicy.getActiveAlerts(weather.alerts, now);

  if (mostSevere == null) {
    return <WeatherAlerts.Empty />;
  }
  return (
    <WeatherAlerts.Item
      alert={mostSevere}
      isInEffect={WeatherReportPolicy.isAlertInEffect(mostSevere, now)}
      otherCount={rest.length}
      timeZone={weather.location.timezone}
      timeFormat={preference.timeFormat}
      now={now}
    />
  );
}

interface WeatherAlertItemProps {
  alert: WeatherAlert;
  isInEffect: boolean;
  otherCount: number;
  timeZone: string;
  timeFormat: TimeFormat;
  now: Instant;
}

WeatherAlerts.Item = function Item({
  alert,
  isInEffect,
  otherCount,
  timeZone,
  timeFormat,
  now,
}: WeatherAlertItemProps) {
  const { t } = useTranslation('weather');
  const openUrl = useOpenInAppBrowser();
  const { trackEvent } = useTrack();
  const fontScaleRatio = useFontScaleRatio();
  const dateFormat = useLocationDateFormat(timeZone);
  const localTime = useFormatLocalTime(timeZone, now);
  const time = (date: Instant) => localTime(formatClockTime(date, timeFormat, dateFormat));
  const period = isInEffect
    ? t('alerts.until', { time: time(alert.expiresAt) })
    : t('alerts.startsAt', { time: time(alert.effectiveAt) });
  const title = t('alerts.period', { title: alert.title, period });
  const source =
    alert.areaName == null
      ? t('alerts.issuedBy', { source: alert.source })
      : t('alerts.area', { source: alert.source, area: alert.areaName });
  const subtitle =
    otherCount > 0
      ? t('alerts.sourceWithMore', { source, more: t('alerts.more', { count: otherCount }) })
      : source;
  const chevronSize = Math.round(CHEVRON_SIZE * fontScaleRatio);

  const handlePress = () => {
    trackEvent('weather_alert_opened', { severity: alert.severity });
    openUrl(alert.detailsUrl);
  };

  return (
    <PressableFeedback
      accessibilityRole="link"
      accessibilityLabel={t('alerts.label', { title, subtitle })}
      accessibilityHint={t('alerts.openDetails')}
      onPress={handlePress}
    >
      <WeatherCard tone="alert">
        <HStack gap={12} align="center">
          <Box
            className={cn(
              'size-[34px] items-center justify-center rounded-full',
              ALERT_GLYPH_BACKGROUND_CLASS,
            )}
          >
            <WeatherIcon.Warning width={GLYPH_SIZE} height={GLYPH_SIZE} />
          </Box>
          <VStack flex={1} gap={1}>
            <Text
              size="b2"
              weight="semibold"
              tone="onSky"
              className="leading-[22px] tracking-[-0.3px]"
            >
              {title}
            </Text>
            <Text size="b4" className="leading-[18px] text-on-sky/75">
              {subtitle}
            </Text>
          </VStack>
          <ArrowRightIcon
            width={chevronSize}
            height={chevronSize}
            colorClassName="text-on-sky/60"
          />
        </HStack>
      </WeatherCard>
    </PressableFeedback>
  );
};

WeatherAlerts.Empty = function Empty() {
  return null;
};
