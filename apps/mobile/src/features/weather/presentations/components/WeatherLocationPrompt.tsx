import { useAppToast } from '@src/shared/hooks/useAppToast';
import { useLocationPermission } from '@src/shared/hooks/useLocationPermission';
import { HStack, Text } from '@src/shared/ui';
import { WeatherClearIcon } from '@src/shared/ui/Icon/icons';
import { useMutation } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { PressableFeedback } from 'heroui-native';
import { useCallback, useState } from 'react';
import { ActivityIndicator } from 'react-native';
import { useUpdateLocationMutationOptions } from '../queries/use-update-location-mutation-options';

export function WeatherLocationPrompt() {
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
    <PressableFeedback
      onPress={handlePress}
      isDisabled={isRequesting}
      className="rounded-xl bg-gray-1 px-4 py-3"
    >
      <HStack align="center" gap={8}>
        <WeatherClearIcon width={16} height={16} colorClassName="text-gray-7" />
        <Text size="b3" weight="medium" shade={7} className="flex-1">
          위치를 등록하면 날씨를 볼 수 있어요
        </Text>
        {isRequesting && <ActivityIndicator size="small" />}
      </HStack>
    </PressableFeedback>
  );
}
