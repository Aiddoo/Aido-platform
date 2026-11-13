import { tDynamic } from '@src/shared/i18n';

/** `errors` 카탈로그에서 코드의 사용자 문구를 찾는다. 서버 `ErrorCode`와 앱 코드가 같은 카탈로그를 쓴다 */
export function findErrorCodeMessage(code: string): string | null {
  return tDynamic('errors', code) || null;
}
