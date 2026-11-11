import { useHaptics, useInquiryApi } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/core/errors/result';
import { t } from '@src/shared/i18n';
import { useAppToast } from '@src/shared/ui/toast/use-app-toast';
import { mutationOptions } from '@tanstack/react-query';

import type { InquiryFormValues } from '../schemas/inquiry-form.schema';

export function useCreateInquiryMutationOptions() {
  const inquiryApi = useInquiryApi();
  const haptics = useHaptics();
  const toast = useAppToast();

  return mutationOptions({
    // 오프라인에 멈춰 두면 연결된 뒤 지금 화면에서 나도 모르게 전송된다. 바로 실패해 글자를 남긴 채 안내한다
    networkMode: 'always',
    mutationFn: async (input: InquiryFormValues) => unwrap(await inquiryApi.createInquiry(input)),
    onSuccess: () => {
      haptics.notify('success');
      toast.success(t('inquiry:toasts.submitted'));
    },
    meta: { errorFeedback: { feature: 'inquiry', fallbackKey: 'inquiry:toasts.submitFailed' } },
  });
}
