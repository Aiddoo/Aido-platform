import { useAppToast } from '@src/shared/hooks/useAppToast';
import { useMutation } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { useEffect, useState } from 'react';

import { useUpdateLocationMutationOptions } from '../queries/use-update-location-mutation-options';

export interface LocationCoords {
  latitude: number;
  longitude: number;
}

export function useSyncWeatherLocation(): [location: LocationCoords | null] {
  const [location, setLocation] = useState<LocationCoords | null>(null);
  const toast = useAppToast();
  const mutationOptions = useUpdateLocationMutationOptions();

  const { mutate } = useMutation({
    ...mutationOptions,
    onError: () => {
      toast.warning('위치를 업데이트하지 못했어요');
    },
  });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { granted } = await Location.getForegroundPermissionsAsync();
      if (!granted || cancelled) return;

      const position = await Location.getLastKnownPositionAsync();
      if (!position || cancelled) return;

      const coords = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };

      setLocation(coords);
      mutate(coords);
    })();

    return () => {
      cancelled = true;
    };
  }, [mutate]);

  return [location];
}
