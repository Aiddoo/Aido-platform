import { useTranslation } from '@src/shared/i18n';
import { Result, Spacing, Text, VStack } from '@src/shared/ui';
import * as Linking from 'expo-linking';

import { useTimePalette } from '../hooks/use-time-palette';
import { useWeatherSession } from '../providers/weather-session-provider';

export function WeatherLocationPrompt() {
  const palette = useTimePalette();
  const { t } = useTranslation(['weather', 'common']);
  const session = useWeatherSession();
  const denied = session.status === 'denied';

  return (
    <VStack align="center" justify="center" flex={1} px={24}>
      <Text size="b3" weight="medium" align="center" style={{ color: palette.text }}>
        {t('weather:locationPrompt.title')}
      </Text>
      <Spacing size={4} />
      <Text size="b4" align="center" style={{ color: palette.textSub }}>
        {t(denied ? 'weather:locationPrompt.permissionDenied' : 'weather:locationPrompt.subtitle')}
      </Text>
      <Spacing size={24} />
      <Result.Button
        onPress={() => {
          if (denied) void Linking.openSettings().catch(() => undefined);
          else void session.syncLocation(true);
        }}
        isDisabled={session.isSyncing}
        isLoading={session.isSyncing}
      >
        {t(denied ? 'common:permissions.openSettings' : 'weather:locationPrompt.register')}
      </Result.Button>
      {session.status === 'error' && (
        <Text size="b4" align="center" style={{ color: palette.textSub }}>
          {t('weather:toasts.locationFailed')}
        </Text>
      )}
    </VStack>
  );
}
