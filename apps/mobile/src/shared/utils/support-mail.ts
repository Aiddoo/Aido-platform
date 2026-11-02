/** 문의·신고 수신 주소. 서버 `SUPPORT_EMAIL` 기본값과 같다 */
export const SUPPORT_EMAIL = 'support@aido.kr';

interface DiagnosticCodeInput {
  platform: string;
  appVersion: string | null;
  occurredAt: Date;
}

/** 문의 메일에 붙이는 진단 코드. 사용자·기기 식별자 없이 플랫폼·앱 버전·발생 시각만 담는다 */
export const createDiagnosticCode = ({
  platform,
  appVersion,
  occurredAt,
}: DiagnosticCodeInput): string =>
  [
    platform.toUpperCase(),
    appVersion ?? 'unknown',
    occurredAt.getTime().toString(36).toUpperCase(),
  ].join('-');

interface SupportMailInput {
  subject: string;
  body: string;
}

export const buildSupportMailUrl = ({ subject, body }: SupportMailInput): string =>
  `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
