import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { InviteCode } from "../../domain/invite-code.vo.js";
import type { InviteId } from "../../domain/invite-id.vo.js";
import type { Invite } from "../../domain/invite.aggregate.js";
import type { InviteWithInviter } from "../read-models/inviter-profile.read-model.js";

export abstract class InviteRepositoryPort {
  abstract nextId(): Promise<InviteId>;
  abstract findActiveByInviterId(inviterId: UserId): Promise<Invite | null>;
  /** 코드 UNIQUE 인덱스 한 번으로 초대와 초대한 사람 프로필을 읽는다. 탈퇴 대기 중인 사람의 초대는 null이다. */
  abstract findByCodeWithInviter(code: InviteCode): Promise<InviteWithInviter | null>;
  /**
   * 새 초대를 저장한다. 코드가 이미 쓰였으면 저장하지 않고 false다. 같은 사람의 두 번째 ACTIVE 초대는
   * UNIQUE 위반으로 실패한다.
   */
  abstract add(invite: Invite): Promise<boolean>;
  /** add한 초대의 상태·폐기 시각을 덮어쓴다. */
  abstract save(invite: Invite): Promise<void>;
}
