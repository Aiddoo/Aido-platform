import type { CreateInquiryInput } from '@aido/validators';
import { useInquiryService } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/useAppToast';
import { mutationOptions } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';

export const useCreateInquiryMutationOptions = () => {
  const inquiryService = useInquiryService();
  const toast = useAppToast();
  const router = useRouter();

  return mutationOptions({
    mutationFn: async (input: CreateInquiryInput) => {
      const result = await inquiryService.createInquiry(input);

      return unwrap(result);
    },
    onSuccess: (data) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      toast.success(data.message);

      router.back();
    },
    onError: (error) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

      toast.error(error, { fallback: '문의 접수에 실패했어요' });
    },
  });
};
