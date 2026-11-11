import { useHaptics, useUserService } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/core/errors/result';
import { useTrack } from '@src/shared/analytics';
import { getUserFacingMessage } from '@src/shared/errors';
import { t } from '@src/shared/i18n';
import { useAppToast } from '@src/shared/ui/toast/use-app-toast';
import { mutationOptions, type QueryClient, useQueryClient } from '@tanstack/react-query';

import { USER_MUTATION_KEYS } from '../constants/user-mutation-keys';
import { USER_QUERY_KEYS } from '../constants/user-query-keys';
import { type UpdateProfileResult } from '../domains/user.model';
import { type ProfileChange } from '../schemas/update-profile-request.schema';

/** 지금 끝나는 프로필 저장이 마지막이면 true. 앞 응답이 뒤에 바꾼 값을 덮지 않게 마지막만 캐시를 맞춘다 */
function isLastProfileWrite(queryClient: QueryClient) {
  return queryClient.isMutating({ mutationKey: USER_MUTATION_KEYS.updateProfile() }) === 1;
}

/** 다른 필드는 진행 중인 저장보다 오래됐을 수 있고 통째로 덮으면 그 저장을 지워 바꾼 필드만 덮는다 */
function writeChangedProfileFields(
  queryClient: QueryClient,
  input: ProfileChange,
  source: UpdateProfileResult,
) {
  queryClient.setQueryData(USER_QUERY_KEYS.me(), (old) => {
    if (old == null) {
      return old;
    }
    return {
      ...old,
      ...(input.name != null && { name: source.name }),
      // oxlint-disable-next-line aido/no-strict-nullish -- profileImage null은 사진 지우기다
      ...(input.profileImage !== undefined && { profileImage: source.profileImage }),
    };
  });
}

export function useUpdateProfileMutationOptions() {
  const haptics = useHaptics();
  const toast = useAppToast();
  const userService = useUserService();
  const { trackEvent } = useTrack();
  const queryClient = useQueryClient();

  return mutationOptions({
    // 오프라인에 멈춰 두면 저장 버튼이 돌기만 한다. 바로 실패해 입력값을 남긴 채 알린다
    networkMode: 'always',
    mutationKey: USER_MUTATION_KEYS.updateProfile(),
    mutationFn: async (input: ProfileChange) => {
      const result = await userService.updateProfile(input);
      return unwrap(result);
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: USER_QUERY_KEYS.me() });

      const previousData = queryClient.getQueryData(USER_QUERY_KEYS.me());

      queryClient.setQueryData(USER_QUERY_KEYS.me(), (old) => {
        if (!old) {
          return old;
        }
        return {
          ...old,
          ...(input.name != null && { name: input.name }),
          // oxlint-disable-next-line aido/no-strict-nullish -- profileImage null은 사진 지우기다
          ...(input.profileImage !== undefined && { profileImage: input.profileImage }),
        };
      });

      return { previousData };
    },
    onSuccess: (data, input) => {
      trackEvent('profile_edited', { field: Object.keys(input).join(',') });
      if (isLastProfileWrite(queryClient)) {
        writeChangedProfileFields(queryClient, input, data);
      }
    },
    onError: (error, input, context) => {
      haptics.notify('error');
      toast.error(getUserFacingMessage(error), { fallback: t('user:profile.updateFailed') });

      if (context?.previousData != null) {
        writeChangedProfileFields(queryClient, input, context.previousData);
      }
    },
    onSettled: (_data, error) => {
      // 실패가 섞이면 되돌린 값이 서버와 다를 수 있다. 마지막 저장이 끝날 때 서버 값으로 맞춘다
      if (error != null && isLastProfileWrite(queryClient)) {
        queryClient.invalidateQueries({ queryKey: USER_QUERY_KEYS.me() });
      }
    },
  });
}
