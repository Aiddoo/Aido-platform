import { useGetPreferenceQueryOptions } from '@src/features/identity/preference/queries/preference.queries';
import { formatClockTime } from '@src/shared/date/date-format';
import { useMinuteNow } from '@src/shared/hooks/use-minute-now';
import { useOpenInAppBrowser } from '@src/shared/hooks/use-open-in-app-browser';
import { useTranslation } from '@src/shared/i18n';
import { Image, Text, TextSkeleton, VStack } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { tv } from '@src/shared/utils/tv';
import { useSuspenseQueries } from '@tanstack/react-query';
import type { ImageLoadEventData } from 'expo-image';
import { PressableFeedback } from 'heroui-native';
import { useState } from 'react';
import { useWindowDimensions } from 'react-native';
import { match } from 'ts-pattern';

import type { AttributionInfo } from '../domains/weather-report.model';
import { useFormatLocalTime, useLocationDateFormat } from '../hooks/use-location-date-format';
import { useGetWeatherReportQueryOptions, WeatherReportSelect } from '../queries/weather.queries';
import { type AttributionBackground, toAttributionMark } from '../utils/to-attribution-mark';

/** Apple 지침: 로고는 1x 크기(높이 14pt) 그대로 그린다. 폭은 언어마다 달라 원본 비율을 따른다. */
const LOGO_HEIGHT = 14;
const LOGO_DEFAULT_ASPECT_RATIO = 38 / 14;
const LINK_HIT_SLOP = { top: 14, bottom: 14, left: 16, right: 16 };

const attributionTone = tv({
  slots: {
    mark: '',
    meta: '',
  },
  variants: {
    background: {
      dark: { mark: 'text-on-sky/80', meta: 'text-on-sky/[0.62]' },
      light: { mark: 'text-gray-9', meta: 'text-gray-6' },
    },
  },
});

interface WeatherAttributionProps {
  background: AttributionBackground;
}

/** WeatherKit 이용 조건: Apple 날씨 데이터를 보여 주는 화면마다 */
export function WeatherAttribution({ background }: WeatherAttributionProps) {
  const { t } = useTranslation('weather');
  const openUrl = useOpenInAppBrowser();
  const [{ data }, { data: preference }] = useSuspenseQueries({
    queries: [
      { ...useGetWeatherReportQueryOptions(), select: WeatherReportSelect.attribution },
      useGetPreferenceQueryOptions(),
    ],
  });
  const dateFormat = useLocationDateFormat(data.location.timezone);
  const now = useMinuteNow();
  const localTime = useFormatLocalTime(data.location.timezone, now);
  const { attribution } = data;
  const tone = attributionTone({ background });

  return (
    <VStack align="center" gap={4} pt={14} pb={6}>
      <WeatherAttribution.Mark
        attribution={attribution}
        background={background}
        className={tone.mark()}
      />
      <Text size="e1" align="center" className={cn('tabular-nums', tone.meta())}>
        {t('attribution.updatedAt', {
          source: attribution.serviceName,
          time: localTime(formatClockTime(data.fetchedAt, preference.timeFormat, dateFormat)),
        })}
      </Text>
      <PressableFeedback
        accessibilityRole="link"
        accessibilityLabel={t('attribution.openSources', {
          serviceName: attribution.serviceName,
        })}
        onPress={() => openUrl(attribution.legalPageUrl)}
        hitSlop={LINK_HIT_SLOP}
      >
        <Text size="e1" weight="medium" className={tone.mark()}>
          {t('attribution.sources')}
        </Text>
      </PressableFeedback>
    </VStack>
  );
}

WeatherAttribution.Mark = function Mark({
  attribution,
  background,
  className,
}: {
  attribution: AttributionInfo;
  background: AttributionBackground;
  className: string;
}) {
  const { scale } = useWindowDimensions();
  const [hasLogoFailed, setHasLogoFailed] = useState(false);
  const [aspectRatio, setAspectRatio] = useState(LOGO_DEFAULT_ASPECT_RATIO);
  const mark = toAttributionMark(attribution, background, scale);

  const handleLoad = ({ source }: ImageLoadEventData) => {
    if (source.width > 0 && source.height > 0) {
      setAspectRatio(source.width / source.height);
    }
  };

  const textMark = (
    <Text size="e1" weight="semibold" className={className}>
      {attribution.serviceName}
    </Text>
  );

  return match(mark)
    .with({ kind: 'text' }, () => textMark)
    .with({ kind: 'logo' }, ({ uri }) =>
      hasLogoFailed ? (
        textMark
      ) : (
        <Image
          source={{ uri }}
          style={{ height: LOGO_HEIGHT, width: LOGO_HEIGHT * aspectRatio }}
          contentFit="contain"
          accessibilityLabel={attribution.serviceName}
          accessibilityIgnoresInvertColors
          onLoad={handleLoad}
          onError={() => setHasLogoFailed(true)}
        />
      ),
    )
    .exhaustive();
};

WeatherAttribution.Loading = function Loading() {
  return (
    <VStack align="center" gap={4} pt={14} pb={6}>
      <TextSkeleton size="e1" className="w-16 opacity-40" />
      <TextSkeleton size="e1" className="w-32 opacity-40" />
      <TextSkeleton size="e1" className="w-20 opacity-40" />
    </VStack>
  );
};
