import { useInviteService } from '@src/bootstrap/providers/di-context';
import { isApiError } from '@src/shared/errors';
import { unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/use-app-toast';
import { t } from '@src/shared/i18n';
import { notifySuccess } from '@src/shared/utils/haptics';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

import { replaceMyInvite } from './invite-cache';

export function useRotateInviteCodeMutationOptions() {
  const inviteService = useInviteService();
  const queryClient = useQueryClient();
  const { success, error } = useAppToast();

  return mutationOptions({
    mutationFn: async () => unwrap(await inviteService.rotateInviteCode()),
    onSuccess: (myInvite) => {
      replaceMyInvite(queryClient, myInvite);
      notifySuccess();
      success(t('invite:toast.rotated'));
    },
    onError: (rotateError) => {
      if (isApiError(rotateError)) {
        error(rotateError.message);
      }
    },
    // 네트워크·서버 장애는 화면 오류 경계가 맡는다
    throwOnError: (rotateError) => !isApiError(rotateError),
  });
}
