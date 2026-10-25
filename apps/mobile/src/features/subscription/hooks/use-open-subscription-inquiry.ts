import { INQUIRY_CATEGORY } from '@aido/api';
import { useAppVersionService } from '@src/bootstrap/providers/di-context';
import { createInquiryHref } from '@src/features/inquiry/utils/inquiry-route';
import { t } from '@src/shared/i18n';
import { router } from 'expo-router';
import { useCallback } from 'react';

import { toSubscriptionInquiryDraft } from '../utils/subscription-inquiry-draft';
import type { SubscriptionSupportFailure } from '../utils/view-models/subscription-failure.view-model';

/** 구독 실패를 문의 화면으로 넘긴다. 무엇이 실패했는지와 오류 코드를 미리 채워 되묻는 일을 줄인다 */
export function useOpenSubscriptionInquiry() {
  const appVersionService = useAppVersionService();

  return useCallback(
    ({
      titleKey,
      diagnosticCode,
    }: Pick<SubscriptionSupportFailure, 'titleKey' | 'diagnosticCode'>) => {
      const content = toSubscriptionInquiryDraft({
        subject: t(titleKey),
        diagnosticCode,
        installation: appVersionService.getInstallation(),
      });
      router.push(createInquiryHref({ category: INQUIRY_CATEGORY.BUG_REPORT, content }));
    },
    [appVersionService],
  );
}
