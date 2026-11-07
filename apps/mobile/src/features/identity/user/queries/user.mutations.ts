import { useHaptics, useUserService } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/core/errors/result';
import { useTrack } from '@src/shared/analytics';
import { getUserFacingMessage } from '@src/shared/errors';
import { t } from '@src/shared/i18n';
import { useAppToast } from '@src/shared/ui/toast/use-app-toast';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

import { USER_QUERY_KEYS } from '../constants/user-query-keys';
import type { ProfileChange, User } from '../schemas/user.schema';

export function useUpdateProfileMutationOptions() {
  const haptics = useHaptics();
  const toast = useAppToast();
  const userService = useUserService();
  const { trackEvent } = useTrack();
  const queryClient = useQueryClient();

  return mutationOptions({
    // 오프라인에 멈춰 두면 저장 버튼이 돌기만 한다. 바로 실패해 입력값을 남긴 채 알린다
    networkMode: 'always',
    mutationFn: async (input: ProfileChange) => {
      const result = await userService.updateProfile(input);
      return unwrap(result);
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: USER_QUERY_KEYS.me() });

      const previousData = queryClient.getQueryData<User>(USER_QUERY_KEYS.me());

      queryClient.setQueryData<User>(USER_QUERY_KEYS.me(), (old) => {
        if (!old) {
          return old;
        }
        return {
          ...old,
          ...(input.name != null && { name: input.name }),
          // nullish-strict: profileImage null은 사진 지우기다
          ...(input.profileImage !== undefined && { profileImage: input.profileImage }),
        };
      });

      return { previousData };
    },
    onSuccess: (data, input) => {
      trackEvent('profile_edited', { field: Object.keys(input).join(',') });
      queryClient.setQueryData<User>(USER_QUERY_KEYS.me(), (old) => {
        if (!old) {
          return old;
        }
        return {
          ...old,
          name: data.name,
          profileImage: data.profileImage,
        };
      });
    },
    onError: (error, _input, context) => {
      haptics.notify('error');
      toast.error(getUserFacingMessage(error), { fallback: t('user:profile.updateFailed') });

      if (context?.previousData) {
        queryClient.setQueryData(USER_QUERY_KEYS.me(), context.previousData);
      }
    },
  });
}
