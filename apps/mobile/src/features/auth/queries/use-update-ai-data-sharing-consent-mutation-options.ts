import { AI_DATA_SHARING_CONSENT, type UpdateAiDataSharingConsentInput } from '@aido/api';
import { useAuthService } from '@src/bootstrap/providers/di-context';
import { useTrack } from '@src/shared/analytics';
import { isApiError } from '@src/shared/errors';
import { unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/use-app-toast';
import { t } from '@src/shared/i18n';
import { notifyError } from '@src/shared/utils/haptics';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

import { AUTH_QUERY_KEYS } from '../constants/auth-query-keys';
import type { Consent } from '../domains/auth.model';

/** 앱이 보여 주는 안내는 하나뿐이라 답한 버전은 항상 현재 안내 버전이다 */
export const useUpdateAiDataSharingConsentMutationOptions = () => {
  const authService = useAuthService();
  const queryClient = useQueryClient();
  const { trackEvent } = useTrack();
  const toast = useAppToast();

  return mutationOptions({
    mutationFn: async ({ agreed }: Pick<UpdateAiDataSharingConsentInput, 'agreed'>) => {
      const result = await authService.updateAiDataSharingConsent({
        agreed,
        version: AI_DATA_SHARING_CONSENT.VERSION,
      });
      return unwrap(result);
    },

    onMutate: async ({ agreed }) => {
      await queryClient.cancelQueries({ queryKey: AUTH_QUERY_KEYS.consent() });
      const previousData = queryClient.getQueryData<Consent>(AUTH_QUERY_KEYS.consent());

      queryClient.setQueryData<Consent>(AUTH_QUERY_KEYS.consent(), (consent) =>
        consent == null
          ? consent
          : {
              ...consent,
              aiDataSharingDecision: agreed ? 'AGREED' : 'DECLINED',
              aiDataSharingAgreedAt: agreed ? new Date() : null,
            },
      );

      return { previousData };
    },

    onSuccess: (result, { agreed }) => {
      trackEvent('ai_data_sharing_consent_changed', { agreed });
      queryClient.setQueryData<Consent>(AUTH_QUERY_KEYS.consent(), (consent) =>
        consent == null ? consent : { ...consent, ...result },
      );
    },

    onError: (error, _input, context) => {
      notifyError();
      if (context?.previousData != null) {
        queryClient.setQueryData(AUTH_QUERY_KEYS.consent(), context.previousData);
      }
      toast.error(isApiError(error) ? error.message : undefined, {
        fallback: t('ai:consent.saveFailed'),
      });
    },
  });
};
