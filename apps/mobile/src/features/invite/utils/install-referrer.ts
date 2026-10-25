import { parseInviteCode } from '../domains/invite.model';
import { readQueryValue, safeDecodeURIComponent } from './url-query';

/** Play 설치 referrer(`inviteCode=K7M2QX&utm_source=…`)에서 초대 코드를 꺼낸다 */
export function parseInstallReferrerInviteCode(referrer: string) {
  // 스토어 링크의 referrer 값이 한 번 더 인코딩된 채로 오는 경우가 있다
  const query = referrer.includes('=') ? referrer : safeDecodeURIComponent(referrer);
  return parseInviteCode(readQueryValue(`?${query}`, 'inviteCode'));
}
