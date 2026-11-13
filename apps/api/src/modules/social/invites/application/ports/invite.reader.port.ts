import type { InviteCode } from "../../../shared/domain/invite-code.vo.js";
import type { InviteWithInviterReadModel } from "../read-models/inviter-profile.read-model.js";

export abstract class InviteReaderPort {
  // 코드 UNIQUE 인덱스 한 번으로 초대와 초대한 사람 프로필을 읽는다. 탈퇴 대기 중인 사람의 초대는 null이다
  abstract findByCodeWithInviter(code: InviteCode): Promise<InviteWithInviterReadModel | null>;
}
