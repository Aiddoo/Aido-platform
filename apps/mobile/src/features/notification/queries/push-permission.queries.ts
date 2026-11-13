import { usePushRegistrationService } from '@src/bootstrap/providers/di-context';
import { queryOptions } from '@tanstack/react-query';

import { PUSH_PERMISSION_QUERY_KEYS } from './push-permission-query-keys';

export function useGetPushPermissionQueryOptions() {
  const pushRegistrationService = usePushRegistrationService();

  return queryOptions({
    queryKey: PUSH_PERMISSION_QUERY_KEYS.current(),
    queryFn: () => pushRegistrationService.getPermission(),
    // 기기 안에서만 처리해 연결 상태와 무관하다
    networkMode: 'always',

    // 설정 앱에서 바꾸고 돌아올 수 있어 화면을 열거나 앱으로 돌아올 때마다 다시 본다
    staleTime: 0,
  });
}
