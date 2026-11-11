import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { InviteeIdentity } from "../read-models/invitee-identity.read-model.js";

/** 초대 흐름이 읽는 사용자 정보. 사용자 테이블을 다른 slice 대신 이 포트로만 읽는다. */
export abstract class InviteUserReaderPort {
  abstract findInviteeIdentity(userId: UserId): Promise<InviteeIdentity | null>;
  /** 알림 문구용 이름(이름이 없으면 사용자 태그). 탈퇴했거나 없으면 null */
  abstract findDisplayName(userId: UserId): Promise<string | null>;
}
