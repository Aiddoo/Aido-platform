import type { WeatherAlertSeverity } from '@aido/api';
import { useGetPreferenceQueryOptions } from '@src/features/preference/queries/get-preference-query-options';
import { useTrack } from '@src/shared/analytics';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useOpenUrl } from '@src/shared/hooks/use-open-url';
import { useTranslation } from '@src/shared/i18n';
import { VStack } from '@src/shared/ui';
import { formatClockTime, type TimeFormat } from '@src/shared/utils/date-format';
import { useSuspenseQueries } from '@tanstack/react-query';
import { Alert, PressableFeedback } from 'heroui-native';
import type { ComponentProps } from 'react';

import { type WeatherAlert, WeatherReportPolicy } from '../domains/weather-report.model';
import {
  useGetWeatherReportQueryOptions,
  WeatherReportSelect,
} from '../queries/get-weather-report-query-options';

const ALERT_STATUS = {
  EXTREME: 'danger',
  SEVERE: 'danger',
  MODERATE: 'warning',
  MINOR: 'default',
  UNKNOWN: 'default',
} as const satisfies Record<WeatherAlertSeverity, ComponentProps<typeof Alert>['status']>;

/** 국내처럼 특보를 주지 않는 지역이나 특보가 없을 때는 아무것도 그리지 않는다. */
export function WeatherAlerts() {
  const [{ data, dataUpdatedAt }, { data: preference }] = useSuspenseQueries({
    queries: [
      { ...useGetWeatherReportQueryOptions(), select: WeatherReportSelect.alerts },
      useGetPreferenceQueryOptions(),
    ],
  });
  const now = new Date(dataUpdatedAt);
  const alerts = WeatherReportPolicy.activeAlerts(data.alerts, now);

  if (alerts.length === 0) {
    return <WeatherAlerts.Empty />;
  }
  return (
    <VStack gap={8}>
      {alerts.map((alert) => (
        <WeatherAlerts.Item
          key={alert.id}
          alert={alert}
          isInEffect={WeatherReportPolicy.isAlertInEffect(alert, now)}
          timeZone={data.location.timezone}
          timeFormat={preference.timeFormat}
        />
      ))}
    </VStack>
  );
}

interface WeatherAlertItemProps {
  alert: WeatherAlert;
  isInEffect: boolean;
  timeZone: string;
  timeFormat: TimeFormat;
}

WeatherAlerts.Item = function Item({
  alert,
  isInEffect,
  timeZone,
  timeFormat,
}: WeatherAlertItemProps) {
  const { t } = useTranslation('weather');
  const openUrl = useOpenUrl();
  const { trackEvent } = useTrack();
  const dateFormat = { ...useDateFormatContext(), timeZone };
  const period = isInEffect
    ? t('alerts.until', {
        time: formatClockTime(alert.expiresAt, timeFormat, dateFormat),
      })
    : t('alerts.startsAt', {
        time: formatClockTime(alert.effectiveAt, timeFormat, dateFormat),
      });
  const source =
    alert.areaName == null
      ? t('alerts.issuedBy', { source: alert.source })
      : t('alerts.area', { source: alert.source, area: alert.areaName });

  const handlePress = () => {
    trackEvent('weather_alert_opened', { severity: alert.severity });
    openUrl(alert.detailsUrl);
  };

  return (
    <PressableFeedback
      accessibilityRole="link"
      accessibilityLabel={`${alert.title}, ${period}, ${source}`}
      accessibilityHint={t('alerts.openDetails')}
      className="min-h-11"
      onPress={handlePress}
    >
      <Alert status={ALERT_STATUS[alert.severity]}>
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title>{`${alert.title} · ${period}`}</Alert.Title>
          <Alert.Description>{source}</Alert.Description>
        </Alert.Content>
      </Alert>
    </PressableFeedback>
  );
};

/** 특보는 대부분 없어서 자리를 미리 잡으면 로딩 뒤 화면이 당겨진다. 자리를 두지 않는다. */
WeatherAlerts.Loading = function Loading() {
  return null;
};

WeatherAlerts.Empty = function Empty() {
  return null;
};
