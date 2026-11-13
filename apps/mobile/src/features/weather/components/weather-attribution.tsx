import { useGetPreferenceQueryOptions } from '@src/features/identity/preference/queries/preference.queries';
import { formatClockTime } from '@src/shared/date/format/date-format';
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
import {
  type AttributionBackground,
  toAttributionMark,
} from '../utils/weather-attribution.view-model';

/** Apple 지침: 로고는 1x 크기(높이 14pt) 그대로 그린다. 폭은 언어마다 달라 원본 비율을 따른다. */
const LOGO_HEIGHT = 14;
const LOGO_DEFAULT_ASPECT_RATIO = 38 / 14;
/** 링크 글자(17pt 줄)는 시안 간격 그대로 두고 터치 영역만 44pt로 넓힌다. */
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
  /** 표기 뒤 바탕. 하늘 장면·다크 테마는 dark(흰 글자), 밝은 바탕은 light(어두운 글자). */
  background: AttributionBackground;
}

/** WeatherKit 이용 조건: Apple 날씨 데이터를 보여 주는 화면마다 표기와 출처 링크를 두고 로고는 변형 없이 쓴다 */
export function WeatherAttribution({ background }: WeatherAttributionProps) {
  const { t } = useTranslation('weather');
  const openUrl = useOpenInAppBrowser();
  const [{ data: weather }, { data: preference }] = useSuspenseQueries({
    queries: [
      { ...useGetWeatherReportQueryOptions(), select: WeatherReportSelect.attribution },
      useGetPreferenceQueryOptions(),
    ],
  });
  const dateFormat = useLocationDateFormat(weather.location.timezone);
  const now = useMinuteNow();
  const localTime = useFormatLocalTime(weather.location.timezone, now);
  const { attribution } = weather;
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
          time: localTime(formatClockTime(weather.fetchedAt, preference.timeFormat, dateFormat)),
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

/** 로고를 받지 못하거나 불러오지 못해도 서비스 이름으로 바꿔 출처 표기가 사라지지 않게 한다. */
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
          style={{ height: LOGO_HEIGHT, aspectRatio }}
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
