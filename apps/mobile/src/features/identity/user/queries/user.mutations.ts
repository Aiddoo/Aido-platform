import { useUserService } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/core/errors/result';
import { useTrack } from '@src/shared/analytics';
import { isLastMutation } from '@src/shared/query/is-last-mutation';
import { mutationOptions, type QueryClient, useQueryClient } from '@tanstack/react-query';

import { type UpdateProfileResult } from '../domains/user.model';
import { type ProfileChange } from '../schemas/update-profile-request.schema';
import { USER_MUTATION_KEYS } from './user-mutation-keys';
import { USER_QUERY_KEYS } from './user-query-keys';

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
      if (isLastMutation(queryClient, USER_MUTATION_KEYS.updateProfile())) {
        writeChangedProfileFields(queryClient, input, data);
      }
    },
    onError: (_error, input, context) => {
      if (context?.previousData != null) {
        writeChangedProfileFields(queryClient, input, context.previousData);
      }
    },
    onSettled: (_data, error) => {
      // 실패가 섞이면 되돌린 값이 서버와 다를 수 있다. 마지막 저장이 끝날 때 서버 값으로 맞춘다
      if (error != null && isLastMutation(queryClient, USER_MUTATION_KEYS.updateProfile())) {
        queryClient.invalidateQueries({ queryKey: USER_QUERY_KEYS.me() });
      }
    },
    meta: { errorFeedback: { feature: 'user', fallbackKey: 'user:profile.updateFailed' } },
  });
}
