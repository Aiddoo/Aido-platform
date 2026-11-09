import { useTranslation } from '@src/shared/i18n';
import { HStack, Text, TextButton } from '@src/shared/ui';
import { match } from 'ts-pattern';

import { useWeatherLocation } from '../hooks/use-weather-location';

/** 저장된 위치나 마지막 위치로 보여 주는 동안은 화면을 막지 않고 한 줄로 알린다 */
export function WeatherLocationNotice() {
  const { t } = useTranslation(['weather', 'common']);
  const location = useWeatherLocation();

  return match(location)
    .with({ status: 'unavailable' }, ({ retry }) => (
      <HStack gap={8} align="center" justify="center" className="flex-wrap px-4">
        <Text size="b4" align="center" className="shrink text-on-sky/85">
          {t('weather:locationPrompt.savedLocationNotice')}
        </Text>
        <TextButton size="small" onPress={retry}>
          {t('common:actions.retry')}
        </TextButton>
      </HStack>
    ))
    .with({ status: 'ready', isLastKnown: true }, ({ request }) => (
      <HStack gap={8} align="center" justify="center" className="flex-wrap px-4">
        <Text size="b4" align="center" className="shrink text-on-sky/85">
          {t('weather:locationPrompt.lastLocationNotice')}
        </Text>
        <TextButton size="small" onPress={request}>
          {t('weather:locationPrompt.continue')}
        </TextButton>
      </HStack>
    ))
    .otherwise(() => null);
}
