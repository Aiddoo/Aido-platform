import { useGetPreferenceQueryOptions } from '@src/features/preference/queries/get-preference-query-options';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useOpenUrl } from '@src/shared/hooks/use-open-url';
import { useTranslation } from '@src/shared/i18n';
import { Text, TextButton, TextSkeleton, VStack } from '@src/shared/ui';
import { formatClockTime } from '@src/shared/utils/date-format';
import { useSuspenseQueries } from '@tanstack/react-query';

import {
  useGetWeatherReportQueryOptions,
  WeatherReportSelect,
} from '../queries/get-weather-report-query-options';

/** Apple 로고 글리프()는 Apple 기기의 시스템 글꼴에만 있어 Android에서는 글자로 쓴다. */
const SHOWS_APPLE_LOGO = process.env.EXPO_OS === 'ios';

/** WeatherKit 이용 조건: 날씨를 보여 주는 화면에 공급자 표기와 데이터 출처 링크를 둔다. */
export function WeatherAttribution() {
  const { t } = useTranslation('weather');
  const openUrl = useOpenUrl();
  const [{ data }, { data: preference }] = useSuspenseQueries({
    queries: [
      { ...useGetWeatherReportQueryOptions(), select: WeatherReportSelect.attribution },
      useGetPreferenceQueryOptions(),
    ],
  });
  const dateFormat = { ...useDateFormatContext(), timeZone: data.location.timezone };
  const fetchedAt = formatClockTime(data.fetchedAt, preference.timeFormat, dateFormat);

  return (
    <VStack align="center" gap={4}>
      <Text size="b3" weight="semibold" tone="white">
        {t(SHOWS_APPLE_LOGO ? 'attribution.provider' : 'attribution.providerText')}
      </Text>
      <Text size="b4" align="center" className="text-white/75">
        {t('attribution.updatedAt', { time: fetchedAt })}
      </Text>
      <TextButton
        size="small"
        accessibilityRole="link"
        accessibilityHint={t('attribution.openSources')}
        onPress={() => openUrl(data.attribution.legalPageUrl)}
      >
        {t('attribution.sources')}
      </TextButton>
    </VStack>
  );
}

WeatherAttribution.Loading = function Loading() {
  return (
    <VStack align="center" gap={4}>
      <TextSkeleton size="b3" className="w-24 opacity-40" />
      <TextSkeleton size="b4" className="w-32 opacity-40" />
    </VStack>
  );
};
