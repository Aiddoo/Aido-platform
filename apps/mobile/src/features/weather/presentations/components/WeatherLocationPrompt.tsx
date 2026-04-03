import { useAppToast } from '@src/shared/hooks/useAppToast';
import { useLocationPermission } from '@src/shared/hooks/useLocationPermission';
import { Result, Spacing, Text, VStack } from '@src/shared/ui';
import { useMutation } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { useCallback, useState } from 'react';
import { useTimePalette } from '../hooks/use-time-palette';
import { useUpdateLocationMutationOptions } from '../queries/use-update-location-mutation-options';

export function WeatherLocationPrompt() {
  const palette = useTimePalette();
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
        toast.error('위치를 가져올 수 없어요');
      }
    });

    setIsRequesting(false);
  }, [requestPermissionAndExecute, toast, updateLocation]);

  return (
    <VStack align="center" justify="center" flex={1}>
      <Text size="b3" weight="medium" align="center" style={{ color: palette.text }}>
        위치를 등록하면 날씨를 볼 수 있어요
      </Text>
      <Spacing size={4} />
      <Text size="b4" align="center" style={{ color: palette.textSub }}>
        현재 위치로 날씨를 알려드려요
      </Text>
      <Spacing size={24} />
      <Result.Button onPress={handlePress} isDisabled={isRequesting} isLoading={isRequesting}>
        위치 등록하기
      </Result.Button>
    </VStack>
  );
}
