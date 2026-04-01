import { useAppToast } from '@src/shared/hooks/useAppToast';
import { useLocationPermission } from '@src/shared/hooks/useLocationPermission';
import { Result } from '@src/shared/ui';
import { useMutation } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { useCallback, useState } from 'react';
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
    <Result
      title="위치를 등록하면 날씨를 볼 수 있어요"
      description="현재 위치로 날씨를 알려드려요"
      button={
        <Result.Button onPress={handlePress} isDisabled={isRequesting} isLoading={isRequesting}>
          위치 등록하기
        </Result.Button>
      }
    />
  );
}
