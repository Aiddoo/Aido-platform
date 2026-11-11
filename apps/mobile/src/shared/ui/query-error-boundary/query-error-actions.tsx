import { INQUIRY_CATEGORY } from '@aido/api/vocabulary';
import { getNowInstant } from '@src/shared/date/clock';
import { getErrorMessage } from '@src/shared/errors';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { t as translate, useTranslation } from '@src/shared/i18n';
import { expoNativeApplicationMetadataGateway } from '@src/shared/infra/application/expo-native-application-metadata-gateway';
import { expoExternalLinkGateway } from '@src/shared/infra/linking/expo-external-link-gateway';
import { logger } from '@src/shared/infra/logger/global-logger';
import { createDiagnosticCode } from '@src/shared/utils/create-diagnostic-code';
import { createSupportMailUrl } from '@src/shared/utils/support-mail';
import { router } from 'expo-router';

import type { SheetRouteExit } from '../bottom-sheet/sheet-route';
import { Result } from '../result/result';
import { TextButton } from '../text-button/text-button';
import { VStack } from '../v-stack/v-stack';
import { QUERY_ERROR_LOG_EVENT } from './query-error-log-events';

/** 예상하지 못한 조회 오류에서 여는 문의. 오류 신고 분류를 미리 고른다 */
const BUG_REPORT_INQUIRY_HREF = {
  pathname: '/settings/inquiry',
  params: { category: INQUIRY_CATEGORY.BUG_REPORT },
} as const;

/** route 시트 안의 오류 화면에서 문의할 때: 시트를 닫고 그 자리를 문의 화면으로 바꾼다 */
export const INQUIRY_SHEET_EXIT: SheetRouteExit = {
  type: 'replace',
  href: BUG_REPORT_INQUIRY_HREF,
};

function openBugReportInquiry() {
  return router.push(BUG_REPORT_INQUIRY_HREF);
}

/** 내비게이터가 없을 때(루트 경계)의 문의: 진단 코드만 담은 메일을 연다 */
export function openSupportMail() {
  const code = createDiagnosticCode({
    platform: process.env.EXPO_OS,
    appVersion: expoNativeApplicationMetadataGateway.getInstallation()?.currentVersion ?? null,
    occurredAt: getNowInstant(),
  });
  const url = createSupportMailUrl({
    subject: translate('common:errorBoundary.mailSubject', { code }),
    body: translate('common:errorBoundary.mailBody', { code }),
  });
  return expoExternalLinkGateway.open(url).catch((error: unknown) =>
    logger.warn(QUERY_ERROR_LOG_EVENT.SUPPORT_MAIL_OPEN_FAILED, {
      error: getErrorMessage(error),
    }),
  );
}

interface QueryErrorActionsProps {
  onRetry: () => void;
  /** 기본은 문의 화면으로 이동. 시트·다이얼로그 안에서는 먼저 닫고 이동하도록 바꿔 준다 */
  onInquiry?: () => void;
  /** 다시 시도 버튼의 testID */
  testID?: string;
}

export function QueryErrorActions({
  onRetry,
  onInquiry = openBugReportInquiry,
  testID,
}: QueryErrorActionsProps) {
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
  onPress = openBugReportInquiry,
}: {
  onPress?: () => void;
}) {
  const { t } = useTranslation('common');
  const inquire = useSingleTap(onPress);

  return (
    <TextButton size="small" testID="query-error-inquiry" onPress={inquire}>
      {t('errorBoundary.inquiry')}
    </TextButton>
  );
};
