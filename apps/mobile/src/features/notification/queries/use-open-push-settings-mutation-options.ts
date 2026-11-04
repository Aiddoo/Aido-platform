import { useLogger, usePushDeviceService } from '@src/bootstrap/providers/di-context';
import { errorMessageOf } from '@src/shared/errors';
import { mutationOptions } from '@tanstack/react-query';

import { NOTIFICATION_LOG_EVENT } from '../constants/notification-log-events';

/** 알림을 거절해 시스템 창을 다시 띄울 수 없을 때 이 앱의 설정 화면을 연다. 돌아오면 권한 쿼리가 다시 읽는다 */
export const useOpenPushSettingsMutationOptions = () => {
  const pushDeviceService = usePushDeviceService();
  const logger = useLogger();

  return mutationOptions({
    mutationFn: () => pushDeviceService.openSettings(),
    networkMode: 'always',
    onError: (error) => {
      logger.warn(NOTIFICATION_LOG_EVENT.PUSH_PERMISSION_SETTINGS_OPEN_FAILED, {
        error: errorMessageOf(error),
      });
    },
  });
};
