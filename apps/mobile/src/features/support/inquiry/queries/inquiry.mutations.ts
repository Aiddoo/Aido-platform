import { useHaptics, useInquiryService } from '@src/bootstrap/providers/di-context';
import { isBusinessError, unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/use-app-toast';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { t } from '@src/shared/i18n';
import { mutationOptions } from '@tanstack/react-query';
import { router } from 'expo-router';

import type { InquiryRequestValues } from '../schemas/inquiry-form.schema';

export const useCreateInquiryMutationOptions = () => {
  const haptics = useHaptics();
  const goBack = useSingleTap(router.back);

  const inquiryService = useInquiryService();
  const toast = useAppToast();

  return mutationOptions({
    mutationFn: async (input: InquiryRequestValues) => {
      const result = await inquiryService.createInquiry(input);

      return unwrap(result);
    },
    onSuccess: () => {
      haptics.notify('success');

      toast.success(t('inquiry:toasts.submitted'));

      goBack();
    },
    onError: (error) => {
      if (!isBusinessError(error)) {
        return;
      }

      haptics.notify('error');

      toast.error(error, { fallback: t('inquiry:toasts.submitFailed') });
    },
  });
};
