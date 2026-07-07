import { useAppToast } from '@src/shared/hooks/useAppToast';
import { useLocationPermission } from '@src/shared/hooks/useLocationPermission';
import { useTranslation } from '@src/shared/i18n';
import { Result, Spacing, Text, VStack } from '@src/shared/ui';
import { useMutation } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { useCallback, useState } from 'react';
import { useTimePalette } from '../hooks/use-time-palette';
import { useUpdateLocationMutationOptions } from '../queries/use-update-location-mutation-options';

export function WeatherLocationPrompt() {
  const palette = useTimePalette();
  const { t } = useTranslation('weather');
  const toast = useAppToast();
  const [isRequesting, setIsRequesting] = useState(false);
  const { mutate: updateLocation } = useMutation(useUpdateLocationMutationOptions());
  const { requestPermissionAndExecute } = useLocationPermission((message) =>
    toast.warning(message),
  );

  const handlePress = useCallback(async () => {
    setIsRequesting(true);

    await requestPermissionAndExecute(async () => {
      try {
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        updateLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
      } catch {
        toast.error(t('toasts.locationFailed'));
      }
    });

    setIsRequesting(false);
  }, [requestPermissionAndExecute, toast, updateLocation, t]);

  return (
    <VStack align="center" justify="center" flex={1}>
      <Text size="b3" weight="medium" align="center" style={{ color: palette.text }}>
        {t('locationPrompt.title')}
      </Text>
      <Spacing size={4} />
      <Text size="b4" align="center" style={{ color: palette.textSub }}>
        {t('locationPrompt.subtitle')}
      </Text>
      <Spacing size={24} />
      <Result.Button onPress={handlePress} isDisabled={isRequesting} isLoading={isRequesting}>
        {t('locationPrompt.register')}
      </Result.Button>
    </VStack>
  );
}
