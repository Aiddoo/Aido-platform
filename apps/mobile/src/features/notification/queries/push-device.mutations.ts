import { useLogger, usePushRegistrationService } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/core/errors/result';
import { getErrorMessage, toError } from '@src/shared/errors';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

import { NOTIFICATION_LOG_EVENT } from '../constants/notification-log-events';
import { isPushReportRetryableError } from '../domains/notification.error';
import { invalidatePushPermission } from './push-permission-cache';

/** 화면 뒤에서 기기 상태를 서버에 알린다. 실패는 다음 동기화 때 다시 보내므로 사용자에게 보이지 않는다 */
export function useReportPushDeviceMutationOptions() {
  const pushRegistrationService = usePushRegistrationService();
  const logger = useLogger();
  const queryClient = useQueryClient();

  return mutationOptions({
    mutationFn: async ({ force }: { force: boolean }) =>
      unwrap(await pushRegistrationService.report({ force })),
    onSettled: () => invalidatePushPermission(queryClient),
    onError: (error) => {
      if (isPushReportRetryableError(error)) {
        logger.warn(NOTIFICATION_LOG_EVENT.PUSH_DEVICE_REPORT_FAILED, {
          error: getErrorMessage(error),
        });
        return;
      }
      logger.error(NOTIFICATION_LOG_EVENT.PUSH_DEVICE_REPORT_FAILED, toError(error));
    },
    meta: { errorFeedback: false },
  });
}
