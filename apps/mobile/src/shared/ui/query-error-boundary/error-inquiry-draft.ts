import type { ErrorDiagnosis } from '@src/shared/errors/error-diagnosis';
import { t } from '@src/shared/i18n';

interface ErrorInquiryDraftInput {
  diagnosis: ErrorDiagnosis;
  /** 플랫폼·앱 버전·시각을 담은 진단 코드(`createDiagnosticCode`) */
  diagnosticCode: string;
}

/**
 * 오류 화면의 문의 본문 첫 줄. 서버 로그·Sentry를 찾을 값(진단 코드·오류 코드·요청 ID)만 담고
 * 사용자·기기 식별자와 오류 문구는 넣지 않는다. 구독 문의 초안과 같은 「제목 + (값)」 모양이다
 */
export function toErrorInquiryDraft({
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
