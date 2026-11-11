import { formatDateLabel } from '@src/shared/date/format/date-format';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { t } from '@src/shared/i18n';
import { useAppToast } from '@src/shared/ui/toast/use-app-toast';
import { useCallback } from 'react';

import { type ConsentResult } from '../domains/consent.model';

const CONSENT_RESULT_KEYS = {
  marketing: {
    agreed: 'notification:consentResult.marketingAgreed',
    withdrawn: 'notification:consentResult.marketingWithdrawn',
  },
  marketingPush: {
    agreed: 'notification:consentResult.marketingPushAgreed',
    withdrawn: 'notification:consentResult.marketingPushWithdrawn',
  },
} as const;

/**
 * 정보통신망법 50조: 광고성 정보 동의·철회 결과를 전송자·처리 일시와 함께 알린다.
 * 설정 토글과 푸시의 수신 거부 버튼이 같은 문구를 쓰도록 여기 한 곳에서 띄운다. 일시는 서버가 처리한 값이다
 */
export function useConsentResultToast() {
  const toast = useAppToast();
  const dateFormatContext = useDateFormatContext();

  return useCallback(
    (consent: keyof typeof CONSENT_RESULT_KEYS, result: ConsentResult) => {
      toast.success(
        t(CONSENT_RESULT_KEYS[consent][result.type], {
          date: formatDateLabel(result.at, 'fullDate', dateFormatContext),
        }),
      );
    },
    [dateFormatContext, toast],
  );
}
