import { usePushDeviceService } from '@src/bootstrap/providers/di-context';
import type { PushDeviceService } from '@src/features/notification/apis/push-device.service';
import { queryOptions } from '@tanstack/react-query';

import { NOTIFICATION_QUERY_KEYS } from '../constants/notification-query-keys';

function getPushPermissionQueryOptions(pushDeviceService: PushDeviceService) {
  return queryOptions({
    queryKey: NOTIFICATION_QUERY_KEYS.permission(),
    queryFn: () => pushDeviceService.readPermission(),
    // 기기 안에서만 처리해 연결 상태와 무관하다
    networkMode: 'always',

    // 설정 앱에서 바꾸고 돌아올 수 있어 화면을 열거나 앱으로 돌아올 때마다 다시 본다
    staleTime: 0,
  });
}

export function useGetPushPermissionQueryOptions() {
  return getPushPermissionQueryOptions(usePushDeviceService());
}
