import type { UpdateProfileInput } from '@aido/validators';
import { useUserService } from '@src/bootstrap/providers/di-context';
import type { User } from '@src/features/user/models/user.model';
import { useTrack } from '@src/shared/analytics';
import { unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/useAppToast';
import { t } from '@src/shared/i18n';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';

import { USER_QUERY_KEYS } from '../constants/user-query-keys.constant';

export const useUpdateProfileMutationOptions = () => {
  const userService = useUserService();
  const { trackEvent } = useTrack();
  const queryClient = useQueryClient();
  const toast = useAppToast();

  return mutationOptions({
    mutationFn: async (input: UpdateProfileInput) => {
      const result = await userService.updateProfile(input);
      return unwrap(result);
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: USER_QUERY_KEYS.me() });

      const previousData = queryClient.getQueryData<User>(USER_QUERY_KEYS.me());

      queryClient.setQueryData<User>(USER_QUERY_KEYS.me(), (old) => {
        if (!old) return old;
        return {
          ...old,
          ...(input.name !== undefined && { name: input.name }),
          ...(input.profileImage !== undefined && { profileImage: input.profileImage }),
        };
      });

      return { previousData };
    },
    onSuccess: (data, input) => {
      trackEvent('profile_edited', { field: Object.keys(input).join(',') });
      queryClient.setQueryData<User>(USER_QUERY_KEYS.me(), (old) => {
        if (!old) return old;
        return {
          ...old,
          name: data.name,
          profileImage: data.profileImage,
        };
      });
    },
    onError: (error, _input, context) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      toast.error(error, { fallback: t('user:profile.updateFailed') });

      if (context?.previousData) {
        queryClient.setQueryData(USER_QUERY_KEYS.me(), context.previousData);
      }
    },
  });
};
