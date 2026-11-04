import { useLogger, usePushDeviceService } from '@src/bootstrap/providers/di-context';
import { errorMessageOf } from '@src/shared/errors';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

import { NOTIFICATION_LOG_EVENT } from '../constants/notification-log-events';
import { NOTIFICATION_QUERY_KEYS } from '../constants/notification-query-keys';
import type { PushPermission } from '../domains/push-permission.model';

export const useRequestPushPermissionMutationOptions = () => {
  const pushDeviceService = usePushDeviceService();
  const logger = useLogger();
  const queryClient = useQueryClient();

  return mutationOptions({
    mutationFn: () => pushDeviceService.requestPermission(),
    // 권한 창은 기기 안에서 뜨므로 오프라인에서도 멈추지 않는다
    networkMode: 'always',
    onSuccess: (permission) => {
      queryClient.setQueryData<PushPermission>(NOTIFICATION_QUERY_KEYS.permission(), permission);
    },
    onError: (error) => {
      logger.warn(NOTIFICATION_LOG_EVENT.PUSH_PERMISSION_REQUEST_FAILED, {
        error: errorMessageOf(error),
      });
    },
  });
};
