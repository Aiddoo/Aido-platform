import { INQUIRY_CATEGORY } from '@aido/api';
import { useTranslation } from '@src/shared/i18n';
import { router } from 'expo-router';

import type { SheetRouteExit } from '../bottom-sheet/sheet-route';
import { Result } from '../result/result';
import { TextButton } from '../text-button/text-button';
import { VStack } from '../v-stack/v-stack';

/** 예상하지 못한 조회 오류에서 여는 문의. 오류 신고 분류를 미리 고른다 */
export const BUG_REPORT_INQUIRY_HREF = {
  pathname: '/settings/inquiry',
  params: { category: INQUIRY_CATEGORY.BUG_REPORT },
} as const;

/** route 시트 안의 오류 화면에서 문의할 때: 시트를 닫고 그 자리를 문의 화면으로 바꾼다 */
export const INQUIRY_SHEET_EXIT: SheetRouteExit = {
  type: 'replace',
  href: BUG_REPORT_INQUIRY_HREF,
};

export const openBugReportInquiry = () => router.push(BUG_REPORT_INQUIRY_HREF);

interface QueryErrorActionsProps {
  onRetry: () => void;
  /** 기본은 문의 화면으로 이동. 시트·다이얼로그 안에서는 먼저 닫고 이동하도록 바꿔 준다 */
  onInquiry?: () => void;
}

/** 오류 규칙의 두 갈래: 다시 시도(주 버튼)와 문의하기(보조 텍스트 버튼) */
export function QueryErrorActions({
  onRetry,
  onInquiry = openBugReportInquiry,
}: QueryErrorActionsProps) {
  const { t } = useTranslation('common');

  return (
    <VStack align="center" gap={8}>
      <Result.Button onPress={onRetry}>{t('actions.retry')}</Result.Button>
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

  return (
    <TextButton size="small" testID="query-error-inquiry" onPress={onPress}>
      {t('errorBoundary.inquiry')}
    </TextButton>
  );
};
