import { ErrorCode } from '@aido/errors';
import type { UpdatePreferenceInput } from '@aido/validators';
import { useAuthService } from '@src/bootstrap/providers/di-context';
import { useTrack } from '@src/shared/analytics';
import { isApiError } from '@src/shared/errors';
import { unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/useAppToast';
import { t } from '@src/shared/i18n';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';

import type { Preference } from '../../models/auth.model';
import { AUTH_QUERY_KEYS } from '../constants/auth-query-keys.constant';

type UpdatePreferenceArgs = UpdatePreferenceInput & {
  trackAs?: string;
};

export const useUpdatePreferenceMutationOptions = () => {
  const authService = useAuthService();
  const { trackEvent } = useTrack();
  const queryClient = useQueryClient();
  const toast = useAppToast();

  return mutationOptions({
    mutationFn: async ({ trackAs: _, ...input }: UpdatePreferenceArgs) => {
      const result = await authService.updatePreference(input);
      return unwrap(result);
    },
    onMutate: async ({ trackAs: _, ...input }) => {
      await queryClient.cancelQueries({ queryKey: AUTH_QUERY_KEYS.preference() });

      const previousData = queryClient.getQueryData<Preference>(AUTH_QUERY_KEYS.preference());

      queryClient.setQueryData<Preference>(AUTH_QUERY_KEYS.preference(), (old) => {
        if (!old) return old;
        return { ...old, ...input };
      });

      return { previousData };
    },
    onSuccess: (data, { trackAs, ...input }) => {
      if (trackAs) {
        trackEvent('settings_changed', {
          setting: trackAs,
          value: String(Object.values(input)[0]),
        });
      } else {
        for (const [setting, value] of Object.entries(input)) {
          trackEvent('settings_changed', { setting, value: String(value) });
        }
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
          toast.error(t('auth:toasts.premiumReminderTime'));
          return;
        }
        if (error.hasCode(ErrorCode.PREFERENCE_1702)) {
          toast.error(t('auth:toasts.invalidTimeRange'));
          return;
        }
      }

      toast.error(error, { fallback: t('auth:toasts.settingsChangeFailed') });
    },
  });
};
