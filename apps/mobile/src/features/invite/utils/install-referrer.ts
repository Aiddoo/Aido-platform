import { parseInviteCode } from '../domains/invite.model';

const INVITE_CODE_PARAM = 'inviteCode';

/** Play 설치 referrer(`inviteCode=K7M2QX&utm_source=…`)에서 초대 코드를 꺼낸다 */
export function parseInstallReferrerInviteCode(referrer: string) {
  const params = new URLSearchParams(referrer);
  if (params.has(INVITE_CODE_PARAM)) {
    return parseInviteCode(params.get(INVITE_CODE_PARAM));
  }

  // 스토어 링크의 referrer 값 전체가 한 번 더 인코딩된 채로 오면 한 번 풀어서 다시 읽는다
  const decodedReferrer = new URLSearchParams(`referrer=${referrer}`).get('referrer') ?? '';
  return parseInviteCode(new URLSearchParams(decodedReferrer).get(INVITE_CODE_PARAM));
}
