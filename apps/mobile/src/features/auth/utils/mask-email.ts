/** 이메일 앞 두 글자와 도메인만 남기고 가운데를 가린다. ab****@aido.app */
export function maskEmail(email: string): string {
  return email.replace(/(.{2})(.*)(@.*)/, '$1****$3');
}
