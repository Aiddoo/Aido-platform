import { INQUIRY_CATEGORY } from '@aido/api/vocabulary';
import { useApplicationMetadata } from '@src/bootstrap/providers/di-context';
import { t } from '@src/shared/i18n';

import type { SubscriptionSupportFailure } from '../utils/subscription-failure.view-model';
import { toSubscriptionInquiryDraft } from '../utils/subscription-inquiry-draft';
import { useCheckoutRoute } from './use-checkout-route';

/** 구독 실패를 문의 화면으로 넘긴다. 무엇이 실패했는지와 오류 코드를 미리 채워 되묻는 일을 줄인다 */
export function useOpenSubscriptionInquiry() {
  const applicationMetadata = useApplicationMetadata();
  // 결제 모달(탭 위)이면 모달을 닫고 탭 묶음 하나 안에서, 구독 관리 화면(탭 안)이면 그 탭에 쌓는다
  const [, leaveTo] = useCheckoutRoute();

  return ({
    titleKey,
    diagnosticCode,
  }: Pick<SubscriptionSupportFailure, 'titleKey' | 'diagnosticCode'>) => {
    const content = toSubscriptionInquiryDraft({
      subject: t(titleKey),
      diagnosticCode,
      installation: applicationMetadata.getInstallation(),
    });
    leaveTo({
      pathname: '/settings/inquiry',
      params: { category: INQUIRY_CATEGORY.PAYMENT, content },
    });
  };
}
