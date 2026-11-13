import { INQUIRY_CATEGORY } from '@aido/api/vocabulary';
import { useTrack } from '@src/shared/analytics';
import { ENV } from '@src/shared/config/env';
import { getNowInstant } from '@src/shared/date/clock';
import { getErrorDiagnosis } from '@src/shared/errors';
import type { ErrorDiagnosis } from '@src/shared/errors/error-diagnosis';
import { useScreenName } from '@src/shared/hooks/use-screen-name';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { t, useTranslation } from '@src/shared/i18n';
import { openEntryHref } from '@src/shared/navigation/open-entry-href';
import { createDiagnosticCode } from '@src/shared/utils/create-diagnostic-code';
import type { Href } from 'expo-router';
import { use } from 'react';
import { ErrorBoundaryContext } from 'react-error-boundary';

import { Result } from '../result/result';
import { TextButton } from '../text-button/text-button';
import { VStack } from '../v-stack/v-stack';

interface ErrorInquiryDraftInput {
  diagnosis: ErrorDiagnosis;
  /** 플랫폼·앱 버전·시각을 담은 진단 코드(`createDiagnosticCode`) */
  diagnosticCode: string;
}

interface QueryErrorActionsProps {
  onRetry: () => void;
  /** 기본은 문의 화면으로 이동. 시트·다이얼로그 안에서는 먼저 닫고 받은 href로 이동하도록 바꿔 준다 */
  onInquiry?: (href: Href) => void;
  /** 다시 시도 버튼의 testID */
  testID?: string;
}

export function QueryErrorActions({ onRetry, onInquiry, testID }: QueryErrorActionsProps) {
  return (
    <VStack align="center" gap={8}>
      <QueryErrorActions.Retry testID={testID} onPress={onRetry} />
      <QueryErrorActions.Inquiry onPress={onInquiry} />
    </VStack>
  );
}

QueryErrorActions.Retry = function Retry({
  onPress,
  testID,
}: {
  onPress: () => void;
  testID?: string;
}) {
  const { t } = useTranslation('common');
  const { trackEvent } = useTrack();
  const screenName = useScreenName();

  return (
    <Result.Button
      testID={testID}
      onPress={() => {
        trackEvent('error_fallback_retry_tapped', { screen_name: screenName });
        onPress();
      }}
    >
      {t('actions.retry')}
    </Result.Button>
  );
};

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

// 탭 안에서는 그 탭에 쌓고, 탭 위 화면(알림함·할 일 상세·결제)에서는 그 화면을 닫고 탭 묶음 하나 안에서 연다
function openInquiry(href: Href) {
  openEntryHref(href);
}

/**
 * 오류 화면의 문의 본문 첫 줄. 서버 로그·Sentry를 찾을 값(진단 코드·오류 코드·요청 ID)만 담고
 * 사용자·기기 식별자와 오류 문구는 넣지 않는다. 구독 문의 초안과 같은 「제목 + (값)」 모양이다
 */
function toErrorInquiryDraft({
  diagnosis: { code, requestId },
  diagnosticCode,
}: ErrorInquiryDraftInput): string {
  const details = [
    t('common:errorBoundary.inquiryDraft.diagnosticCode', { value: diagnosticCode }),
    ...(code == null ? [] : [t('common:errorBoundary.inquiryDraft.errorCode', { value: code })]),
    ...(requestId == null
      ? []
      : [t('common:errorBoundary.inquiryDraft.requestId', { value: requestId })]),
  ];
  return t('common:errorBoundary.inquiryDraft.body', { details: details.join(' / ') });
}
