import { usePreferenceApi } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/core/errors/result';
import { useTrack } from '@src/shared/analytics';
import { isLastMutation } from '@src/shared/query/is-last-mutation';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';
import { pickBy } from 'es-toolkit';

import { PREFERENCE_SETTINGS, type PreferenceChange } from '../schemas/preference-request.schema';
import {
  cancelPreference,
  getCachedPreference,
  invalidatePreference,
  setPreferenceInCache,
  updatePreferenceInCache,
} from './preference-cache';
import { PREFERENCE_MUTATION_KEYS } from './preference-mutation-keys';

type UpdatePreferenceVariables = PreferenceChange & {
  /** 여러 필드를 한 번에 바꾸는 토글을 설정 하나로 집계할 때 쓴다. */
  trackAs?: { setting: 'weatherEnabled'; value: boolean };
};

export function useUpdatePreferenceMutationOptions() {
  const preferenceApi = usePreferenceApi();
  const { trackEvent } = useTrack();
  const queryClient = useQueryClient();

  return mutationOptions({
    // 연결이 없을 때 요청을 쥐고 기다리면 낙관적으로 바꾼 토글이 잠긴 채 남는다. 바로 실패해 되돌린다
    networkMode: 'always',
    mutationKey: PREFERENCE_MUTATION_KEYS.writes(),
    mutationFn: async ({ trackAs: _trackAs, ...change }: UpdatePreferenceVariables) =>
      unwrap(await preferenceApi.updatePreference(change)),
    onMutate: async ({ trackAs: _trackAs, ...change }) => {
      await cancelPreference(queryClient);
      const previousData = getCachedPreference(queryClient);
      updatePreferenceInCache(queryClient, (preference) => ({ ...preference, ...change }));
      return { previousData };
    },
    onSuccess: (data, { trackAs, ...change }) => {
      if (trackAs != null) {
        trackEvent('settings_changed', { setting: trackAs.setting, value: `${trackAs.value}` });
      } else {
        for (const setting of PREFERENCE_SETTINGS) {
          const value = change[setting];
          if (value != null) {
            trackEvent('settings_changed', { setting, value: `${value}` });
          }
        }
      }
      // invalidate 대신 응답을 직접 써 깜빡임을 막되, 다른 저장이 진행 중이면 그 변경이 없어 마지막 응답이 맞춘다
      if (isLastMutation(queryClient, PREFERENCE_MUTATION_KEYS.writes())) {
        setPreferenceInCache(queryClient, data);
      }
    },
    // 서버가 거절한 값(PREFERENCE_1701 프리미엄 전용 시각, 1702 시간 범위)은 전역 피드백이 카탈로그 문구로 알린다
    onError: (_error, { trackAs: _trackAs, ...change }, context) => {
      // 스냅샷을 통째로 덮으면 함께 진행 중인 다른 토글을 지운다. 이 저장이 바꾼 필드만 되돌린다
      const previousData = context?.previousData;
      if (previousData != null) {
        updatePreferenceInCache(queryClient, (preference) => ({
          ...preference,
          ...pickBy(previousData, (_value, key) => key in change),
        }));
      }
    },
    onSettled: (_data, error) => {
      // 실패가 섞이면 되돌린 값이 서버와 다를 수 있다. 마지막 저장이 끝날 때 서버 값으로 맞춘다
      if (error != null && isLastMutation(queryClient, PREFERENCE_MUTATION_KEYS.writes())) {
        invalidatePreference(queryClient);
      }
    },
    meta: { errorFeedback: { feature: 'user', fallbackKey: 'auth:toasts.settingsChangeFailed' } },
  });
}
