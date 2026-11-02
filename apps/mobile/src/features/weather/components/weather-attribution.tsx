import { useOpenUrl } from '@src/shared/hooks/use-open-url';
import { useTranslation } from '@src/shared/i18n';
import { HStack, Text, TextButton, TextSkeleton } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { useSuspenseQuery } from '@tanstack/react-query';
import { Image, type ImageLoadEventData } from 'expo-image';
import { useState } from 'react';
import { match } from 'ts-pattern';

import {
  type AttributionBackground,
  type AttributionMark,
  WeatherReportPolicy,
} from '../domains/weather-report.model';
import {
  useGetWeatherReportQueryOptions,
  WeatherReportSelect,
} from '../queries/get-weather-report-query-options';

/** Apple 지침: 로고를 1x 크기(한국어 38×14pt)보다 작게 줄이지 않는다. 높이를 고정하고 폭은 원본 비율을 따른다. */
const LOGO_HEIGHT = 14;
const LOGO_DEFAULT_ASPECT_RATIO = 38 / 14;

interface WeatherAttributionProps {
  /** 표기 뒤 바탕. 하늘 장면·다크 테마는 dark(흰 글자 로고), 밝은 바탕은 light(검은 글자 로고). */
  background: AttributionBackground;
}

/**
 * WeatherKit 이용 조건: Apple 날씨 데이터를 보여 주는 화면마다 Apple Weather 표기와 출처 고지 링크를 둔다.
 * 로고는 색·비율을 바꾸지 않고 그대로 그리며, 받지 못하면 서비스 이름을 글자로 표기한다.
 */
export function WeatherAttribution({ background }: WeatherAttributionProps) {
  const { t } = useTranslation('weather');
  const openUrl = useOpenUrl();
  const { data } = useSuspenseQuery({
    ...useGetWeatherReportQueryOptions(),
    select: WeatherReportSelect.attribution,
  });
  const { attribution } = data;
  const mark = WeatherReportPolicy.attributionMark(attribution, background);

  return (
    <HStack align="center" justify="center" gap={12} className="min-h-11 flex-wrap">
      <WeatherAttribution.Mark
        mark={mark}
        serviceName={attribution.serviceName}
        background={background}
      />
      <TextButton
        size="small"
        accessibilityRole="link"
        accessibilityLabel={t('attribution.openSources', {
          serviceName: attribution.serviceName,
        })}
        onPress={() => openUrl(attribution.legalPageUrl)}
      >
        {t('attribution.sources')}
      </TextButton>
    </HStack>
  );
}

/** 로고가 로드에 실패해도 서비스 이름으로 바꿔 출처 표기가 사라지지 않게 한다. */
WeatherAttribution.Mark = function Mark({
  mark,
  serviceName,
  background,
}: {
  mark: AttributionMark;
  serviceName: string;
  background: AttributionBackground;
}) {
  const [hasLogoFailed, setHasLogoFailed] = useState(false);
  const [aspectRatio, setAspectRatio] = useState(LOGO_DEFAULT_ASPECT_RATIO);

  const handleLoad = ({ source }: ImageLoadEventData) => {
    if (source.width > 0 && source.height > 0) {
      setAspectRatio(source.width / source.height);
    }
  };

  const textMark = (
    <Text
      size="b3"
      weight="semibold"
      className={cn(background === 'dark' ? 'text-white' : 'text-gray-9')}
      accessibilityRole="text"
    >
      {serviceName}
    </Text>
  );

  return match(mark)
    .with({ kind: 'text' }, () => textMark)
    .with({ kind: 'logo' }, ({ sources }) =>
      hasLogoFailed ? (
        textMark
      ) : (
        <Image
          source={sources}
          style={{ height: LOGO_HEIGHT, width: LOGO_HEIGHT * aspectRatio }}
          contentFit="contain"
          accessibilityLabel={serviceName}
          accessibilityIgnoresInvertColors
          onLoad={handleLoad}
          onError={() => setHasLogoFailed(true)}
          testID="weather-attribution-logo"
        />
      ),
    )
    .exhaustive();
};

WeatherAttribution.Loading = function Loading() {
  return (
    <HStack align="center" justify="center" gap={12} className="min-h-11">
      <TextSkeleton size="b3" className="w-24 opacity-40" />
      <TextSkeleton size="b4" className="w-16 opacity-40" />
    </HStack>
  );
};
