import type { CreateInquiryInput } from '@aido/validators';
import { useInquiryService } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/useAppToast';
import { useSingleTap } from '@src/shared/hooks/useSingleTap';
import { t } from '@src/shared/i18n';
import { mutationOptions } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
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
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      toast.success(t('inquiry:toasts.submitted'));

      goBack();
    },
    onError: (error) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

      toast.error(error, { fallback: t('inquiry:toasts.submitFailed') });
    },
  });
};
