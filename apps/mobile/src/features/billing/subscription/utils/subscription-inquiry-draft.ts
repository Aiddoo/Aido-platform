import type { NativeApplicationMetadata } from '@src/core/ports/native-application-metadata-gateway';
import { t } from '@src/shared/i18n';
import { match } from 'ts-pattern';

interface SubscriptionInquiryDraftInput {
  /** 무엇이 실패했는지. 화면에 보인 제목을 쓰되 줄바꿈은 한 칸 띄어 한 줄로 적는다 */
  subject: string;
  diagnosticCode: string;
  /** Expo Go·웹처럼 설치 정보를 모르면 null이다 */
  installation: NativeApplicationMetadata | null;
}

function toPlatformLabel(platform: string) {
  return match(platform)
    .with('ios', () => 'iOS')
    .with('android', () => 'Android')
    .otherwise(() => platform);
}

/** 서버가 앱 버전·기기를 문의에 붙이지 않아 여기서 담는다. 토큰·사용자 ID·영수증 같은 민감한 값은 넣지 않는다 */
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
