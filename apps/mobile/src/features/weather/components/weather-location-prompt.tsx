import catAnchorImage from '@assets/images/cat_weather_anchor.png';
import catHiImage from '@assets/images/ido_cat_hi.webp';
import catSuggestionImage from '@assets/images/ido_cat_suggestion.webp';
import { useTranslation } from '@src/shared/i18n';
import { HStack, Text, TextButton } from '@src/shared/ui';
import { useMutation, useQuery } from '@tanstack/react-query';
import { match } from 'ts-pattern';

import { useWeatherLocation } from '../hooks/use-weather-location';
import { useGetWeatherLocationQueryOptions } from '../queries/get-weather-location-query-options';
import { useUpdateWeatherLocationMutationOptions } from '../queries/use-update-weather-location-mutation-options';
import { WeatherResult } from './weather-result';

interface WeatherLocationPromptProps {
  /** 리포트 오류 경계 안에서 열렸을 때, 다시 등록한 뒤 경계를 풀어 리포트를 다시 받는다. */
  onRecovered?: () => void;
}

/**
 * 위치 때문에 날씨를 보여 줄 수 없는 상태마다 할 일을 하나씩 안내한다.
 * 권한 요청은 인사하는 고양이, 설정 이동은 제안하는 고양이, 위치를 못 찾으면 닻 고양이를 쓴다.
 */
export function WeatherLocationPrompt({ onRecovered }: WeatherLocationPromptProps) {
  const { t } = useTranslation(['weather', 'common']);
  const location = useWeatherLocation();
  const { data: reading } = useQuery(useGetWeatherLocationQueryOptions());
  const updateLocation = useMutation(useUpdateWeatherLocationMutationOptions());

  const handleRetry = async () => {
    if (reading?.status === 'located') {
      const { latitude, longitude } = reading.registered;
      await updateLocation.mutateAsync({ latitude, longitude }).catch(() => undefined);
    } else if (location.status === 'unavailable') {
      await location.retry();
    }
    onRecovered?.();
  };

  return match(location)
    .with({ status: 'needsPermission' }, ({ request }) => (
      <WeatherResult
        image={catHiImage}
        title={t('weather:locationPrompt.title')}
        description={t('weather:locationPrompt.subtitle')}
        footnote={t('weather:locationPrompt.footnote')}
      >
        <WeatherResult.Action tone="primary" onPress={request}>
          {t('weather:locationPrompt.allow')}
        </WeatherResult.Action>
      </WeatherResult>
    ))
    .with({ status: 'denied' }, ({ openSettings }) => (
      <WeatherResult
        image={catSuggestionImage}
        title={t('weather:locationPrompt.permissionDenied')}
        description={t('weather:locationPrompt.permissionDeniedDescription')}
        footnote={t('weather:locationPrompt.footnote')}
      >
        <WeatherResult.Action tone="primary" onPress={openSettings}>
          {t('weather:locationPrompt.openSettings')}
        </WeatherResult.Action>
      </WeatherResult>
    ))
    .with({ status: 'checking' }, { status: 'unavailable' }, { status: 'ready' }, () => (
      <WeatherResult
        image={catAnchorImage}
        title={t('weather:locationPrompt.unavailableTitle')}
        description={t('weather:locationPrompt.unavailableDescription')}
        footnote={t('weather:locationPrompt.footnote')}
      >
        <WeatherResult.Action
          tone="light"
          isLoading={updateLocation.isPending}
          onPress={handleRetry}
        >
          {t('common:actions.retry')}
        </WeatherResult.Action>
      </WeatherResult>
    ))
    .exhaustive();
}

/** 저장된 위치로 날씨를 보여 주는 동안 화면을 막지 않고 한 줄로 알린다. */
WeatherLocationPrompt.SavedLocationNotice = function SavedLocationNotice() {
  const { t } = useTranslation(['weather', 'common']);
  const location = useWeatherLocation();

  if (location.status !== 'unavailable') {
    return null;
  }
  return (
    <HStack gap={8} align="center" justify="center" px={16} className="flex-wrap">
      <Text size="b4" align="center" className="shrink text-on-sky/85">
        {t('weather:locationPrompt.savedLocationNotice')}
      </Text>
      <TextButton size="small" onPress={location.retry}>
        {t('common:actions.retry')}
      </TextButton>
    </HStack>
  );
};
