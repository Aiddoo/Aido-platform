import { useHaptics, useInquiryService } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/core/errors/result';
import { getUserFacingMessage } from '@src/shared/errors';
import { t } from '@src/shared/i18n';
import { useAppToast } from '@src/shared/ui/toast/use-app-toast';
import { mutationOptions } from '@tanstack/react-query';

import type { InquiryFormValues } from '../schemas/inquiry-form.schema';

export function useCreateInquiryMutationOptions() {
  const inquiryService = useInquiryService();
  const haptics = useHaptics();
  const toast = useAppToast();

  return mutationOptions({
    // 오프라인에 멈추면 연결된 뒤 나도 모르게 전송돼 바로 실패시킨다
    networkMode: 'always',
    mutationFn: async (input: InquiryFormValues) =>
      unwrap(await inquiryService.createInquiry(input)),
    onSuccess: () => {
      haptics.notify('success');
      toast.success(t('inquiry:toasts.submitted'));
    },
    onError: (error) => {
      haptics.notify('error');
      toast.error(getUserFacingMessage(error), { fallback: t('inquiry:toasts.submitFailed') });
    },
  });
}
