import { INQUIRY_CATEGORY } from '@aido/api/vocabulary';
import { ENV } from '@src/shared/config/env';
import { getNowInstant } from '@src/shared/date/clock';
import { getErrorDiagnosis } from '@src/shared/errors';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import { createDiagnosticCode } from '@src/shared/utils/create-diagnostic-code';
import { type Href, router } from 'expo-router';
import { use } from 'react';
import { ErrorBoundaryContext } from 'react-error-boundary';

import { Result } from '../result/result';
import { TextButton } from '../text-button/text-button';
import { VStack } from '../v-stack/v-stack';
import { toErrorInquiryDraft } from './error-inquiry-draft';

interface QueryErrorActionsProps {
  onRetry: () => void;
  /** 기본은 문의 화면으로 이동. 시트·다이얼로그 안에서는 먼저 닫고 받은 href로 이동하도록 바꿔 준다 */
  onInquiry?: (href: Href) => void;
  /** 다시 시도 버튼의 testID */
  testID?: string;
}

export function QueryErrorActions({ onRetry, onInquiry, testID }: QueryErrorActionsProps) {
  const { t } = useTranslation('common');

  return (
    <VStack align="center" gap={8}>
      <Result.Button testID={testID} onPress={onRetry}>
        {t('actions.retry')}
      </Result.Button>
      <QueryErrorActions.Inquiry onPress={onInquiry} />
    </VStack>
  );
}

QueryErrorActions.Inquiry = function Inquiry({
  onPress = openInquiry,
}: {
  onPress?: (href: Href) => void;
}) {
  const { t } = useTranslation('common');
  const getInquiryHref = useBugReportInquiryHref();
  const inquire = useSingleTap(() => onPress(getInquiryHref()));

  return (
    <TextButton size="small" testID="query-error-inquiry" onPress={inquire}>
      {t('errorBoundary.inquiry')}
    </TextButton>
  );
};

/**
 * 오류 화면에서 여는 문의. 오류 신고 분류를 고르고, 경계가 받은 오류의 진단 값(진단 코드·오류 코드·요청 ID)을
 * 본문 첫 줄에 담아 되묻는 일을 줄인다. 경계 밖에서는 진단 코드만 담는다
 */
function useBugReportInquiryHref(): () => Href {
  const error = use(ErrorBoundaryContext)?.error ?? null;

  return () => ({
    pathname: '/settings/inquiry',
    params: {
      category: INQUIRY_CATEGORY.BUG_REPORT,
      content: toErrorInquiryDraft({
        diagnosis: getErrorDiagnosis(error),
        diagnosticCode: createDiagnosticCode({
          platform: ENV.PLATFORM,
          appVersion: ENV.APP_VERSION ?? null,
          occurredAt: getNowInstant(),
        }),
      }),
    },
  });
}

function openInquiry(href: Href) {
  router.push(href);
}
