import { z } from 'zod';

import type { InviteCode } from './invite.model';
import type { Invite } from './invite.model';

/** 초대 링크를 보내는 방법. 분석 이벤트 invite_link_shared.channel과 같은 값이다 */
const InviteShareChannelSchema = z.enum(['kakao', 'copy_link', 'system']);

export type InviteShareChannel = z.output<typeof InviteShareChannelSchema>;

/** shared: 보냈음, copied: 링크를 복사했음, dismissed: 공유 시트를 닫았음 */
type InviteShareOutcome = 'shared' | 'copied' | 'dismissed';

export interface InviteShareResult {
  /** 실제로 쓰인 방법. 카카오톡을 못 열면 OS 공유나 복사로 바뀐다 */
  channel: InviteShareChannel;
  outcome: InviteShareOutcome;
}

export interface InviteShareContent {
  inviteCode: InviteCode;
  link: string;
  inviterName: string;
}

export function createInviteShareContent(
  myInvite: Invite,
  inviterName: string,
): InviteShareContent {
  return { inviteCode: myInvite.code, link: myInvite.link, inviterName };
}
