import type { InviteShareChannel } from '../schemas/invite-share.schema';
import type { Invite } from '../schemas/invite.schema';
import type { InviteCode } from '../schemas/invite.schema';

/** shared: 보냈음, copied: 링크를 복사했음, dismissed: 공유 시트를 닫았음 */
type InviteShareOutcome = 'shared' | 'copied' | 'dismissed';

export interface InviteShareResult {
  /** 실제로 쓰인 방법. 카카오톡을 못 열면 OS 공유나 복사로 바뀐다 */
  channel: InviteShareChannel;
  outcome: InviteShareOutcome;
}

/** 호출부가 사용자 언어로 만들어 넘기는 공유 문구 */
export interface InviteShareCopy {
  kakaoTitle: string;
  kakaoDescription: string;
  kakaoButton: string;
  message: string;
  dialogTitle: string;
}

export interface InviteShareContent {
  inviteCode: InviteCode;
  link: string;
  copy: InviteShareCopy;
}

export function createInviteShareContent(
  myInvite: Invite,
  copy: InviteShareCopy,
): InviteShareContent {
  return { inviteCode: myInvite.code, link: myInvite.link, copy };
}
