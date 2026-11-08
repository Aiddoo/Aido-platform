import type { NativeApplicationMetadata } from '@src/core/ports/native-application-metadata-gateway';
import { t } from '@src/shared/i18n';
import { match } from 'ts-pattern';

interface SubscriptionInquiryDraftInput {
  subject: string;
  diagnosticCode: string;
  installation: NativeApplicationMetadata | undefined;
}

function toPlatformLabel(platform: string) {
  return match(platform)
    .with('ios', () => 'iOS')
    .with('android', () => 'Android')
    .otherwise(() => platform);
}

export function toSubscriptionInquiryDraft({
  subject,
  diagnosticCode,
  installation,
}: SubscriptionInquiryDraftInput) {
  const subjectLine = subject.replace(/\s*\n\s*/g, ' ');

  if (installation?.currentVersion == null || installation.platform == null) {
    return t('subscription:inquiryDraft.withoutDevice', {
      subject: subjectLine,
      code: diagnosticCode,
    });
  }

  return t('subscription:inquiryDraft.withDevice', {
    subject: subjectLine,
    code: diagnosticCode,
    appVersion: installation.currentVersion,
    platform: toPlatformLabel(installation.platform),
  });
}
