import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { Invite } from "../../domain/invite.aggregate.js";

export abstract class InviteRepositoryPort {
  abstract findActiveByInviterId(inviterId: UserId): Promise<Invite | null>;
  // 새 초대를 저장한다. 코드가 이미 쓰였으면 SAVEPOINT 없이 건너뛰고 false라 호출자가 새 코드로 다시 시도한다.
  // 같은 사람의 두 번째 ACTIVE 초대는 UNIQUE 위반으로 실패한다
  abstract saveIfCodeUnused(invite: Invite): Promise<boolean>;
  // 저장한 초대의 상태·폐기 시각을 덮어쓴다
  abstract save(invite: Invite): Promise<void>;
}
