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
      <Notice
        message={t('weather:locationPrompt.savedLocationNotice')}
        actionLabel={t('common:actions.retry')}
        onAction={retry}
      />
    ))
    .with({ status: 'ready', isLastKnown: true }, ({ request }) => (
      <Notice
        message={t('weather:locationPrompt.lastLocationNotice')}
        actionLabel={t('weather:locationPrompt.continue')}
        onAction={request}
      />
    ))
    .otherwise(() => null);
}

interface NoticeProps {
  message: string;
  actionLabel: string;
  onAction: () => void;
}

function Notice({ message, actionLabel, onAction }: NoticeProps) {
  return (
    <HStack gap={8} align="center" justify="center" className="flex-wrap px-4">
      <Text size="b4" align="center" className="shrink text-on-sky/85">
        {message}
      </Text>
      <TextButton size="small" onPress={onAction}>
        {actionLabel}
      </TextButton>
    </HStack>
  );
}
