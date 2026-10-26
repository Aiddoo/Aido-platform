import type { NativeApplicationMetadata } from '@src/core/ports/native-application-metadata';
import { t } from '@src/shared/i18n';
import { match } from 'ts-pattern';

interface SubscriptionInquiryDraftInput {
  /** 무엇이 실패했는지. 화면에 보인 제목을 그대로 쓴다 */
  subject: string;
  diagnosticCode: string;
  /** Expo Go·웹처럼 설치 정보를 모르면 undefined다 */
  installation: NativeApplicationMetadata | undefined;
}

function toPlatformLabel(platform: string) {
  return match(platform)
    .with('ios', () => 'iOS')
    .with('android', () => 'Android')
    .otherwise(() => platform);
}

/**
 * 문의 내용 맨 위에 붙일 상황 한 줄. 서버는 앱 버전·기기를 문의에 붙이지 않아 여기서 담는다.
 * 토큰·사용자 ID·영수증처럼 민감한 값은 넣지 않는다.
 */
export function toSubscriptionInquiryDraft({
  subject,
  diagnosticCode,
  installation,
}: SubscriptionInquiryDraftInput) {
  if (installation?.currentVersion == null || installation.platform == null) {
    return t('subscription:inquiryDraft.withoutDevice', { subject, code: diagnosticCode });
  }

  return t('subscription:inquiryDraft.withDevice', {
    subject,
    code: diagnosticCode,
    appVersion: installation.currentVersion,
    platform: toPlatformLabel(installation.platform),
  });
}
