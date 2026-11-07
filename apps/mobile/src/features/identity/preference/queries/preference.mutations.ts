import { useHaptics, usePreferenceService } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/core/errors/result';
import { useTrack } from '@src/shared/analytics';
import { useAppToast } from '@src/shared/hooks/use-app-toast';
import { useMutationFailure } from '@src/shared/hooks/use-mutation-failure';
import { t } from '@src/shared/i18n';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

import { PREFERENCE_QUERY_KEYS } from '../constants/preference-query-keys';
import { isInvalidTimeRangeError, isPremiumReminderTimeError } from '../domains/preference.error';
import type { Preference, PreferenceChange } from '../schemas/preference.schema';

type UpdatePreferenceArgs = PreferenceChange & {
  /** 여러 필드를 한 번에 바꾸는 토글을 설정 하나로 집계할 때 쓴다. */
  trackAs?: 'weatherEnabled';
};

/** 서버가 설정 값을 거절한 이유 중 사용자에게 우리 문구로 알리는 것 */
function getRejectionMessage(error: unknown) {
  if (isPremiumReminderTimeError(error)) {
    return t('auth:toasts.premiumReminderTime');
  }
  if (isInvalidTimeRangeError(error)) {
    return t('auth:toasts.invalidTimeRange');
  }
  return undefined;
}

export function useUpdatePreferenceMutationOptions() {
  const haptics = useHaptics();
  const preferenceService = usePreferenceService();
  const { trackEvent } = useTrack();
  const queryClient = useQueryClient();
  const toast = useAppToast();
  const showFailure = useMutationFailure(t('auth:toasts.settingsChangeFailed'));

  return mutationOptions({
    // 연결이 없을 때 요청을 쥐고 기다리면 낙관적으로 바꾼 토글이 잠긴 채 남는다. 바로 실패해 되돌린다
    networkMode: 'always',
    mutationFn: async ({ trackAs: _trackAs, ...change }: UpdatePreferenceArgs) =>
      unwrap(await preferenceService.updatePreference(change)),
    onMutate: async ({ trackAs: _trackAs, ...change }) => {
      await queryClient.cancelQueries({ queryKey: PREFERENCE_QUERY_KEYS.current() });

      const previousData = queryClient.getQueryData<Preference>(PREFERENCE_QUERY_KEYS.current());

      queryClient.setQueryData<Preference>(PREFERENCE_QUERY_KEYS.current(), (old) =>
        old == null ? old : { ...old, ...change },
      );

      return { previousData };
    },
    onSuccess: (data, { trackAs, ...change }) => {
      if (trackAs) {
        trackEvent('settings_changed', {
          setting: trackAs,
          value: String(Object.values(change)[0]),
        });
      } else {
        for (const [setting, value] of Object.entries(change)) {
          trackEvent('settings_changed', { setting, value: String(value) });
        }
      }
      // invalidate 대신 응답을 캐시에 직접 써서 다시 받는 동안의 깜빡임을 막는다
      queryClient.setQueryData<Preference>(PREFERENCE_QUERY_KEYS.current(), data);
    },
    onError: (error, _change, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(PREFERENCE_QUERY_KEYS.current(), context.previousData);
      }

      const rejection = getRejectionMessage(error);
      if (rejection != null) {
        haptics.notify('error');
        toast.error(rejection);
        return;
      }

      showFailure(error);
    },
  });
}
