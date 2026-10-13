import type { UpdatePreferenceInput } from '@aido/api';
import { ErrorCode } from '@aido/api/errors';
import { usePreferenceService } from '@src/bootstrap/providers/di-context';
import { useTrack } from '@src/shared/analytics';
import { isApiError } from '@src/shared/errors';
import { unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/use-app-toast';
import { t } from '@src/shared/i18n';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';

import { PREFERENCE_QUERY_KEYS } from '../constants/preference-query-keys';
import type { Preference } from '../domains/preference.model';

type UpdatePreferenceArgs = UpdatePreferenceInput & {
  /** 여러 필드를 한 번에 바꾸는 토글을 설정 하나로 집계할 때 쓴다. */
  trackAs?: 'weatherEnabled';
};

export const useUpdatePreferenceMutationOptions = () => {
  const preferenceService = usePreferenceService();
  const { trackEvent } = useTrack();
  const queryClient = useQueryClient();
  const toast = useAppToast();

  return mutationOptions({
    mutationFn: async ({ trackAs: _trackAs, ...input }: UpdatePreferenceArgs) => {
      const result = await preferenceService.updatePreference(input);
      return unwrap(result);
    },
    onMutate: async ({ trackAs: _trackAs, ...input }) => {
      await queryClient.cancelQueries({ queryKey: PREFERENCE_QUERY_KEYS.current() });

      const previousData = queryClient.getQueryData<Preference>(PREFERENCE_QUERY_KEYS.current());

      queryClient.setQueryData<Preference>(PREFERENCE_QUERY_KEYS.current(), (old) => {
        if (!old) {
          return old;
        }
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
      queryClient.setQueryData<Preference>(PREFERENCE_QUERY_KEYS.current(), data);
    },
    onError: (error, _input, context) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

      if (context?.previousData) {
        queryClient.setQueryData(PREFERENCE_QUERY_KEYS.current(), context.previousData);
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
