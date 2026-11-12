import { getNowInstant } from '@src/shared/date/clock';
import { getErrorMessage } from '@src/shared/errors';
import { t } from '@src/shared/i18n';
import { expoNativeApplicationMetadataGateway } from '@src/shared/infra/application/expo-native-application-metadata-gateway';
import { expoExternalLinkGateway } from '@src/shared/infra/linking/expo-external-link-gateway';
import { logger } from '@src/shared/infra/logger/global-logger';
import { createDiagnosticCode } from '@src/shared/utils/create-diagnostic-code';
import { createSupportMailUrl } from '@src/shared/utils/support-mail';

import { ROOT_ERROR_BOUNDARY_LOG_EVENT } from './root-error-boundary-log-events';

/** 내비게이터·DI가 없을 수 있는 루트 경계의 문의라 어댑터를 직접 쓴다. 진단 코드만 담은 메일을 연다 */
export function openSupportMail() {
  const code = createDiagnosticCode({
    platform: process.env.EXPO_OS,
    appVersion: expoNativeApplicationMetadataGateway.getInstallation()?.currentVersion ?? null,
    occurredAt: getNowInstant(),
  });
  const url = createSupportMailUrl({
    subject: t('common:errorBoundary.mailSubject', { code }),
    body: t('common:errorBoundary.mailBody', { code }),
  });
  return expoExternalLinkGateway.open(url).catch((error: unknown) =>
    logger.warn(ROOT_ERROR_BOUNDARY_LOG_EVENT.SUPPORT_MAIL_OPEN_FAILED, {
      error: getErrorMessage(error),
    }),
  );
}
