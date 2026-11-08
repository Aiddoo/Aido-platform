/** 이메일 앞 두 글자(한 글자면 한 글자)와 도메인만 남기고 가운데를 가린다. ab****@aido.app */
export function maskEmail(email: string): string {
  return email.replace(/^([^@]{1,2})[^@]*(@[^@]+\.[^@]+)$/, '$1****$2');
}
