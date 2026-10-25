import type { CreateInquiryInput } from '@aido/api';
import { useInquiryService } from '@src/bootstrap/providers/di-context';
import { isBusinessError, unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/use-app-toast';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { t } from '@src/shared/i18n';
import { notifyError, notifySuccess } from '@src/shared/utils/haptics';
import { mutationOptions } from '@tanstack/react-query';
import { router } from 'expo-router';

export const useCreateInquiryMutationOptions = () => {
  const goBack = useSingleTap(router.back);

  const inquiryService = useInquiryService();
  const toast = useAppToast();

  return mutationOptions({
    mutationFn: async (input: CreateInquiryInput) => {
      const result = await inquiryService.createInquiry(input);

      return unwrap(result);
    },
    onSuccess: () => {
      notifySuccess();

      toast.success(t('inquiry:toasts.submitted'));

      goBack();
    },
    onError: (error) => {
      if (!isBusinessError(error)) {
        return;
      }

      notifyError();

      toast.error(error, { fallback: t('inquiry:toasts.submitFailed') });
    },
  });
};
