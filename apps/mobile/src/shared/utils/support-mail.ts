/** 문의·신고 수신 주소. 서버 `SUPPORT_EMAIL` 기본값과 같다 */
const SUPPORT_EMAIL = 'support@aido.kr';

interface SupportMailInput {
  subject: string;
  body: string;
}

export function createSupportMailUrl({ subject, body }: SupportMailInput): string {
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
