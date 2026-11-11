import { useHaptics, usePreferenceService } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/core/errors/result';
import { useTrack } from '@src/shared/analytics';
import { t } from '@src/shared/i18n';
import { isLastMutation } from '@src/shared/query/is-last-mutation';
import { useAppToast } from '@src/shared/ui/toast/use-app-toast';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';
import { pickBy } from 'es-toolkit';

import { isInvalidTimeRangeError, isPremiumReminderTimeError } from '../domains/preference.error';
import { type PreferenceChange } from '../schemas/preference-request.schema';
import { PREFERENCE_MUTATION_KEYS } from './preference-mutation-keys';
import { PREFERENCE_QUERY_KEYS } from './preference-query-keys';

type UpdatePreferenceVariables = PreferenceChange & {
  /** 여러 필드를 한 번에 바꾸는 토글을 설정 하나로 집계할 때 쓴다. */
  trackAs?: { setting: 'weatherEnabled'; value: boolean };
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

function isRejectedPreference(error: unknown) {
  return getRejectionMessage(error) != null;
}

export function useUpdatePreferenceMutationOptions() {
  const haptics = useHaptics();
  const preferenceService = usePreferenceService();
  const { trackEvent } = useTrack();
  const queryClient = useQueryClient();
  const toast = useAppToast();

  return mutationOptions({
    // 연결이 없을 때 요청을 쥐고 기다리면 낙관적으로 바꾼 토글이 잠긴 채 남는다. 바로 실패해 되돌린다
    networkMode: 'always',
    mutationKey: PREFERENCE_MUTATION_KEYS.writes(),
    mutationFn: async ({ trackAs: _trackAs, ...change }: UpdatePreferenceVariables) =>
      unwrap(await preferenceService.updatePreference(change)),
    onMutate: async ({ trackAs: _trackAs, ...change }) => {
      await queryClient.cancelQueries({ queryKey: PREFERENCE_QUERY_KEYS.current() });

      const previousData = queryClient.getQueryData(PREFERENCE_QUERY_KEYS.current());

      queryClient.setQueryData(PREFERENCE_QUERY_KEYS.current(), (old) =>
        old == null ? old : { ...old, ...change },
      );

      return { previousData };
    },
    onSuccess: (data, { trackAs, ...change }) => {
      if (trackAs) {
        trackEvent('settings_changed', { setting: trackAs.setting, value: String(trackAs.value) });
      } else {
        for (const [setting, value] of Object.entries(change)) {
          trackEvent('settings_changed', { setting, value: String(value) });
        }
      }
      // invalidate 대신 응답을 직접 써 깜빡임을 막되, 다른 저장이 진행 중이면 그 변경이 없어 마지막 응답이 맞춘다
      if (isLastMutation(queryClient, PREFERENCE_MUTATION_KEYS.writes())) {
        queryClient.setQueryData(PREFERENCE_QUERY_KEYS.current(), data);
      }
    },
    onError: (error, { trackAs: _trackAs, ...change }, context) => {
      // 스냅샷을 통째로 덮으면 함께 진행 중인 다른 토글을 지운다. 이 저장이 바꾼 필드만 되돌린다
      const previousData = context?.previousData;
      if (previousData != null) {
        queryClient.setQueryData(PREFERENCE_QUERY_KEYS.current(), (old) =>
          old == null ? old : { ...old, ...pickBy(previousData, (_value, key) => key in change) },
        );
      }

      const rejection = getRejectionMessage(error);
      if (rejection != null) {
        haptics.notify('error');
        toast.error(rejection);
      }
    },
    onSettled: (_data, error) => {
      // 실패가 섞이면 되돌린 값이 서버와 다를 수 있다. 마지막 저장이 끝날 때 서버 값으로 맞춘다
      if (error != null && isLastMutation(queryClient, PREFERENCE_MUTATION_KEYS.writes())) {
        queryClient.invalidateQueries({ queryKey: PREFERENCE_QUERY_KEYS.current() });
      }
    },
    meta: {
      errorFeedback: {
        feature: 'user',
        fallbackKey: 'auth:toasts.settingsChangeFailed',
        isHandledByFeature: isRejectedPreference,
      },
    },
  });
}
