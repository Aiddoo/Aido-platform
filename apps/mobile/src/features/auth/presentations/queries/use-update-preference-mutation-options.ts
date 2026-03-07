import { ErrorCode } from '@aido/errors';
import type { UpdatePreferenceInput } from '@aido/validators';
import { useAuthService } from '@src/bootstrap/providers/di-provider';
import { useTrack } from '@src/shared/analytics';
import { isApiError } from '@src/shared/errors';
import { unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/useAppToast';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';

import type { Preference } from '../../models/auth.model';
import { AUTH_QUERY_KEYS } from '../constants/auth-query-keys.constant';

export const useUpdatePreferenceMutationOptions = () => {
  const authService = useAuthService();
  const { trackEvent } = useTrack();
  const queryClient = useQueryClient();
  const toast = useAppToast();

  return mutationOptions({
    mutationFn: async (input: UpdatePreferenceInput) => {
      const result = await authService.updatePreference(input);
      return unwrap(result);
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: AUTH_QUERY_KEYS.preference() });

      const previousData = queryClient.getQueryData<Preference>(AUTH_QUERY_KEYS.preference());

      queryClient.setQueryData<Preference>(AUTH_QUERY_KEYS.preference(), (old) => {
        if (!old) return old;
        return { ...old, ...input };
      });

      return { previousData };
    },
    onSuccess: (data, input) => {
      for (const key of Object.keys(input)) {
        trackEvent('settings_changed', {
          setting: key,
          value: String(input[key as keyof typeof input]),
        });
      }
      // 서버 응답으로 캐시를 정확하게 업데이트 (invalidate 대신 직접 업데이트로 블링킹 방지)
      queryClient.setQueryData<Preference>(AUTH_QUERY_KEYS.preference(), data);
    },
    onError: (error, _input, context) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

      if (context?.previousData) {
        queryClient.setQueryData(AUTH_QUERY_KEYS.preference(), context.previousData);
      }

      if (isApiError(error)) {
        if (error.hasCode(ErrorCode.PREFERENCE_1701)) {
          toast.error('리마인드 시간 변경은 프리미엄 기능이에요');
          return;
        }
        if (error.hasCode(ErrorCode.PREFERENCE_1702)) {
          toast.error('시간 범위가 올바르지 않아요');
          return;
        }
      }

      toast.error(error, { fallback: '설정 변경에 실패했어요' });
    },
  });
};
