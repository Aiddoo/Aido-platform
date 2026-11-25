import { useWeatherLocationService } from '@src/bootstrap/providers/di-context';
import { useTrack } from '@src/shared/analytics';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

import { toPermissionResult } from '../utils/weather-analytics';
import { refetchWeatherLocation } from './weather-cache';

/** 안내의 '계속'을 눌렀을 때만 시스템 위치 창을 띄운다. 권한은 위치 읽기가 함께 읽으므로 끝나면 위치를 다시 읽는다 */
export function useRequestWeatherLocationPermissionMutationOptions() {
  const weatherLocationService = useWeatherLocationService();
  const queryClient = useQueryClient();
  const { trackEvent } = useTrack();

  return mutationOptions({
    // 권한 창은 기기 안에서 뜨므로 오프라인에서도 멈추지 않는다
    networkMode: 'always',
    mutationFn: () => weatherLocationService.requestPermission(),
    onSuccess: (permission) => {
      trackEvent('weather_location_permission_result', {
        result: toPermissionResult(permission),
      });
    },
    onSettled: () => refetchWeatherLocation(queryClient),
    // 창을 띄우지 못하면 서비스가 로그만 남기고 안내가 그대로 남는다
    meta: { errorFeedback: false },
  });
}
